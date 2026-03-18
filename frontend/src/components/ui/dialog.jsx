import { useEffect, useRef, useState } from 'react'
import { cn } from '@/lib/utils'
import { X } from 'lucide-react'
import { Button } from './button'

export function Dialog({ open, onClose, children }) {
  const overlayRef = useRef(null)

  useEffect(() => {
    const handleEsc = (e) => { if (e.key === 'Escape') onClose() }
    if (open) document.addEventListener('keydown', handleEsc)
    return () => document.removeEventListener('keydown', handleEsc)
  }, [open, onClose])

  if (!open) return null

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center">
      <div ref={overlayRef} className="fixed inset-0 bg-background" onClick={onClose} />
      <div className="relative z-10 w-full max-w-lg mx-4 animate-scale-in">
        {children}
      </div>
    </div>
  )
}

export function DialogContent({ className, children, onClose, ...props }) {
  return (
    <div className={cn('rounded-xl ring-1 ring-border bg-card p-6 shadow-lg shadow-black/20', className)} {...props}>
      {onClose && (
        <button onClick={onClose} className="absolute right-4 top-4 rounded-md p-1 text-muted-foreground hover:text-foreground transition-colors cursor-pointer">
          <X size={16} />
        </button>
      )}
      {children}
    </div>
  )
}

export function DialogHeader({ className, children, ...props }) {
  return <div className={cn('mb-6 space-y-2', className)} {...props}>{children}</div>
}

export function DialogTitle({ className, children, ...props }) {
  return <h2 className={cn('text-lg font-semibold', className)} {...props}>{children}</h2>
}

export function DialogDescription({ className, children, ...props }) {
  return <p className={cn('text-sm text-muted-foreground', className)} {...props}>{children}</p>
}

export function DialogFooter({ className, children, ...props }) {
  return <div className={cn('mt-6 flex justify-end gap-3', className)} {...props}>{children}</div>
}
