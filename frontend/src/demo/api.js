import { CHECKLIST as CHECK, PREGUNTAS } from 'virtual:demo-checklist'

// API simulada del modo demo (`npm run demo`). Reemplaza a lib/api.js con la
// misma forma de funciones. Los datos viven en memoria y se guardan en el
// navegador para que sobrevivan a una recarga; "Reiniciar datos" los vuelve
// al estado inicial.

const CLAVE = 'demo-db'
const wait = (v, ms = 150) => new Promise((r) => setTimeout(() => { guardar(); r(v === undefined ? v : structuredClone(v)) }, ms))

const f = (id, d) => ({ id, rut_receptor: '210000000019', texto_extraido: true, cantidad: 1, ...d })

const db = {
  empresas: [
    {
      id: 'e1', rut: '210000000019', nombre: 'Empresa Ejemplo S.A.', razon_social: 'Empresa Ejemplo S.A.',
      tipo_contribuyente: 'No CEDE', domicilio_fiscal: 'Av. Italia 1234', giro: 'Fabricación de envases',
      codigo_ciiu: '', fecha_balance: '', email: 'admin@ejemplo.uy', telefono: '099123456',
    },
    { id: 'e2', rut: '211003420017', nombre: 'Otra Empresa S.R.L.' },
  ],
  proyectos: {
    e1: [
      { id: 'p1', expediente: null, fecha_creacion: '2026-02-10', fecha_presentacion: '2026-11-30', anio_presentacion: 2026, duracion_seguimiento: 4 },
      { id: 'p0', expediente: '2023-5-1-000123', fecha_creacion: '2023-03-01', fecha_presentacion: '2023-06-15', anio_presentacion: 2023, duracion_seguimiento: 3 },
    ],
    e2: [],
  },
  facturas: {
    p1: {
      presentacion: [
        f('f1', { archivo: 'a5521.pdf', proveedor: 'Construcciones Bahía', rut: '214455660018', numero_factura: 'A5521', fecha: '02/04/2026', monto: 312400, moneda: 'UYU', categoria: 'Instalaciones', tipo_comprobante: 'Factura', fecha_ejecucion: '02/04/2026', rut_receptor: '219999990011', descripcion: 'Obra civil del galpón' }),
        f('f2', { archivo: 'p118.pdf', proveedor: 'Equipos del Plata', rut: '213344550012', numero_factura: 'P118', fecha: '15/04/2026', monto: 0, moneda: 'USD', categoria: 'Maquinaria', tipo_comprobante: 'Presupuesto', fecha_ejecucion: '01/01/2027', descripcion: 'Envasadora' }),
        f('f3', { archivo: 'a5521b.pdf', proveedor: 'Construcciones Bahía', rut: '214455660018', numero_factura: 'A-5521', fecha: '02/04/2026', monto: 312400, moneda: 'UYU', categoria: 'Instalaciones', tipo_comprobante: 'Factura', fecha_ejecucion: '02/04/2026' }),
        f('f4', { archivo: null, texto_extraido: false, rut_receptor: null, proveedor: 'Informática Litoral', numero_factura: 'A778', fecha: '03/05/2026', monto: 2150, moneda: 'USD', categoria: 'Equipos', tipo_comprobante: 'Factura', fecha_ejecucion: '03/05/2026' }),
        f('f5', { archivo: null, texto_extraido: false, rut_receptor: null, proveedor: 'Software Gestión', numero_factura: 'A120', fecha: '14/06/2026', monto: 1200, moneda: 'USD', categoria: 'Equipos', tipo_comprobante: 'Factura', fecha_ejecucion: '14/06/2026' }),
        f('f6', { archivo: 'a10234.pdf', proveedor: 'Ferretería Industrial Norte', numero_factura: 'A10234', fecha: '12/03/2026', monto: 4820, moneda: 'USD', categoria: 'Maquinaria', tipo_comprobante: 'Factura', fecha_ejecucion: '12/03/2026' }),
        f('f7', { archivo: 'b2045.pdf', proveedor: 'Transportes Cerro', numero_factura: 'B2045', fecha: '20/05/2026', monto: 18300, moneda: 'UYU', categoria: 'Vehiculos', tipo_comprobante: 'Presupuesto', fecha_ejecucion: '01/01/2028' }),
        f('f8', { archivo: 'a3390.pdf', proveedor: 'Mobiliario Oficina Sur', numero_factura: 'A3390', fecha: '01/06/2026', monto: 96500, moneda: 'UYU', categoria: 'Materiales', tipo_comprobante: 'Factura', fecha_ejecucion: '01/06/2026' }),
        f('f9', { archivo: 'a10388.pdf', proveedor: 'Ferretería Industrial Norte', numero_factura: 'A10388', fecha: '20/06/2026', monto: 640, moneda: 'USD', categoria: null, tipo_comprobante: null, fecha_ejecucion: null }),
      ],
    },
  },
  checklist: {},
  perfiles: { p1: { mipyme: false, importacion: false, agro_cannabis: false } },
}

// Estado guardado de cada ítem, como la tabla ChecklistItem: { item_id: { estado, archivo } }
const hechos = { '1.1': { estado: 'completado' }, '1.2': { estado: 'completado', archivo: 'certificado-notarial.pdf' }, '1.3': { estado: 'completado', archivo: 'dgi-6906.pdf' } }
db.checklist.p1 = hechos
db.checklist.p0 = Object.fromEntries(CHECK.map((i) => [i.id, { estado: 'completado' }]))

const inicial = structuredClone(db)
try {
  const guardado = JSON.parse(localStorage.getItem(CLAVE))
  if (guardado?.empresas) Object.assign(db, guardado)
} catch { /* sin storage: arranca de cero */ }

function guardar() {
  try { localStorage.setItem(CLAVE, JSON.stringify(db)) } catch { /* sin storage */ }
}

export function reiniciarDemo() {
  try { localStorage.removeItem(CLAVE) } catch { /* sin storage */ }
  Object.assign(db, structuredClone(inicial))
}

/** Checklist armado como lo devuelve el backend (misma regla que checklist-preguntas.js) */
function armarChecklist(p) {
  const guardados = db.checklist[p] || {}
  const respuestas = db.perfiles[p] || {}
  return CHECK.map((i) => {
    const item = { ...i, estado: guardados[i.id]?.estado || 'pendiente', archivo: guardados[i.id]?.archivo || null, nota_usuario: '' }
    const pregunta = PREGUNTAS.find((q) => q.items.includes(i.id) && respuestas[q.id] === false)
    if (!pregunta || item.estado === 'completado') return { ...item, no_aplica_por: null }
    return { ...item, estado: 'no_aplica', no_aplica_por: pregunta.id }
  })
}

export const dashboard = { load: () => wait(db.empresas.map((e) => ({ ...e, proyectos: db.proyectos[e.id] || [] }))) }
export const me = { load: () => wait({ accesos: [] }) }

export const admin = {
  listUsuarios: () => wait([
    { username: 'u1', sub: 'sub-demo', email: 'demo@gestora.uy', nombre: 'Gestora Demo', habilitado: true, estado: 'CONFIRMED', rol: 'master', creado: '2026-01-02' },
    { username: 'u2', sub: 's2', email: 'ana@ejemplo.uy', nombre: 'Ana', habilitado: true, estado: 'FORCE_CHANGE_PASSWORD', rol: 'user', creado: '2026-03-02' },
  ]),
  listModulos: () => wait([
    { id: 'empresa', nombre: 'Datos de la empresa' }, { id: 'proyectos', nombre: 'Proyectos' },
    { id: 'facturas', nombre: 'Facturas' }, { id: 'checklist', nombre: 'Checklist' }, { id: 'simulador', nombre: 'Simulador' },
  ]),
  getAccesos: () => wait([{ empresaId: 'e1', escritura: ['facturas'] }]),
  setAccesos: (u, a) => wait(a),
  crearUsuario: ({ email }) => (email === 'ana@ejemplo.uy'
    ? Promise.reject(Object.assign(new Error('Ya existe un usuario con ese email'), { status: 409 }))
    : wait({ usuario: { email }, passwordTemporal: null })),
  cambiarRol: () => wait({}),
  cambiarEstado: () => wait({}),
  resetPassword: () => wait({ passwordTemporal: 'Abc123!xyz' }),
  eliminarUsuario: () => wait({}),
}

export const empresas = {
  list: () => wait(db.empresas),
  get: (id) => wait(db.empresas.find((e) => e.id === id)),
  create: (rut, nombre, extra = {}) => {
    if (db.empresas.some((e) => e.rut === rut)) {
      const existente = db.empresas.find((e) => e.rut === rut)
      return Promise.reject(Object.assign(new Error(`Ya existe una empresa con ese RUT: ${existente.nombre}`), { status: 409, data: { empresa_id: existente.id } }))
    }
    const id = `${rut}_${nombre.replace(/\s+/g, '_')}`
    db.empresas.push({ id, rut, nombre, ...extra })
    db.proyectos[id] = []
    return wait({ empresa_id: id })
  },
  update: (id, data) => { Object.assign(db.empresas.find((e) => e.id === id), data); return wait({ ok: true }) },
  resumenBorrado: (id) => {
    const proys = db.proyectos[id] || []
    const comprobantes = proys.reduce((n, p) => n + Object.values(db.facturas[p.id] || {}).flat().length, 0)
    const documentos = proys.reduce((n, p) => n + Object.values(db.checklist[p.id] || {}).filter((i) => i.archivo).length, 0)
    return wait({ proyectos: proys.length, comprobantes, documentos, personas: id === 'e1' ? 2 : 0 })
  },
  eliminar: (id) => {
    for (const p of db.proyectos[id] || []) { delete db.facturas[p.id]; delete db.checklist[p.id] }
    delete db.proyectos[id]
    db.empresas = db.empresas.filter((e) => e.id !== id)
    return wait({ ok: true })
  },
}

export const proyectos = {
  list: (e) => wait(db.proyectos[e] || []),
  create: (e, anio, dur, fecha) => {
    const id = `p${Date.now()}`
    ;(db.proyectos[e] ||= []).push({ id, fecha_creacion: '2026-10-12', fecha_presentacion: fecha, anio_presentacion: anio, duracion_seguimiento: dur })
    db.checklist[id] = {}
    return wait({ proyecto_id: id })
  },
  updateExpediente: (e, p, expediente) => { Object.assign(db.proyectos[e].find((x) => x.id === p), { expediente }); return wait({ ok: true }) },
  updateMetadata: (e, p, d) => { Object.assign(db.proyectos[e].find((x) => x.id === p), d); return wait({ ok: true }) },
}

export const facturas = {
  getAllResults: (e, p) => wait(db.facturas[p] || {}),
  uploadAndProcess: (e, p, per) => wait(db.facturas[p]?.[per] || [], 800),
  exportExcel: () => Promise.reject(new Error('En el modo demo no se genera el Excel')),
  reprocesar: () => wait([]),
  updateResults: (e, p, per, results) => {
    ;(db.facturas[p] ||= {})[per] = results.map((r, i) => ({ ...r, id: r.id || `n${Date.now()}${i}` }))
    return wait(db.facturas[p][per])
  },
  downloadTemplate: () => Promise.reject(new Error('En el modo demo no se baja el template')),
  importar: (e, p, per) => wait(db.facturas[p]?.[per] || []),
}

export const checklist = {
  get: (e, p) => wait(armarChecklist(p)),
  updateItem: (e, p, id, estado) => {
    ;(db.checklist[p] ||= {})[id] = { ...db.checklist[p][id], estado }
    return wait({ ok: true })
  },
  uploadFile: (e, p, id, file) => {
    ;(db.checklist[p] ||= {})[id] = { estado: 'completado', archivo: file.name }
    return wait({ ok: true, archivo: file.name }, 700)
  },
  downloadFile: () => Promise.reject(new Error('En el modo demo no hay archivos para bajar')),
  getPerfil: (e, p) => wait({ preguntas: PREGUNTAS, respuestas: db.perfiles[p] || {} }),
  setPerfil: (e, p, respuestas) => {
    const limpias = Object.fromEntries(Object.entries(respuestas || {}).filter(([, v]) => typeof v === 'boolean'))
    db.perfiles[p] = limpias
    return wait({ respuestas: limpias })
  },
}

export const cotizaciones = { getMesAnterior: () => wait({ fecha: '2026-10-31', valor_usd: 40.12, valor_ui: 6.3012 }) }

export const simulador = {
  download: () => Promise.reject(new Error('En el modo demo no se baja la planilla')),
  upload: () => wait({ ok: true, resultados: { puntaje_final: 6.42, alcanza_minimo: 'SI', exoneracion_irae_pct: 51, exoneracion_ui: 840000, plazo_exoneracion: '7 años' } }),
  results: () => wait({}),
}
