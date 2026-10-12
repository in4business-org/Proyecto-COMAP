import { useState } from 'react'
import { Check } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { LoadingState, Spinner } from '@/components/ui/loading'
import { cn } from '@/lib/utils'
import { fmtMonto } from '@/lib/inversion'
import { columnaDeComprobante } from './plan'

/**
 * Tablero del plan de ejecución: se arrastran presupuestos entre años.
 * `onMover(id, anio)` cambia la fecha de ejecución en memoria; `onGuardar`
 * la persiste.
 */
export function PlanEjecucion({
  comprobantes, cargando, columnas, anioBase, periodoLabel,
  puedeEditar, pendiente, guardando, onMover, onGuardar,
}) {
  const [dragOverCol, setDragOverCol] = useState(null)

  const handleDrop = (e, colKey) => {
    e.preventDefault()
    setDragOverCol(null)
    if (colKey === 'antes') return
    const itemId = e.dataTransfer.getData('text/plain')
    if (itemId) onMover(itemId, colKey)
  }

  return (
    <div className="bg-card/30 border border-border/50 rounded-xl p-5 shadow-sm">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
          Plan de ejecución · <span className="normal-case font-normal">{periodoLabel}</span>
        </h2>
        {(pendiente || guardando) && puedeEditar && (
          <Button onClick={onGuardar} disabled={guardando} size="sm" className="h-[28px] text-[11px] gap-1.5">
            {guardando ? <><Spinner size={12} /> Guardando...</> : <><Check size={13} /> Guardar plan</>}
          </Button>
        )}
      </div>
      {cargando ? (
        <LoadingState message="Cargando..." />
      ) : (
        <div className="flex gap-3 overflow-x-auto pb-2">
          {columnas.map(col => {
            const items = (comprobantes || []).filter(r => columnaDeComprobante(r, columnas, anioBase) === col.key)
            const isOver = dragOverCol === col.key && !col.locked
            return (
              <div
                key={col.key}
                className={cn(
                  'flex flex-col rounded-lg border transition-colors',
                  'min-w-[210px] w-[210px]',
                  isOver ? 'border-primary/60 bg-primary/5' : 'border-border/50 bg-muted/10'
                )}
                onDragOver={(e) => { e.preventDefault(); if (!col.locked) setDragOverCol(col.key) }}
                onDragLeave={() => setDragOverCol(null)}
                onDrop={(e) => handleDrop(e, col.key)}
              >
                <div className="px-3 py-2.5 border-b border-border/40">
                  <p className="text-[12px] font-semibold text-foreground">{col.label}</p>
                  {col.sub && <p className="text-[10px] text-muted-foreground/70 mt-0.5">{col.sub}</p>}
                  <p className="text-[10px] text-muted-foreground/50 mt-1">{items.length} item{items.length !== 1 ? 's' : ''}</p>
                </div>
                <div className="flex flex-col gap-2 p-2 flex-1 min-h-[140px]">
                  {items.map(item => {
                    const isFactura = item.tipo_comprobante === 'Factura'
                    return (
                      <div
                        key={item.id}
                        draggable={!isFactura}
                        onDragStart={(e) => e.dataTransfer.setData('text/plain', item.id)}
                        className={cn(
                          'rounded-md border p-2.5 text-[11px] space-y-1 select-none',
                          isFactura
                            ? 'border-border/30 bg-card/50 opacity-60 cursor-default'
                            : 'border-border/50 bg-card cursor-grab active:cursor-grabbing hover:border-primary/50 hover:shadow-sm transition-all'
                        )}
                      >
                        <div className="flex items-center justify-between gap-1">
                          <Badge className={cn(
                            'text-[9px] h-4 px-1.5 border-transparent font-medium',
                            isFactura ? 'bg-primary/15 text-primary' : 'bg-warning/15 text-warning'
                          )}>
                            {item.tipo_comprobante || 'Sin tipo'}
                          </Badge>
                          {isFactura && <span className="text-[10px] text-muted-foreground/50" title="Bloqueada">⬤</span>}
                        </div>
                        <p className="font-medium text-foreground truncate" title={item.proveedor}>{item.proveedor || '(sin proveedor)'}</p>
                        {item.monto != null && (
                          <p className="text-muted-foreground">{item.moneda} {fmtMonto(item.monto)}</p>
                        )}
                        {item.categoria && <p className="text-muted-foreground/60 truncate">{item.categoria}</p>}
                      </div>
                    )
                  })}
                  {!col.locked && items.length === 0 && (
                    <div className="flex-1 flex items-center justify-center rounded-md border border-dashed border-border/30 min-h-[80px]">
                      <p className="text-[11px] text-muted-foreground/40 text-center px-2">Arrastrá presupuestos acá</p>
                    </div>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
