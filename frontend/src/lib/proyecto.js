import { fmtFecha } from './fechas'

/** Períodos de un proyecto: 'presentacion' y un 'control_AAAA' por año de seguimiento */
export function periodosDeProyecto(proyecto) {
  const periodos = ['presentacion']
  const anio = proyecto?.anio_presentacion
  const duracion = proyecto?.duracion_seguimiento
  if (anio && duracion) {
    for (let i = 1; i <= duracion; i++) periodos.push(`control_${anio + i}`)
  }
  return periodos
}

/** 'Presentación 2026' / 'Control 2027' */
export function etiquetaPeriodo(periodo, proyecto) {
  if (periodo === 'presentacion') return `Presentación ${proyecto?.anio_presentacion ?? ''}`.trim()
  return `Control ${periodo.replace('control_', '')}`
}

/** Nombre corto de un proyecto para listas y encabezados */
export function etiquetaProyecto(p) {
  if (!p) return 'Proyecto'
  if (p.expediente) return p.expediente
  if (p.fecha_presentacion) return fmtFecha(p.fecha_presentacion)
  if (p.fecha_creacion) return fmtFecha(p.fecha_creacion)
  if (p.anio_presentacion) return `Proyecto ${p.anio_presentacion}`
  return 'Proyecto'
}

/** Año de ejecución -> 'Ejercicio 0 - 2026' / 'Ejercicio 2' */
export function etiquetaEjercicio(anio, anioBase) {
  const n = anio - anioBase
  return n === 0 ? `Ejercicio 0 - ${anioBase}` : `Ejercicio ${n}`
}
