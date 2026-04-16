import { useState, useRef } from 'react'
import { Send, Paperclip, X } from 'lucide-react'
import { cn } from '@/lib/utils'

export function ChatInput({ onSend, disabled }) {
  const [text, setText] = useState('')
  const [files, setFiles] = useState([])
  const fileRef = useRef(null)
  const textareaRef = useRef(null)

  const handleSend = () => {
    const trimmed = text.trim()
    if (!trimmed && files.length === 0) return
    onSend(trimmed, files)
    setText('')
    setFiles([])
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto'
    }
  }

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  const handleFileChange = (e) => {
    const selected = Array.from(e.target.files || [])
    setFiles(prev => [...prev, ...selected])
    if (fileRef.current) fileRef.current.value = ''
  }

  const removeFile = (index) => {
    setFiles(prev => prev.filter((_, i) => i !== index))
  }

  const handleInput = (e) => {
    const el = e.target
    el.style.height = 'auto'
    el.style.height = Math.min(el.scrollHeight, 120) + 'px'
  }

  return (
    <div className="border-t border-border bg-card p-3">
      {files.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-2">
          {files.map((f, i) => (
            <div key={i} className="flex items-center gap-1.5 bg-accent rounded-md px-2 py-1 text-xs">
              <Paperclip size={12} className="text-muted-foreground" />
              <span className="truncate max-w-[120px]">{f.name}</span>
              <button onClick={() => removeFile(i)} className="text-muted-foreground hover:text-foreground cursor-pointer">
                <X size={12} />
              </button>
            </div>
          ))}
        </div>
      )}
      <div className="flex items-end gap-2">
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          disabled={disabled}
          className="p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-accent transition-colors cursor-pointer disabled:opacity-50"
          title="Adjuntar archivo"
        >
          <Paperclip size={18} />
        </button>
        <input
          ref={fileRef}
          type="file"
          multiple
          className="hidden"
          onChange={handleFileChange}
          accept=".pdf,.jpg,.jpeg,.png,.xlsx,.xls,.doc,.docx"
        />
        <textarea
          ref={textareaRef}
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={handleKeyDown}
          onInput={handleInput}
          disabled={disabled}
          placeholder="Escribí tu mensaje..."
          rows={1}
          className={cn(
            'flex-1 resize-none bg-background border border-border rounded-xl px-4 py-2.5 text-sm',
            'placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 focus:ring-offset-background',
            'disabled:opacity-50',
          )}
        />
        <button
          type="button"
          onClick={handleSend}
          disabled={disabled || (!text.trim() && files.length === 0)}
          className={cn(
            'p-2.5 rounded-xl transition-colors cursor-pointer',
            'bg-primary text-primary-foreground hover:bg-primary/90',
            'disabled:opacity-50 disabled:cursor-not-allowed',
          )}
          title="Enviar"
        >
          <Send size={16} />
        </button>
      </div>
    </div>
  )
}
