// Las fechas de comprobantes (fecha, fecha_ejecucion) se guardan como texto
// DD/MM/YYYY. Las de proyecto (fecha_presentacion, fecha_creacion) como
// YYYY-MM-DD. Nunca usar new Date('YYYY-MM-DD'): se parsea en UTC y en
// Uruguay corre la fecha un día para atrás.

/** 'DD/MM/YYYY' o 'YYYY-MM-DD' -> Date local, o null */
export function parseFecha(valor) {
  if (!valor) return null
  if (valor instanceof Date) return valor
  const s = String(valor).trim()
  let m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/)
  if (m) return new Date(+m[3], +m[2] - 1, +m[1])
  m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/)
  if (m) return new Date(+m[1], +m[2] - 1, +m[3])
  const d = new Date(s)
  return Number.isNaN(d.getTime()) ? null : d
}

/** Date -> 'DD/MM/YYYY' */
export function aDDMMYYYY(date) {
  const d = String(date.getDate()).padStart(2, '0')
  const m = String(date.getMonth() + 1).padStart(2, '0')
  return `${d}/${m}/${date.getFullYear()}`
}

/** Año de una fecha en cualquiera de los dos formatos, o null */
export function anioDe(valor) {
  return parseFecha(valor)?.getFullYear() ?? null
}

/** Fecha para mostrar: 03/10/2026 */
export function fmtFecha(valor) {
  const d = parseFecha(valor)
  if (!d) return '--'
  return d.toLocaleDateString('es-UY', { day: '2-digit', month: '2-digit', year: 'numeric' })
}
