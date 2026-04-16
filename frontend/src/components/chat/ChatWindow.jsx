import { useRef, useEffect } from 'react'
import { ChatMessage } from './ChatMessage'
import { ChatInput } from './ChatInput'
import { Loader2, Bot } from 'lucide-react'

export function ChatWindow({ messages, onSend, loading, status }) {
  const bottomRef = useRef(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, loading])

  const isHandedOff = status === 'handed_off'

  return (
    <div className="flex flex-col h-full">
      {/* Messages area */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
        {messages.length === 0 && !loading && (
          <div className="flex flex-col items-center justify-center h-full text-center">
            <div className="w-12 h-12 rounded-full bg-accent border border-border flex items-center justify-center mb-3">
              <Bot size={24} className="text-primary" />
            </div>
            <h3 className="text-base font-semibold text-foreground mb-1">Asistente COMAP</h3>
            <p className="text-sm text-muted-foreground max-w-sm">
              Hola, soy tu asistente virtual. Puedo ayudarte a consultar tus proyectos, ver el checklist documental, revisar facturas y más.
            </p>
          </div>
        )}

        {messages.map((msg) => (
          <ChatMessage key={msg.id} message={msg} />
        ))}

        {loading && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground mr-auto">
            <div className="w-7 h-7 rounded-full bg-accent border border-border flex items-center justify-center">
              <Bot size={14} />
            </div>
            <div className="flex items-center gap-2 bg-card border border-border rounded-2xl rounded-bl-md px-4 py-2.5">
              <Loader2 size={14} className="animate-spin" />
              <span>Escribiendo...</span>
            </div>
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      {/* Handed off banner */}
      {isHandedOff && (
        <div className="px-4 py-2 bg-warning/10 border-t border-warning/20 text-center">
          <p className="text-sm text-warning">
            Esta conversación fue derivada a un gestor humano. Iniciá una nueva conversación para seguir chateando con el bot.
          </p>
        </div>
      )}

      {/* Input */}
      <ChatInput onSend={onSend} disabled={loading || isHandedOff} />
    </div>
  )
}
