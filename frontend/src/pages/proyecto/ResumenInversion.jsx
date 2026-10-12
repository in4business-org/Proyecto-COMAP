import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts'
import { cn } from '@/lib/utils'
import { fmtUI, fmtPct } from '@/lib/inversion'

/**
 * Tarjetas de totales y gráficos de inversión de un período.
 * `resumen` sale de calcularResumen (lib/inversion).
 */
export function ResumenInversion({ resumen, periodoLabel }) {
  if (!resumen) return null
  const plural = (n) => (n !== 1 ? 's' : '')

  const tarjetas = [
    {
      label: 'Total inversión',
      val: fmtUI(resumen.totalUI),
      sub: `${resumen.total} comprobante${plural(resumen.total)}`,
      warning: resumen.sinTipoCount > 0
        ? `⚠ ${resumen.sinTipoCount} sin tipo · ${fmtUI(resumen.sinTipoUI)} sin clasificar`
        : null,
    },
    { label: 'Facturas', val: fmtUI(resumen.facturaUI), sub: fmtPct(resumen.facturaUI, resumen.totalUI) + ' del total', color: 'text-primary' },
    { label: 'Presupuestos', val: fmtUI(resumen.presupuestoUI), sub: fmtPct(resumen.presupuestoUI, resumen.totalUI) + ' del total', color: 'text-warning' },
  ]

  return (
    <div className="bg-card/30 border border-border/50 rounded-xl p-5 shadow-sm space-y-5">
      <h2 className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
        Resumen · <span className="normal-case font-normal">{periodoLabel}</span>
      </h2>

      <div className="grid grid-cols-3 gap-3">
        {tarjetas.map(({ label, val, sub, color, warning }) => (
          <div key={label} className={cn('bg-card border rounded-lg p-3', warning ? 'border-warning/60' : 'border-border/60')}>
            <p className={cn('text-[14px] font-medium truncate', color || 'text-foreground')}>{val}</p>
            <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground mt-1">{label}</p>
            {sub && <p className="text-[11px] text-muted-foreground/70 mt-0.5">{sub}</p>}
            {warning && <p className="text-[11px] text-warning mt-0.5">{warning}</p>}
          </div>
        ))}
      </div>

      {(resumen.porAnio.length > 0 || resumen.sinFechaEjecCount > 0) && (
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground mb-2">Inversión por año (UI)</p>
          {resumen.sinFechaEjecCount > 0 && (
            <p className="text-[11px] text-warning mb-2">
              ⚠ Hay {resumen.sinFechaEjecCount} comprobante{plural(resumen.sinFechaEjecCount)} sin fecha de ejecución (no incluido{plural(resumen.sinFechaEjecCount)} en el gráfico)
            </p>
          )}
          <ResponsiveContainer width="100%" height={180}>
            <BarChart data={resumen.porAnio} margin={{ top: 4, right: 8, left: 8, bottom: 0 }} barSize={18}>
              <CartesianGrid strokeDasharray="3 3" stroke="currentColor" strokeOpacity={0.08} />
              <XAxis dataKey="label" tick={{ fontSize: 10, fill: 'var(--muted-foreground)' }} axisLine={false} tickLine={false} />
              <YAxis
                tick={{ fontSize: 10, fill: 'var(--muted-foreground)' }}
                axisLine={false}
                tickLine={false}
                tickFormatter={(v) => v >= 1000 ? `${Math.round(v / 1000)}k` : Math.round(v)}
                width={40}
              />
              <Tooltip
                formatter={(value, name) => [fmtUI(value), name === 'factura' ? 'Factura' : 'Presupuesto']}
                contentStyle={{ fontSize: 11, borderRadius: 6, border: '1px solid var(--border)', background: 'var(--card)', color: 'var(--foreground)' }}
                cursor={{ fill: 'var(--muted)', fillOpacity: 0.3 }}
              />
              <Legend
                formatter={(value) => <span style={{ fontSize: 10, color: 'var(--muted-foreground)' }}>{value === 'factura' ? 'Factura' : 'Presupuesto'}</span>}
                iconSize={8}
                wrapperStyle={{ paddingTop: 6 }}
              />
              <Bar dataKey="factura" name="factura" fill="var(--primary)" radius={[3, 3, 0, 0]} />
              <Bar dataKey="presupuesto" name="presupuesto" fill="var(--warning)" radius={[3, 3, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {resumen.porCategoria.length > 0 && (
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground mb-2">Inversión por categoría (UI)</p>
          <div className="space-y-1.5">
            {resumen.porCategoria.map(({ cat, ui }) => {
              const pct = (ui / resumen.porCategoria[0].ui) * 100
              return (
                <div key={cat} className="flex items-center gap-2">
                  <span className="text-[11px] text-muted-foreground w-40 shrink-0 truncate">{cat}</span>
                  <div className="flex-1 bg-muted/40 rounded-full h-1.5 overflow-hidden">
                    <div className="h-full bg-primary/70 rounded-full" style={{ width: `${pct}%` }} />
                  </div>
                  <span className="text-[11px] text-foreground w-28 text-right shrink-0">{fmtUI(ui)}</span>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
