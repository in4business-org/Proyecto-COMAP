const { generateText } = require('ai');
const { google } = require('@ai-sdk/google');
const { SYSTEM_PROMPT } = require('./chatbot.prompts');
const tools = require('./chatbot.tools');
const prisma = require('../../config/prisma');

class ChatbotService {
  async processMessage(conversationId, userId, empresaId, userMessage, attachments = []) {
    // 1. Save user message
    await prisma.chatMessage.create({
      data: {
        conversationId,
        role: 'user',
        content: userMessage,
        attachments: attachments.length > 0 ? JSON.stringify(attachments) : null,
      },
    });

    // 2. Load conversation history
    const history = await this.getHistory(conversationId);

    // 3. Build system prompt with client context
    const contextPrompt = `${SYSTEM_PROMPT}

## Contexto del cliente actual
- User ID: ${userId}
- Empresa ID: ${empresaId || 'No vinculada'}
- Conversation ID: ${conversationId}

${empresaId ? `Cuando el cliente pregunte por su empresa, usá empresaId="${empresaId}". No le pidas el ID de la empresa al cliente, ya lo tenés.` : 'Este usuario NO tiene empresa vinculada todavía. Ofrecele ayuda para vincularse: preguntale el nombre o RUT de su empresa, buscala con buscar_empresa, y vinculalo con vincular_empresa usando userId="' + userId + '".'}`;

    // 4. Call LLM with tools
    const result = await generateText({
      model: google('gemini-2.5-flash'),
      system: contextPrompt,
      messages: history,
      tools,
      maxSteps: 5,
    });

    // DEBUG: Log the full response structure
    console.log('[Chatbot] Response text:', JSON.stringify(result.text?.substring(0, 100)));
    console.log('[Chatbot] Steps count:', result.steps?.length);
    if (result.steps) {
      for (let i = 0; i < result.steps.length; i++) {
        const step = result.steps[i];
        console.log(`[Chatbot] Step ${i}: toolCalls=${step.toolCalls?.length || 0}, toolResults=${step.toolResults?.length || 0}`);
        if (step.toolCalls) {
          for (const tc of step.toolCalls) {
            console.log('  [ToolCall FULL]', JSON.stringify(tc, null, 2));
          }
        }
        if (step.toolResults) {
          for (const tr of step.toolResults) {
            console.log('  [ToolResult FULL]', JSON.stringify(tr, null, 2)?.substring(0, 800));
          }
        }
        // Check for other possible properties
        console.log(`  [Step keys] ${Object.keys(step).join(', ')}`);
      }
    }

    // 5. Save assistant response and tool interactions
    // Save any tool call/result messages from steps
    if (result.steps) {
      for (const step of result.steps) {
        if (step.toolCalls && step.toolCalls.length > 0) {
          for (const tc of step.toolCalls) {
            await prisma.chatMessage.create({
              data: {
                conversationId,
                role: 'assistant',
                content: `[Tool call: ${tc.toolName}]`,
                toolName: tc.toolName,
                toolArgs: JSON.stringify(tc.input || tc.args),
              },
            });
          }
        }
        if (step.toolResults && step.toolResults.length > 0) {
          for (const tr of step.toolResults) {
            await prisma.chatMessage.create({
              data: {
                conversationId,
                role: 'tool',
                content: JSON.stringify(tr.output || tr.result) || '{}',
                toolName: tr.toolName,
              },
            });
          }
        }
      }
    }

    // Save final text response
    const assistantText = result.text || '';
    if (assistantText) {
      await prisma.chatMessage.create({
        data: {
          conversationId,
          role: 'assistant',
          content: assistantText,
        },
      });
    }

    // 6. Collect all tool results for frontend rendering
    const toolResults = [];
    if (result.steps) {
      for (const step of result.steps) {
        if (step.toolResults) {
          for (const tr of step.toolResults) {
            toolResults.push({
              toolName: tr.toolName,
              result: tr.output || tr.result,
            });
          }
        }
      }
    }

    console.log('[Chatbot] Final: text length:', assistantText.length, 'toolResults:', toolResults.length);

    return {
      text: assistantText,
      toolResults,
    };
  }

  async getOrCreateConversation(userId, empresaId) {
    // Look for active conversation
    const existing = await prisma.chatConversation.findFirst({
      where: { userId, status: 'active' },
      orderBy: { updatedAt: 'desc' },
    });

    if (existing) return existing;

    // Create new conversation
    return prisma.chatConversation.create({
      data: { userId, empresaId },
    });
  }

  async getHistory(conversationId, limit = 50) {
    const messages = await prisma.chatMessage.findMany({
      where: { conversationId },
      orderBy: { createdAt: 'asc' },
      take: limit,
    });

    // Build history for AI SDK including tool context
    // Merge tool call + result into assistant messages so the model remembers what it did
    const history = [];
    for (const m of messages) {
      if (m.role === 'user') {
        history.push({ role: 'user', content: m.content });
      } else if (m.role === 'assistant' && m.toolName) {
        // Tool call — summarize it so the model knows what it called
        const args = m.toolArgs || '{}';
        history.push({
          role: 'assistant',
          content: `[Llamé a la herramienta ${m.toolName} con parámetros: ${args}]`,
        });
      } else if (m.role === 'tool') {
        // Tool result — include the result so the model knows what it got back
        history.push({
          role: 'assistant',
          content: `[Resultado de ${m.toolName}: ${m.content}]`,
        });
      } else if (m.role === 'assistant') {
        history.push({ role: 'assistant', content: m.content });
      }
    }

    // Merge consecutive assistant messages (AI SDK doesn't allow them)
    const merged = [];
    for (const msg of history) {
      if (merged.length > 0 && merged[merged.length - 1].role === msg.role) {
        merged[merged.length - 1].content += '\n' + msg.content;
      } else {
        merged.push({ ...msg });
      }
    }

    return merged;
  }

  async closeConversation(conversationId) {
    await prisma.chatConversation.update({
      where: { id: conversationId },
      data: { status: 'closed' },
    });
  }

  async handoff(conversationId) {
    await prisma.chatConversation.update({
      where: { id: conversationId },
      data: { status: 'handed_off' },
    });
  }

  async getFullHistory(conversationId, limit = 50) {
    return prisma.chatMessage.findMany({
      where: { conversationId },
      orderBy: { createdAt: 'asc' },
      take: limit,
    });
  }

  async resolveEmpresaId(userId) {
    const mapping = await prisma.userEmpresa.findUnique({
      where: { userId },
    });
    return mapping?.empresaId || null;
  }
}

module.exports = new ChatbotService();
