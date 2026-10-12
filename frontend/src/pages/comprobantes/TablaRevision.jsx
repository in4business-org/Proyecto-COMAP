import { AlertTriangle, ArrowDown, ArrowUp, ArrowUpDown, FileCheck2, FileX2 } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import { aUI, fmtMonto, fmtUI } from '@/lib/inversion'
import { ESTADOS } from '@/lib/revision'

function Encabezado({ campo, children, orden, onOrden, className }) {
  if (!campo) {
    return <th scope="col" className={cn('px-3 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wider text-muted-foreground', className)}>{children}</th>
  }
  const activo = orden.campo === campo
  const Icono = !activo ? ArrowUpDown : orden.dir === 'asc' ? ArrowUp : ArrowDown
  return (
    <th scope="col" aria-sort={activo ? (orden.dir === 'asc' ? 'ascending' : 'descending') : 'none'} className={cn('px-3 py-2.5 text-left', className)}>
      <button
        type="button"
        onClick={() => onOrden(campo)}
        className={cn(
          'inline-flex items-center gap-1 text-[11px] font-semibold uppercase tracking-wider cursor-pointer hover:text-foreground',
          activo ? 'text-foreground' : 'text-muted-foreground'
        )}
      >
        {children}
        <Icono size={12} aria-hidden="true" className={activo ? '' : 'opacity-50'} />
      </button>
    </th>
  )
}

/**
 * Tabla de comprobantes revisados (ver lib/revision): estado, problema en
 * palabras, casillas para editar en lote y clic para ver el detalle.
 */
export function TablaRevision({
  filas, seleccion, onToggle, onToggleTodos, abiertoId, onAbrir, orden, onOrden, cotizacion, puedeEditar,
}) {
  const todos = filas.length > 0 && filas.every((f) => seleccion.has(f.id))
  const algunos = filas.some((f) => seleccion.has(f.id))

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-[13px]">
        <thead className="border-b border-border bg-muted/40">
          <tr>
            {puedeEditar && (
              <th scope="col" className="w-10 pl-4 pr-1 py-2.5">
                <input
                  type="checkbox"
                  aria-label="Seleccionar todos los que se ven"
                  checked={todos}
                  ref={(el) => { if (el) el.indeterminate = algunos && !todos }}
                  onChange={onToggleTodos}
                  className="size-4 cursor-pointer accent-primary"
                />
              </th>
            )}
            <Encabezado campo="estado" orden={orden} onOrden={onOrden} className="hidden sm:table-cell">Estado</Encabezado>
            <Encabezado campo="proveedor" orden={orden} onOrden={onOrden}>Proveedor</Encabezado>
            <Encabezado className="hidden md:table-cell">Comprobante</Encabezado>
            <Encabezado campo="fecha" orden={orden} onOrden={onOrden} className="hidden sm:table-cell">Fecha</Encabezado>
            <Encabezado campo="monto" orden={orden} onOrden={onOrden} className="text-right [&>button]:flex-row-reverse">Monto</Encabezado>
            <Encabezado className="hidden lg:table-cell">Categoría</Encabezado>
            <Encabezado className="hidden sm:table-cell w-16">PDF</Encabezado>
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {filas.map((f) => {
            const estado = ESTADOS[f.estado]
            const abierto = f.id === abiertoId
            const problema = f.problemas.find((p) => p.tipo !== 'archivo') || f.problemas[0]
            const ui = aUI(f.monto, f.moneda, cotizacion)
            return (
              <tr
                key={f.id}
                onClick={() => onAbrir(f.id)}
                className={cn(
                  'cursor-pointer align-top transition-colors',
                  abierto ? 'bg-accent shadow-[inset_3px_0_0_var(--primary)]' : 'hover:bg-accent/50'
                )}
              >
                {puedeEditar && (
                  <td className="pl-4 pr-1 py-3" onClick={(e) => e.stopPropagation()}>
                    <input
                      type="checkbox"
                      aria-label={`Seleccionar ${f.proveedor || 'comprobante'} ${f.numero_factura || ''}`}
                      checked={seleccion.has(f.id)}
                      onChange={() => onToggle(f.id)}
                      className="size-4 cursor-pointer accent-primary"
                    />
                  </td>
                )}
                <td className="px-3 py-3 hidden sm:table-cell">
                  <Badge variant={estado.variant} className="whitespace-nowrap">{estado.label}</Badge>
                </td>
                <td className="px-3 py-3 min-w-[150px] max-w-[260px]">
                  <Badge variant={estado.variant} className="mb-1 sm:hidden">{estado.label}</Badge>
                  <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); onAbrir(f.id) }}
                    className="text-left font-medium hover:underline cursor-pointer"
                  >
                    {f.proveedor || 'Sin proveedor'}
                  </button>
                  {problema && (
                    <p className={cn('mt-1 flex items-start gap-1 text-[12px] leading-snug', f.estado === 'revisar' ? 'text-warning' : 'text-destructive')}>
                      <AlertTriangle size={12} className="mt-0.5 shrink-0" aria-hidden="true" />
                      <span>
                        {problema.texto}
                        {f.problemas.length > 1 && ` (+${f.problemas.length - 1})`}
                      </span>
                    </p>
                  )}
                  <p className="mt-0.5 text-[12px] text-muted-foreground md:hidden">
                    {[f.numero_factura, f.fecha].filter(Boolean).join(' · ')}
                  </p>
                </td>
                <td className="px-3 py-3 hidden md:table-cell">
                  <span className="font-mono text-[12px]">{f.numero_factura || '--'}</span>
                  <span className="block text-[12px] text-muted-foreground">{f.tipo_comprobante || 'Sin tipo'}</span>
                </td>
                <td className="px-3 py-3 whitespace-nowrap hidden sm:table-cell">{f.fecha || '--'}</td>
                <td className="px-3 py-3 text-right whitespace-nowrap tabular-nums">
                  <span className={cn(Number(f.monto) === 0 && 'text-destructive')}>{f.moneda || ''} {fmtMonto(f.monto)}</span>
                  {ui != null && f.monto ? <span className="block text-[12px] text-muted-foreground">≈ {fmtUI(ui)}</span> : null}
                </td>
                <td className="px-3 py-3 hidden lg:table-cell text-muted-foreground">{f.categoria || 'Sin categoría'}</td>
                <td className="px-3 py-3 hidden sm:table-cell">
                  {f.archivo
                    ? <FileCheck2 size={16} className="text-success" aria-label="Tiene PDF" />
                    : <FileX2 size={16} className="text-destructive" aria-label="Falta el PDF" />}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
