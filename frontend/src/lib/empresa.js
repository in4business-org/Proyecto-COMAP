// Datos de una empresa: qué campos hay, cómo se llaman en pantalla y cuáles
// hacen falta para presentar el proyecto.

export const TIPOS_CONTRIBUYENTE = ['CEDE', 'No CEDE', 'Pequeña empresa', 'No sé']

export const CAMPOS_EMPRESA = [
  { key: 'rut', label: 'RUT', readonly: true, grupo: 'quien' },
  { key: 'nombre', label: 'Nombre con el que la conocen', grupo: 'quien' },
  { key: 'razon_social', label: 'Razón social', ayuda: 'Como figura en DGI.', grupo: 'quien' },
  { key: 'tipo_contribuyente', label: 'Tipo de contribuyente', tipo: 'opciones', grupo: 'quien' },
  { key: 'domicilio_fiscal', label: 'Domicilio fiscal', grupo: 'contacto' },
  { key: 'domicilio_constituido', label: 'Domicilio constituido', grupo: 'contacto' },
  { key: 'telefono', label: 'Teléfono', tipo: 'tel', grupo: 'contacto' },
  { key: 'email', label: 'Mail de contacto', tipo: 'email', grupo: 'contacto' },
  { key: 'giro', label: 'Giro', ayuda: 'A qué se dedica. Está en la constancia de DGI.', grupo: 'actividad' },
  { key: 'codigo_ciiu', label: 'Código CIIU', ayuda: 'También está en la constancia de DGI.', grupo: 'actividad' },
  { key: 'fecha_balance', label: 'Fecha del próximo balance', tipo: 'date', grupo: 'actividad' },
]

/** Campos que se usan al presentar y conviene tener cargados */
const PARA_PRESENTAR = ['razon_social', 'domicilio_fiscal', 'giro', 'codigo_ciiu', 'fecha_balance', 'tipo_contribuyente']

/** Labels (en minúscula) de los campos para presentar que faltan */
export function datosFaltantes(empresa) {
  if (!empresa) return []
  return PARA_PRESENTAR
    .filter((k) => !String(empresa[k] ?? '').trim())
    .map((k) => {
      const label = CAMPOS_EMPRESA.find((c) => c.key === k).label
      return k === 'codigo_ciiu' ? label : label.charAt(0).toLowerCase() + label.slice(1)
    })
}

/** 'Empresa Ejemplo S.A.' -> 'EE' */
export function iniciales(nombre) {
  const palabras = String(nombre || '?').replace(/[.,]/g, ' ').split(/\s+/).filter(Boolean)
  const sinSufijo = palabras.filter((p) => !/^(s|a|srl|sa|sas|ltda)$/i.test(p))
  const base = sinSufijo.length ? sinSufijo : palabras
  return base.slice(0, 2).map((p) => p[0].toUpperCase()).join('') || '?'
}

/**
 * Valida un RUT uruguayo: 12 dígitos, con el dígito verificador de DGI
 * (módulo 11 con pesos 4,3,2,9,8,7,6,5,4,3,2).
 * Devuelve null si es válido o un texto corto con el problema.
 */
export function problemaRut(rut) {
  const s = String(rut || '').replace(/[\s.-]/g, '')
  if (!s) return 'Falta el RUT'
  if (!/^\d+$/.test(s)) return 'Sólo números, sin puntos ni guiones'
  if (s.length !== 12) return `Tiene ${s.length} números y son 12`
  const pesos = [4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]
  const suma = pesos.reduce((acc, p, i) => acc + p * Number(s[i]), 0)
  let dv = 11 - (suma % 11)
  if (dv === 11) dv = 0
  if (dv === 10) return 'El número no es válido: revisá que esté bien copiado'
  if (dv !== Number(s[11])) return 'El número no es válido: revisá que esté bien copiado'
  return null
}
