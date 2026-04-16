import { useState, useEffect, useCallback } from 'react'
import { ChatWindow } from '../components/chat/ChatWindow'
import { chatbot } from '../lib/api'
import { MessageSquarePlus } from 'lucide-react'

export default function Agente() {
  const [messages, setMessages] = useState([])
  const [loading, setLoading] = useState(false)
  const [status, setStatus] = useState('active')
  const [initialLoading, setInitialLoading] = useState(true)

  // Load history on mount
  useEffect(() => {
    chatbot.getHistory()
      .then(data => {
        setMessages(data.messages || [])
        setStatus(data.status || 'active')
      })
      .catch(console.error)
      .finally(() => setInitialLoading(false))
  }, [])

  const handleSend = useCallback(async (text, files = []) => {
    // Optimistic user message
    const tempId = `temp-${Date.now()}`
    const userMsg = {
      id: tempId,
      role: 'user',
      content: text,
      createdAt: new Date().toISOString(),
      attachments: files.map(f => f.name),
    }
    setMessages(prev => [...prev, userMsg])
    setLoading(true)

    try {
      const response = await chatbot.sendMessage(text, files)
      setStatus(response.status || 'active')

      // Build response messages
      const newMessages = []

      // Add tool results as inline messages
      if (response.toolResults?.length > 0) {
        for (const tr of response.toolResults) {
          newMessages.push({
            id: `tool-${Date.now()}-${Math.random()}`,
            role: 'tool',
            content: typeof tr.result === 'string' ? tr.result : (JSON.stringify(tr.result) ?? '{}'),
            toolName: tr.toolName,
            createdAt: new Date().toISOString(),
          })
        }
      }

      // Add assistant text
      if (response.text) {
        newMessages.push({
          id: `assistant-${Date.now()}`,
          role: 'assistant',
          content: response.text,
          createdAt: new Date().toISOString(),
        })
      }

      setMessages(prev => [...prev, ...newMessages])
    } catch (err) {
      setMessages(prev => [...prev, {
        id: `error-${Date.now()}`,
        role: 'assistant',
        content: `Error: ${err.message}. Intentá de nuevo.`,
        createdAt: new Date().toISOString(),
      }])
    } finally {
      setLoading(false)
    }
  }, [])

  const handleNewConversation = async () => {
    try {
      const data = await chatbot.newConversation()
      setMessages(data.messages || [])
      setStatus(data.status || 'active')
    } catch (err) {
      console.error('Error creating new conversation:', err)
    }
  }

  if (initialLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div className="flex flex-col h-[calc(100vh-3.5rem)]">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-card shrink-0">
        <div>
          <h1 className="text-base font-semibold text-foreground">Asistente COMAP</h1>
          <p className="text-xs text-muted-foreground">Gestión de proyectos de inversión</p>
        </div>
        <button
          onClick={handleNewConversation}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-accent hover:bg-accent/80 text-foreground transition-colors cursor-pointer"
        >
          <MessageSquarePlus size={14} />
          Nueva conversación
        </button>
      </div>

      {/* Chat */}
      <ChatWindow
        messages={messages}
        onSend={handleSend}
        loading={loading}
        status={status}
      />
    </div>
  )
}
