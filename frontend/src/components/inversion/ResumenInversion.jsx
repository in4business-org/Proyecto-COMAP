import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LabelList } from 'recharts'
import { AlertTriangle } from 'lucide-react'
import { Card } from '@/components/ui/card'
import { cn } from '@/lib/utils'
import { fmtUI, fmtPct } from '@/lib/inversion'

const nf0 = new Intl.NumberFormat('es-UY', { maximumFractionDigits: 0 })
const plural = (n, s = 's') => (n !== 1 ? s : '')
const etiquetaTotal = (v) => (v ? nf0.format(Math.round(v)) : '')
const estiloEtiqueta = { fontSize: 11, fill: 'var(--muted-foreground)' }

const titulo = 'text-[11px] font-semibold uppercase tracking-widest text-muted-foreground'

function Tarjeta({ label, valor, sub, className }) {
  return (
    <Card className="p-4">
      <p className={titulo}>{label}</p>
      <p className={cn('text-2xl font-medium mt-1.5 tabular-nums', className)}>{valor}</p>
      {sub && <p className="text-[12px] text-muted-foreground mt-0.5">{sub}</p>}
    </Card>
  )
}

function Leyenda() {
  return (
    <div className="flex items-center gap-3 text-[11px] text-muted-foreground">
      <span className="flex items-center gap-1.5"><span className="size-2.5 rounded-sm bg-primary" />Factura</span>
      <span className="flex items-center gap-1.5"><span className="size-2.5 rounded-sm bg-warning" />Presupuesto</span>
    </div>
  )
}

/**
 * Resumen de la inversión de un período: totales, inversión por año de
 * ejecución y por categoría. `resumen` sale de calcularResumen.
 * `onCategoria(cat)` hace clickeable cada categoría.
 */
export function ResumenInversion({ resumen, onCategoria }) {
  if (!resumen) return null

  const porAnio = resumen.porAnio.map((d) => ({ ...d, total: d.factura + d.presupuesto }))
  const maxCat = resumen.porCategoria[0]?.ui || 1

  return (
    <div className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-3">
        <Tarjeta
          label="Inversión total"
          valor={fmtUI(resumen.totalUI)}
          sub={`${resumen.total} comprobante${plural(resumen.total)}`}
        />
        <Tarjeta
          label="Facturas"
          valor={fmtUI(resumen.facturaUI)}
          sub={`${fmtPct(resumen.facturaUI, resumen.totalUI)} del total · ya gastado`}
          className="text-primary"
        />
        <Tarjeta
          label="Presupuestos"
          valor={fmtUI(resumen.presupuestoUI)}
          sub={`${fmtPct(resumen.presupuestoUI, resumen.totalUI)} del total · a ejecutar`}
          className="text-warning"
        />
      </div>

      {resumen.sinTipoCount > 0 && (
        <p className="flex items-center gap-1.5 text-[12px] text-warning">
          <AlertTriangle size={13} aria-hidden="true" />
          {resumen.sinTipoCount} comprobante{plural(resumen.sinTipoCount)} sin decir si es factura o presupuesto ({fmtUI(resumen.sinTipoUI)}): suma{plural(resumen.sinTipoCount, 'n')} al total pero no a Facturas ni a Presupuestos.
        </p>
      )}

      <div className="grid gap-3 lg:grid-cols-[3fr_4fr]">
        <Card className="p-4 min-w-0">
          <div className="flex items-center justify-between gap-2 mb-3 flex-wrap">
            <h3 className={titulo}>Inversión por año (UI)</h3>
            <Leyenda />
          </div>
          {porAnio.length === 0 ? (
            <p className="text-[12px] text-muted-foreground py-8 text-center">Todavía no hay comprobantes con año de ejecución.</p>
          ) : (
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={porAnio} margin={{ top: 18, right: 4, left: 4, bottom: 0 }} barGap={2} maxBarSize={36}>
                <CartesianGrid vertical={false} stroke="var(--border)" strokeOpacity={0.6} />
                <XAxis dataKey="label" tick={{ fontSize: 11, fill: 'var(--muted-foreground)' }} axisLine={false} tickLine={false} />
                <YAxis hide />
                <Tooltip
                  formatter={(value, name) => [fmtUI(value), name === 'factura' ? 'Factura' : 'Presupuesto']}
                  labelFormatter={(l) => `Año ${l}`}
                  contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid var(--border)', background: 'var(--card)', color: 'var(--foreground)' }}
                  cursor={{ fill: 'var(--muted)', fillOpacity: 0.4 }}
                />
                {/* El total va arriba del segmento de más arriba de cada año */}
                <Bar dataKey="factura" name="factura" stackId="a" fill="var(--primary)" stroke="var(--card)" strokeWidth={1} radius={[4, 4, 0, 0]}>
                  <LabelList valueAccessor={(e) => (e.payload.presupuesto > 0 ? null : e.payload.total || null)} position="top" formatter={etiquetaTotal} style={estiloEtiqueta} />
                </Bar>
                <Bar dataKey="presupuesto" name="presupuesto" stackId="a" fill="var(--warning)" stroke="var(--card)" strokeWidth={1} radius={[4, 4, 0, 0]}>
                  <LabelList valueAccessor={(e) => (e.payload.presupuesto > 0 ? e.payload.total : null)} position="top" formatter={etiquetaTotal} style={estiloEtiqueta} />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
          {resumen.sinFechaEjecCount > 0 && (
            <p className="text-[11px] text-muted-foreground mt-2">
              {resumen.sinFechaEjecCount} comprobante{plural(resumen.sinFechaEjecCount)} sin año de ejecución no aparece{plural(resumen.sinFechaEjecCount, 'n')} en el gráfico.
            </p>
          )}
        </Card>

        <Card className="p-4 min-w-0">
          <h3 className={cn(titulo, 'mb-3')}>Inversión por categoría (UI)</h3>
          <ul className="space-y-1">
            {resumen.porCategoria.map(({ cat, ui }) => {
              const contenido = (
                <>
                  <span className="text-[12px] text-foreground w-28 sm:w-40 shrink-0 truncate text-left">{cat}</span>
                  <span className="flex-1 bg-muted rounded-full h-2 overflow-hidden" aria-hidden="true">
                    <span className="block h-full bg-primary rounded-full" style={{ width: `${(ui / maxCat) * 100}%` }} />
                  </span>
                  <span className="text-[12px] text-muted-foreground w-20 text-right shrink-0 tabular-nums">{nf0.format(Math.round(ui))}</span>
                </>
              )
              return (
                <li key={cat}>
                  {onCategoria ? (
                    <button
                      type="button"
                      onClick={() => onCategoria(cat)}
                      title={`Ver los comprobantes de ${cat}`}
                      className="w-full flex items-center gap-3 rounded-md px-1.5 py-1.5 hover:bg-accent transition-colors cursor-pointer"
                    >
                      {contenido}
                    </button>
                  ) : (
                    <div className="flex items-center gap-3 px-1.5 py-1.5">{contenido}</div>
                  )}
                </li>
              )
            })}
          </ul>
          {onCategoria && (
            <p className="text-[11px] text-muted-foreground mt-2">Tocá una categoría para ver sus comprobantes.</p>
          )}
        </Card>
      </div>
    </div>
  )
}
