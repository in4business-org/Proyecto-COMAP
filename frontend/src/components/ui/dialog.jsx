import { useEffect, useRef } from 'react'
import { cn } from '@/lib/utils'
import { X } from 'lucide-react'

function useFocusTrap(containerRef, active) {
  useEffect(() => {
    if (!active || !containerRef.current) return
    const el = containerRef.current
    const focusable = el.querySelectorAll(
      'a[href], button:not([disabled]), textarea, input, select, [tabindex]:not([tabindex="-1"])'
    )
    const first = focusable[0]
    const last = focusable[focusable.length - 1]
    first?.focus()
    const handleKeyDown = (e) => {
      if (e.key !== 'Tab') return
      if (focusable.length === 0) { e.preventDefault(); return }
      if (e.shiftKey) {
        if (document.activeElement === first) { e.preventDefault(); last?.focus() }
      } else {
        if (document.activeElement === last) { e.preventDefault(); first?.focus() }
      }
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [active, containerRef])
}

export function Dialog({ open, onClose, children }) {
  const contentRef = useRef(null)

  useFocusTrap(contentRef, open)

  useEffect(() => {
    const handleEsc = (e) => { if (e.key === 'Escape') onClose() }
    if (open) document.addEventListener('keydown', handleEsc)
    return () => document.removeEventListener('keydown', handleEsc)
  }, [open, onClose])

  useEffect(() => {
    if (open) {
      document.body.style.overflow = 'hidden'
      return () => { document.body.style.overflow = '' }
    }
  }, [open])

  if (!open) return null

  return (
    <div
      className="fixed inset-0 z-60 flex items-center justify-center"
      role="dialog"
      aria-modal="true"
    >
      <div aria-hidden="true" className="fixed inset-0 bg-background" onClick={onClose} />
      <div ref={contentRef} className="relative z-10 w-full max-w-lg mx-4 animate-scale-in">
        {children}
      </div>
    </div>
  )
}

export function DialogContent({ className, children, onClose, ...props }) {
  return (
    <div className={cn('rounded-xl ring-1 ring-border bg-card p-6 shadow-lg shadow-black/20', className)} {...props}>
      {onClose && (
        <button
          onClick={onClose}
          aria-label="Cerrar"
          className="absolute right-4 top-4 rounded-md p-1 text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
        >
          <X size={16} aria-hidden="true" />
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
