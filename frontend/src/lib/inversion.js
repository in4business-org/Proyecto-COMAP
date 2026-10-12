// Montos y totales de inversión. Todo se compara en UI (unidades indexadas)
// con la cotización del mes anterior a la presentación.

const nf = new Intl.NumberFormat('es-UY', { maximumFractionDigits: 2 })
const nf0 = new Intl.NumberFormat('es-UY', { maximumFractionDigits: 0 })

/** Monto en su moneda: 312.400 */
export const fmtMonto = (n) => (n == null ? '--' : nf.format(n))

/** Monto en UI redondeado: UI 49.587 */
export const fmtUI = (n) => (n == null ? '--' : `UI ${nf0.format(Math.round(n))}`)

/** Porcentaje de un total: 79,1% */
export const fmtPct = (n, total) => (total > 0 ? `${((n / total) * 100).toFixed(1).replace('.', ',')}%` : '--')

/** Convierte un monto a UI. null si falta el monto o la cotización. */
export function aUI(monto, moneda, cotizacion) {
  if (monto == null || !cotizacion) return null
  const pesos = moneda === 'USD' ? monto * cotizacion.valor_usd : monto
  return pesos / cotizacion.valor_ui
}

/**
 * Totales para el resumen de la inversión: total, facturas, presupuestos,
 * por categoría y por año de ejecución. null si no hay nada para sumar.
 */
export function calcularResumen(comprobantes, cotizacion, anioDe) {
  if (!comprobantes?.length || !cotizacion) return null
  const conMonto = comprobantes.filter((f) => f.monto != null)
  if (!conMonto.length) return null

  const ui = (f) => aUI(f.monto, f.moneda, cotizacion) ?? 0
  const sumar = (lista) => lista.reduce((s, f) => s + ui(f), 0)
  const esTipo = (f) => f.tipo_comprobante === 'Factura' || f.tipo_comprobante === 'Presupuesto'

  const porCat = {}
  for (const f of conMonto) {
    const cat = f.categoria || 'Sin categoría'
    porCat[cat] = (porCat[cat] || 0) + ui(f)
  }

  const porAnioMap = {}
  let sinFechaEjecCount = 0
  for (const f of conMonto) {
    if (!esTipo(f)) continue
    const anio = anioDe(f.fecha_ejecucion)
    if (!anio) { sinFechaEjecCount++; continue }
    const key = String(anio)
    porAnioMap[key] ??= { anio: key, label: key, factura: 0, presupuesto: 0 }
    porAnioMap[key][f.tipo_comprobante === 'Factura' ? 'factura' : 'presupuesto'] += ui(f)
  }

  const sinTipo = conMonto.filter((f) => !esTipo(f))
  return {
    totalUI: sumar(conMonto),
    facturaUI: sumar(conMonto.filter((f) => f.tipo_comprobante === 'Factura')),
    presupuestoUI: sumar(conMonto.filter((f) => f.tipo_comprobante === 'Presupuesto')),
    porCategoria: Object.entries(porCat)
      .sort((a, b) => b[1] - a[1])
      .map(([cat, total]) => ({ cat, ui: total })),
    porAnio: Object.values(porAnioMap).sort((a, b) => a.anio.localeCompare(b.anio)),
    total: comprobantes.length,
    conMonto: conMonto.length,
    sinTipoCount: sinTipo.length,
    sinTipoUI: sumar(sinTipo),
    sinFechaEjecCount,
  }
}
