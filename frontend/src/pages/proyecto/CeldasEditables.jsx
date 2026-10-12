import { useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { ChevronLeft, ChevronRight, CalendarDays } from 'lucide-react'
import { cn } from '@/lib/utils'
import { parseFecha, aDDMMYYYY } from '@/lib/fechas'

// Celdas de la tabla de comprobantes en modo edición. Sólo una puede estar
// abierta a la vez: el padre guarda cuál (`open`) y la cambia con `onOpen`.
// El menú va en un portal para que no lo recorte el overflow de la tabla.

const triggerClass =
  'flex items-center justify-between gap-1.5 w-full px-2 h-full min-h-[34px] bg-transparent hover:bg-primary/5 text-[12px] text-foreground transition-colors'

/** Posición del menú debajo del botón, calculada al abrir */
function usePopover(id, open, onOpen) {
  const btnRef = useRef(null)
  const [pos, setPos] = useState({ top: 0, left: 0 })

  const toggle = () => {
    if (!open && btnRef.current) {
      const rect = btnRef.current.getBoundingClientRect()
      setPos({ top: rect.bottom + 4, left: rect.left })
    }
    onOpen(open ? null : id)
  }

  return { btnRef, pos, toggle }
}

function Popover({ pos, onClose, className, style, children }) {
  return createPortal(
    <>
      <div style={{ position: 'fixed', inset: 0, zIndex: 100 }} onClick={onClose} />
      <div
        style={{ position: 'absolute', top: pos.top + window.scrollY, left: pos.left + window.scrollX, zIndex: 101, ...style }}
        className={cn('bg-popover border border-border rounded-lg shadow-lg', className)}
      >
        {children}
      </div>
    </>,
    document.body
  )
}

export function CellDropdown({ id, value, options, onChange, open, onOpen }) {
  const { btnRef, pos, toggle } = usePopover(id, open, onOpen)
  const label = options.find(o => o.v === value)?.l ?? '--'

  return (
    <div>
      <button ref={btnRef} type="button" onClick={toggle} className={triggerClass}>
        <span className="truncate">{label}</span>
        <span className="text-[9px] text-muted-foreground shrink-0">▼</span>
      </button>
      {open && (
        <Popover pos={pos} onClose={() => onOpen(null)} className="py-1" style={{ width: 'max-content', minWidth: '120px' }}>
          {options.map(({ v, l }) => (
            <button
              key={v}
              type="button"
              onClick={() => { onChange(v); onOpen(null) }}
              className={cn(
                'w-full block text-left px-3 py-1.5 text-[12px] whitespace-nowrap hover:bg-accent transition-colors',
                value === v ? 'text-foreground font-medium' : 'text-muted-foreground'
              )}
            >
              {l}
            </button>
          ))}
        </Popover>
      )}
    </div>
  )
}

/** Fecha en DD/MM/YYYY, con calendario que arranca el lunes */
export function CellDatePicker({ id, value, onChange, open, onOpen }) {
  const { btnRef, pos, toggle } = usePopover(id, open, onOpen)
  const selectedDate = parseFecha(value)

  const [viewDate, setViewDate] = useState(() => {
    const base = selectedDate || new Date()
    return new Date(base.getFullYear(), base.getMonth(), 1)
  })

  const handleOpen = () => {
    if (!open && selectedDate) setViewDate(new Date(selectedDate.getFullYear(), selectedDate.getMonth(), 1))
    toggle()
  }

  const year = viewDate.getFullYear()
  const month = viewDate.getMonth()

  const today = new Date()
  today.setHours(0, 0, 0, 0)

  const days = []
  const firstDow = new Date(year, month, 1).getDay()
  const startPad = firstDow === 0 ? 6 : firstDow - 1
  for (let i = startPad - 1; i >= 0; i--) days.push({ date: new Date(year, month, -i), current: false })
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  for (let d = 1; d <= daysInMonth; d++) days.push({ date: new Date(year, month, d), current: true })
  while (days.length % 7 !== 0) days.push({ date: new Date(year, month + 1, days.length - daysInMonth - startPad + 1), current: false })

  const handleDay = (date) => {
    onChange(aDDMMYYYY(date))
    onOpen(null)
  }

  const monthLabel = new Intl.DateTimeFormat('es-UY', { month: 'long', year: 'numeric' }).format(viewDate)

  return (
    <div>
      <button ref={btnRef} type="button" onClick={handleOpen} className={triggerClass}>
        <span className="truncate">{value || '--'}</span>
        <CalendarDays size={11} className="text-muted-foreground/60 shrink-0" />
      </button>

      {open && (
        <Popover pos={pos} onClose={() => onOpen(null)} className="p-3 w-60">
          <div className="flex items-center justify-between mb-2.5">
            <button
              type="button"
              onClick={() => setViewDate(new Date(year, month - 1, 1))}
              aria-label="Mes anterior"
              className="p-1 rounded-md hover:bg-accent text-muted-foreground hover:text-foreground transition-colors"
            >
              <ChevronLeft size={13} />
            </button>
            <span className="text-[12px] font-medium text-foreground capitalize">{monthLabel}</span>
            <button
              type="button"
              onClick={() => setViewDate(new Date(year, month + 1, 1))}
              aria-label="Mes siguiente"
              className="p-1 rounded-md hover:bg-accent text-muted-foreground hover:text-foreground transition-colors"
            >
              <ChevronRight size={13} />
            </button>
          </div>

          <div className="grid grid-cols-7 mb-1">
            {['L', 'M', 'X', 'J', 'V', 'S', 'D'].map(d => (
              <div key={d} className="text-center text-[10px] font-medium text-muted-foreground/40 py-0.5">{d}</div>
            ))}
          </div>

          <div className="grid grid-cols-7 gap-y-0.5">
            {days.map(({ date, current }, i) => {
              const isSel = selectedDate && date.toDateString() === selectedDate.toDateString()
              const isToday = date.toDateString() === today.toDateString()
              return (
                <button
                  key={i}
                  type="button"
                  onClick={() => handleDay(date)}
                  className={cn(
                    'text-center text-[12px] py-1 rounded-md transition-colors',
                    isSel
                      ? 'bg-primary text-primary-foreground font-medium'
                      : isToday
                        ? 'border border-primary/30 text-primary font-medium hover:bg-accent'
                        : current
                          ? 'text-foreground hover:bg-accent'
                          : 'text-muted-foreground/25 hover:bg-accent/40',
                  )}
                >
                  {date.getDate()}
                </button>
              )
            })}
          </div>

          <div className="mt-2 pt-2 border-t border-border flex justify-between items-center">
            <button
              type="button"
              onClick={() => { onChange(''); onOpen(null) }}
              className="text-[11px] text-muted-foreground hover:text-foreground transition-colors"
            >
              Borrar
            </button>
            <button
              type="button"
              onClick={() => handleDay(today)}
              className="text-[11px] text-primary hover:text-primary/70 transition-colors font-medium"
            >
              Hoy
            </button>
          </div>
        </Popover>
      )}
    </div>
  )
}
