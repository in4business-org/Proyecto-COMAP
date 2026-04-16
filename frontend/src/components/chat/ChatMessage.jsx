import { cn } from '@/lib/utils'
import { Bot, User } from 'lucide-react'
import { ChatToolResult } from './ChatToolResult'

function formatTime(dateStr) {
  const d = new Date(dateStr)
  return d.toLocaleTimeString('es-UY', { hour: '2-digit', minute: '2-digit' })
}

export function ChatMessage({ message }) {
  const { role, content, toolName, createdAt } = message

  // Tool result messages render as inline cards
  if (role === 'tool') {
    return <ChatToolResult toolName={toolName} result={content} />
  }

  // Skip assistant tool-call markers
  if (role === 'assistant' && toolName) return null

  const isUser = role === 'user'

  return (
    <div className={cn('flex gap-2.5 max-w-[85%]', isUser ? 'ml-auto flex-row-reverse' : 'mr-auto')}>
      <div className={cn(
        'w-7 h-7 rounded-full flex items-center justify-center shrink-0 mt-0.5',
        isUser ? 'bg-primary text-primary-foreground' : 'bg-accent border border-border',
      )}>
        {isUser ? <User size={14} /> : <Bot size={14} />}
      </div>
      <div className={cn(
        'rounded-2xl px-4 py-2.5 text-sm leading-relaxed',
        isUser
          ? 'bg-primary text-primary-foreground rounded-br-md'
          : 'bg-card border border-border text-card-foreground rounded-bl-md',
      )}>
        <p className="whitespace-pre-wrap">{content}</p>
        {createdAt && (
          <p className={cn(
            'text-[10px] mt-1.5',
            isUser ? 'text-primary-foreground/60' : 'text-muted-foreground/50',
          )}>
            {formatTime(createdAt)}
          </p>
        )}
      </div>
    </div>
  )
}
