import { anioDe } from '@/lib/fechas'
import { etiquetaEjercicio } from '@/lib/proyecto'

/**
 * Columnas del plan de ejecución. Cada período control_AAAA corresponde a la
 * inversión del año AAAA-1. Las facturas ya emitidas van fijas en "antes".
 */
export function columnasDelPlan(periodos, anioBase) {
  const controlYears = periodos
    .filter(p => p.startsWith('control_'))
    .map(p => parseInt(p.replace('control_', '')) - 1)
    .sort((a, b) => a - b)
  const years = controlYears.length > 0 ? controlYears : [anioBase, anioBase + 1, anioBase + 2]
  return [
    { key: 'antes', label: 'Antes de presentación', sub: 'Facturas emitidas', locked: true },
    ...years.map((y, i) => ({
      key: String(y),
      label: etiquetaEjercicio(y, anioBase),
      sub: i === 0 ? 'Año de presentación · después de presentación' : null,
      locked: false,
    })),
  ]
}

/** Opciones del desplegable "Ejercicio" de la tabla */
export function opcionesDeEjercicio(columnas, anioBase) {
  const cols = columnas.filter(c => !c.locked)
  if (cols.length > 0) return [{ v: '', l: '--' }, ...cols.map(c => ({ v: c.key, l: c.label }))]
  return [
    { v: '', l: '--' },
    ...Array.from({ length: 4 }, (_, i) => ({ v: String(anioBase + i), l: etiquetaEjercicio(anioBase + i, anioBase) })),
  ]
}

/** En qué columna del plan cae un comprobante (los años fuera de rango van al borde) */
export function columnaDeComprobante(item, columnas, anioBase) {
  if (item.tipo_comprobante === 'Factura') return 'antes'
  if (!item.fecha_ejecucion) return String(anioBase)
  const year = anioDe(item.fecha_ejecucion)
  const available = columnas.filter(c => !c.locked).map(c => parseInt(c.key))
  if (!available.length) return String(anioBase)
  if (year < available[0]) return String(available[0])
  if (year > available[available.length - 1]) return String(available[available.length - 1])
  return String(year)
}
