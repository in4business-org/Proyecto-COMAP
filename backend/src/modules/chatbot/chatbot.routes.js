const { Router } = require('express');
const multer = require('multer');
const chatbotService = require('./chatbot.service');
const supabaseService = require('../../config/supabase.config');

const prisma = require('../../config/prisma');

const router = Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 15 * 1024 * 1024 } });

// POST /api/chatbot/message — Send message and get bot response
router.post('/message', upload.array('files', 5), async (req, res) => {
  try {
    const userId = req.user.id;
    const empresaId = await chatbotService.resolveEmpresaId(userId);

    const conversation = await chatbotService.getOrCreateConversation(userId, empresaId);

    if (conversation.status === 'handed_off') {
      return res.json({
        text: 'Tu conversación fue derivada a un gestor humano. Estamos esperando su respuesta. Si querés iniciar una nueva conversación, usá el botón "Nueva conversación".',
        toolResults: [],
        conversationId: conversation.id,
        status: conversation.status,
      });
    }

    const message = req.body.message || '';
    if (!message.trim()) {
      return res.status(400).json({ error: 'El mensaje no puede estar vacío' });
    }

    // Handle file attachments
    const attachments = [];
    if (req.files && req.files.length > 0) {
      for (const file of req.files) {
        const path = `chatbot/${userId}/${conversation.id}/${Date.now()}_${file.originalname}`;
        await supabaseService.uploadFile(path, file.buffer, file.mimetype);
        attachments.push(path);
      }
    }

    const result = await chatbotService.processMessage(
      conversation.id,
      userId,
      empresaId,
      message,
      attachments,
    );

    res.json({
      ...result,
      conversationId: conversation.id,
      status: conversation.status,
    });
  } catch (e) {
    console.error('[Chatbot] Error:', e);
    res.status(500).json({ error: 'Error al procesar el mensaje. Intentá de nuevo.' });
  }
});

// GET /api/chatbot/history — Get conversation history
router.get('/history', async (req, res) => {
  try {
    const userId = req.user.id;
    const empresaId = await chatbotService.resolveEmpresaId(userId);
    const conversation = await chatbotService.getOrCreateConversation(userId, empresaId);
    const messages = await chatbotService.getFullHistory(conversation.id);

    res.json({
      conversationId: conversation.id,
      status: conversation.status,
      messages: messages.map(m => ({
        id: m.id,
        role: m.role,
        content: m.content,
        toolName: m.toolName,
        toolArgs: m.toolArgs,
        attachments: m.attachments ? JSON.parse(m.attachments) : null,
        createdAt: m.createdAt,
      })),
    });
  } catch (e) {
    console.error('[Chatbot] History error:', e);
    res.status(500).json({ error: 'Error al cargar el historial' });
  }
});

// POST /api/chatbot/handoff — Force handoff to human
router.post('/handoff', async (req, res) => {
  try {
    const userId = req.user.id;
    const empresaId = await chatbotService.resolveEmpresaId(userId);
    const conversation = await chatbotService.getOrCreateConversation(userId, empresaId);
    await chatbotService.handoff(conversation.id);
    res.json({ ok: true, status: 'handed_off' });
  } catch (e) {
    res.status(500).json({ error: 'Error al derivar la conversación' });
  }
});

// POST /api/chatbot/new — Start new conversation
router.post('/new', async (req, res) => {
  try {
    const userId = req.user.id;
    const empresaId = await chatbotService.resolveEmpresaId(userId);

    // Close current active conversation
    const current = await chatbotService.getOrCreateConversation(userId, empresaId);
    if (current) {
      await chatbotService.closeConversation(current.id);
    }

    // Create fresh conversation
    const conversation = await prisma.chatConversation.create({
      data: { userId, empresaId },
    });

    res.json({
      conversationId: conversation.id,
      status: conversation.status,
      messages: [],
    });
  } catch (e) {
    console.error('[Chatbot] New conversation error:', e);
    res.status(500).json({ error: 'Error al crear nueva conversación' });
  }
});

module.exports = router;
