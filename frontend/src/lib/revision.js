// Chequeos de un comprobante antes de presentarlo. Cada problema trae un texto
// corto para mostrar debajo del proveedor, pensado para alguien que no conoce
// COMAP.
//
// Estados:
//   listo        sin problemas y con el PDF cargado
//   revisar      tiene al menos un dato a corregir
//   sin_archivo  los datos están bien pero falta el PDF (cargado a mano o por Excel)

export const ESTADOS = {
  revisar: { label: 'Revisar', variant: 'warning', orden: 0 },
  sin_archivo: { label: 'Sin archivo', variant: 'destructive', orden: 1 },
  listo: { label: 'Listo', variant: 'success', orden: 2 },
}

const soloDigitos = (v) => String(v || '').replace(/\D/g, '')
const claveDuplicado = (c) => {
  const prov = (c.rut || c.proveedor || '').trim().toLowerCase()
  const num = String(c.numero_factura || '').replace(/[\s\-/]/g, '').toLowerCase()
  return prov && num ? `${prov}|${num}` : null
}

/** Cuenta cuántas veces aparece cada proveedor + número en la lista */
export function indiceDuplicados(comprobantes) {
  const cuenta = new Map()
  for (const c of comprobantes || []) {
    const k = claveDuplicado(c)
    if (k) cuenta.set(k, (cuenta.get(k) || 0) + 1)
  }
  return cuenta
}

/**
 * Problemas de un comprobante: [{ tipo, texto, ayuda }]. `texto` va debajo del
 * proveedor; `ayuda` explica qué hacer.
 * `duplicados` sale de indiceDuplicados sobre el mismo período.
 */
export function problemasDe(c, { rutEmpresa, duplicados } = {}) {
  const problemas = []
  const rutRec = soloDigitos(c.rut_receptor)
  const rutEmp = soloDigitos(rutEmpresa)
  if (rutRec && rutEmp && rutRec !== rutEmp) {
    problemas.push({
      tipo: 'rut',
      texto: 'El RUT del receptor no es el de la empresa',
      ayuda: 'La factura está a nombre de otro RUT. Si es un error del proveedor, hay que pedirle una nota de crédito y una factura nueva.',
    })
  }
  if (c.monto == null) {
    problemas.push({ tipo: 'monto', texto: 'Falta el monto', ayuda: 'No pudimos leer el total. Completalo a mano mirando el comprobante.' })
  } else if (Number(c.monto) === 0) {
    problemas.push({ tipo: 'monto', texto: 'El monto quedó en 0', ayuda: 'Un comprobante en 0 no suma a la inversión. Revisá el total en el comprobante y corregilo.' })
  }
  const k = claveDuplicado(c)
  if (k && duplicados?.get(k) > 1) {
    problemas.push({
      tipo: 'duplicado',
      texto: 'Parece repetida: mismo proveedor y número',
      ayuda: 'Ya hay otro comprobante igual en este período. Si es el mismo, borrá uno de los dos.',
    })
  }
  if (!c.archivo) {
    problemas.push({
      tipo: 'archivo',
      texto: c.texto_extraido ? 'Falta el PDF' : 'Cargada a mano o desde Excel: falta el PDF',
      ayuda: 'Sin el archivo no se puede presentar. Subí el PDF del comprobante.',
    })
  }
  return problemas
}

/** Estado de un comprobante a partir de sus problemas */
export function estadoDe(problemas) {
  if (problemas.some((p) => p.tipo !== 'archivo')) return 'revisar'
  if (problemas.length) return 'sin_archivo'
  return 'listo'
}

/**
 * Revisa todos los comprobantes de un período.
 * Devuelve [{ ...comprobante, problemas, estado }] y los totales por estado.
 */
export function revisarComprobantes(comprobantes, rutEmpresa) {
  const duplicados = indiceDuplicados(comprobantes)
  const revisados = (comprobantes || []).map((c) => {
    const problemas = problemasDe(c, { rutEmpresa, duplicados })
    return { ...c, problemas, estado: estadoDe(problemas) }
  })
  const totales = { total: revisados.length, listo: 0, revisar: 0, sin_archivo: 0 }
  for (const r of revisados) totales[r.estado]++
  return { revisados, totales }
}
