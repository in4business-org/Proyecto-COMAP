import { useEffect, useRef, useState } from 'react'
import { cn } from '@/lib/utils'

/**
 * Menú desplegable simple para acciones secundarias ("Más ⋯").
 * `trigger` recibe { abierto, props } y tiene que esparcir `props` en un botón.
 * Cierra con Escape, con un clic afuera o al elegir una opción.
 */
export function Menu({ trigger, children, align = 'end', className }) {
  const [abierto, setAbierto] = useState(false)
  const ref = useRef(null)

  useEffect(() => {
    if (!abierto) return
    const afuera = (e) => { if (!ref.current?.contains(e.target)) setAbierto(false) }
    const esc = (e) => { if (e.key === 'Escape') setAbierto(false) }
    document.addEventListener('mousedown', afuera)
    document.addEventListener('keydown', esc)
    // Foco en la primera opción para poder seguir con el teclado
    ref.current?.querySelector('[role="menuitem"]')?.focus()
    return () => {
      document.removeEventListener('mousedown', afuera)
      document.removeEventListener('keydown', esc)
    }
  }, [abierto])

  const moverFoco = (e) => {
    if (!['ArrowDown', 'ArrowUp'].includes(e.key)) return
    e.preventDefault()
    const items = [...ref.current.querySelectorAll('[role="menuitem"]')]
    const i = items.indexOf(document.activeElement)
    items[(i + (e.key === 'ArrowDown' ? 1 : -1) + items.length) % items.length]?.focus()
  }

  return (
    <div ref={ref} className="relative">
      {trigger({
        abierto,
        props: { 'aria-haspopup': 'menu', 'aria-expanded': abierto, onClick: () => setAbierto((a) => !a) },
      })}
      {abierto && (
        <div
          role="menu"
          onKeyDown={moverFoco}
          onClick={() => setAbierto(false)}
          className={cn(
            'absolute top-full z-40 mt-1.5 min-w-52 rounded-lg border border-border bg-popover p-1 shadow-lg animate-fade-in',
            align === 'end' ? 'right-0' : 'left-0',
            className
          )}
        >
          {children}
        </div>
      )}
    </div>
  )
}

export function MenuItem({ className, destructive, children, ...props }) {
  return (
    <button
      type="button"
      role="menuitem"
      className={cn(
        'flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-sm transition-colors cursor-pointer focus-visible:outline-none',
        destructive ? 'text-destructive hover:bg-destructive/10 focus-visible:bg-destructive/10' : 'hover:bg-accent focus-visible:bg-accent',
        className
      )}
      {...props}
    >
      {children}
    </button>
  )
}

export function MenuSeparador() {
  return <div role="separator" className="my-1 h-px bg-border" />
}
