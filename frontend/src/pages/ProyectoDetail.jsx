import { useEffect, useMemo, useRef, useState } from 'react'
import { useParams, Link, useSearchParams, Navigate } from 'react-router-dom'
import { AlertCircle, ArrowLeft, ClipboardCheck, Download, FileSpreadsheet, Search, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { LoadingState, Spinner } from '@/components/ui/loading'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog'
import { ZonaArchivo } from '@/components/ZonaArchivo'
import { cn } from '@/lib/utils'
import { cotizaciones as cotApi, facturas as factApi } from '@/lib/api'
import { anioDe, parseFecha } from '@/lib/fechas'
import { aUI, calcularResumen, fmtPct, fmtUI } from '@/lib/inversion'
import { periodosDeProyecto, etiquetaPeriodo } from '@/lib/proyecto'
import { ESTADOS, revisarComprobantes } from '@/lib/revision'
import { useAuth } from '../context/AuthContext'
import { useProyecto } from './proyecto/useProyecto'
import { useComprobantes } from './proyecto/useComprobantes'
import { PlanEjecucion } from './proyecto/PlanEjecucion'
import { TablaComprobantes } from './proyecto/TablaComprobantes'
import { columnasDelPlan, opcionesDeEjercicio } from './proyecto/plan'
import { TablaRevision } from './comprobantes/TablaRevision'
import { DetalleComprobante } from './comprobantes/DetalleComprobante'
import { BarraSeleccion } from './comprobantes/BarraSeleccion'

const titulo = 'text-[11px] font-semibold uppercase tracking-widest text-muted-foreground'
const TIPOS_SUBIDA = ['pdf', 'png', 'jpg', 'jpeg', 'webp']
const plural = (n, s = 's') => (n !== 1 ? s : '')

const FILTROS = [
  { id: 'todos', label: 'Todos' },
  { id: 'revisar', label: 'Para revisar' },
  { id: 'sin_archivo', label: 'Sin archivo' },
  { id: 'listo', label: 'Listos' },
]

function useEsAncho(query = '(min-width: 1024px)') {
  const [ok, setOk] = useState(() => window.matchMedia(query).matches)
  useEffect(() => {
    const mq = window.matchMedia(query)
    const fn = () => setOk(mq.matches)
    mq.addEventListener('change', fn)
    return () => mq.removeEventListener('change', fn)
  }, [query])
  return ok
}

function Tarjeta({ label, valor, sub, className }) {
  return (
    <Card className="p-4">
      <p className={titulo}>{label}</p>
      <p className={cn('mt-1.5 text-xl font-medium tabular-nums', className)}>{valor}</p>
      {sub && <p className="mt-0.5 text-[12px] text-muted-foreground">{sub}</p>}
    </Card>
  )
}

/** Paso 2: comprobantes de inversión de un proyecto */
export default function ProyectoDetail() {
  const { empresaId, proyectoId } = useParams()
  // La pantalla de empresa entra con ?periodo=, ?vista=plan o ?categoria=
  const [params, setParams] = useSearchParams()
  const { puedeEscribir } = useAuth()
  const puedeEditar = puedeEscribir(empresaId, 'facturas')
  const esAncho = useEsAncho()
  const excelRef = useRef(null)

  const { empresa, proyecto, cargando } = useProyecto(empresaId, proyectoId)
  const periodos = useMemo(() => periodosDeProyecto(proyecto), [proyecto])
  const periodo = periodos.includes(params.get('periodo')) ? params.get('periodo') : 'presentacion'
  const vista = ['plan', 'planilla'].includes(params.get('vista')) ? params.get('vista') : 'revision'
  const categoria = params.get('categoria')

  const { comprobantes, setComprobantes, cargando: cargandoComp, aplicar } =
    useComprobantes(empresaId, proyecto?.id ? proyectoId : null, periodos, periodo)

  const [cotizacion, setCotizacion] = useState(null)
  const [cargandoCotizacion, setCargandoCotizacion] = useState(true)
  const [filtro, setFiltro] = useState('todos')
  const [busqueda, setBusqueda] = useState('')
  const [orden, setOrden] = useState({ campo: 'estado', dir: 'asc' })
  const [seleccion, setSeleccion] = useState(new Set())
  const [abiertoId, setAbiertoId] = useState(null)
  const [aviso, setAviso] = useState(null) // { texto, anterior?, error? }
  const [ocupado, setOcupado] = useState(false)
  const [subiendo, setSubiendo] = useState(null) // { hechos, total } mientras se suben PDF
  const [confirmarExport, setConfirmarExport] = useState(false)
  const [exportando, setExportando] = useState(false)
  const [planPendiente, setPlanPendiente] = useState(false)
  const [planGuardando, setPlanGuardando] = useState(false)

  useEffect(() => {
    if (!proyecto?.id) return
    cotApi.getMesAnterior(proyecto.fecha_presentacion || null)
      .then(setCotizacion)
      .catch(() => setCotizacion(null))
      .finally(() => setCargandoCotizacion(false))
  }, [proyecto?.id, proyecto?.fecha_presentacion])

  // Cambiar de período empieza de cero la selección y el detalle
  useEffect(() => { setSeleccion(new Set()); setAbiertoId(null); setAviso(null) }, [periodo])

  const { revisados, totales } = useMemo(() => revisarComprobantes(comprobantes, empresa?.rut), [comprobantes, empresa?.rut])
  const resumen = useMemo(() => calcularResumen(comprobantes, cotizacion, anioDe), [comprobantes, cotizacion])
  const anioBase = proyecto?.anio_presentacion ? parseInt(proyecto.anio_presentacion) : new Date().getFullYear()
  const columnas = useMemo(() => columnasDelPlan(periodos, anioBase), [periodos, anioBase])
  const opcionesEjercicio = useMemo(() => opcionesDeEjercicio(columnas, anioBase), [columnas, anioBase])

  const filas = useMemo(() => {
    const q = busqueda.trim().toLowerCase()
    const valor = {
      estado: (f) => ESTADOS[f.estado].orden,
      proveedor: (f) => (f.proveedor || '').toLowerCase(),
      fecha: (f) => parseFecha(f.fecha)?.getTime() ?? 0,
      monto: (f) => aUI(f.monto, f.moneda, cotizacion) ?? f.monto ?? 0,
    }[orden.campo]
    return revisados
      .filter((f) => !categoria || (categoria === 'Sin categoría' ? !f.categoria : f.categoria === categoria))
      .filter((f) => filtro === 'todos' || f.estado === filtro)
      .filter((f) => !q || [f.proveedor, f.numero_factura, f.rut, f.descripcion].some((v) => String(v || '').toLowerCase().includes(q)))
      .sort((a, b) => {
        const va = valor(a)
        const vb = valor(b)
        const cmp = typeof va === 'number' ? va - vb : String(va).localeCompare(String(vb))
        return (orden.dir === 'asc' ? cmp : -cmp) || (a.proveedor || '').localeCompare(b.proveedor || '')
      })
  }, [revisados, categoria, filtro, busqueda, orden, cotizacion])

  // El checklist antes era un panel lateral: los links viejos van a su pantalla
  if (params.get('checklist') === '1') return <Navigate to={`/empresas/${empresaId}/proyectos/${proyectoId}/checklist`} replace />
  if (cargando) return <LoadingState />

  const cambiarParams = (cambios) => {
    const next = new URLSearchParams(params)
    for (const [k, v] of Object.entries(cambios)) {
      if (v) next.set(k, v)
      else next.delete(k)
    }
    setParams(next, { replace: true })
  }

  // ── Guardado con deshacer ──────────────────────────────────
  // El backend reemplaza el período completo con la lista que le mandamos,
  // así que deshacer es volver a mandar la lista anterior.
  const guardar = async (lista, texto) => {
    const anterior = comprobantes
    setOcupado(true)
    try {
      aplicar(await factApi.updateResults(empresaId, proyectoId, periodo, lista))
      setAviso(texto ? { texto, anterior } : null)
      return true
    } catch (err) {
      setAviso({ texto: `No se pudo guardar: ${err.message}`, error: true })
      return false
    } finally {
      setOcupado(false)
    }
  }

  const deshacer = async () => {
    if (!aviso?.anterior) return
    setOcupado(true)
    try {
      aplicar(await factApi.updateResults(empresaId, proyectoId, periodo, aviso.anterior))
      setAviso({ texto: 'Listo, quedó como estaba.' })
    } catch (err) {
      setAviso({ texto: `No se pudo deshacer: ${err.message}`, error: true })
    } finally {
      setOcupado(false)
    }
  }

  const cambiarSeleccionados = async (cambios, descripcion) => {
    const n = seleccion.size
    const lista = comprobantes.map((c) => (seleccion.has(c.id) ? { ...c, ...cambios } : c))
    if (await guardar(lista, `Cambiaste ${descripcion ? `a ${descripcion} ` : ''}${n} comprobante${plural(n)}.`)) {
      setSeleccion(new Set())
    }
  }

  const borrar = async (ids) => {
    const n = ids.size
    if (await guardar(comprobantes.filter((c) => !ids.has(c.id)), `Borraste ${n} comprobante${plural(n)}.`)) {
      setSeleccion(new Set())
      if (ids.has(abiertoId)) setAbiertoId(null)
    }
  }

  const corregir = async (cambios) => {
    // `cambios` viene del detalle, con los campos calculados de la revisión: no se mandan
    // eslint-disable-next-line no-unused-vars
    const { problemas, estado, ...datos } = cambios
    const lista = comprobantes.map((c) => (c.id === datos.id ? { ...c, ...datos } : c))
    await guardar(lista, `Guardaste los cambios de ${datos.proveedor || 'el comprobante'}.`)
  }

  // ── Subir PDFs e importar Excel ────────────────────────────
  // Se mandan de a pocos archivos por pedido: cada pedido tarda unos segundos y
  // no llega al límite de tiempo del servidor aunque suban 50 PDF juntos. Si un
  // paquete falla, se pierden sólo esos archivos.
  const ARCHIVOS_POR_PEDIDO = 3
  const subirArchivos = async (files) => {
    setSubiendo({ hechos: 0, total: files.length })
    setAviso(null)
    const antes = comprobantes?.length || 0
    let lista = comprobantes || []
    const errores = []
    for (let i = 0; i < files.length; i += ARCHIVOS_POR_PEDIDO) {
      const paquete = files.slice(i, i + ARCHIVOS_POR_PEDIDO)
      try {
        const r = await factApi.uploadAndProcess(empresaId, proyectoId, periodo, paquete)
        lista = r.comprobantes
        errores.push(...(r.errores || []))
        aplicar(lista)
      } catch (err) {
        errores.push(...paquete.map((f) => ({ archivo: f.name, mensaje: `No se pudo subir (${err.message})` })))
      }
      setSubiendo({ hechos: Math.min(i + ARCHIVOS_POR_PEDIDO, files.length), total: files.length })
    }
    // Los archivos que no se pudieron leer igual quedan como comprobante vacío; los que no se pudieron subir, no
    const leidos = (lista?.length || 0) - antes - errores.filter((e) => !e.mensaje.startsWith('No se pudo subir')).length
    if (errores.length) {
      const n = errores.length
      const cuales = n === 1 ? errores[0].archivo : `${n} archivos`
      const yLeidos = leidos > 0 ? ` Leímos ${leidos} comprobante${plural(leidos)} bien.` : ''
      setAviso({ texto: `No pudimos leer ${cuales}: ${errores[0].mensaje}${yLeidos}`, error: true })
    } else {
      setAviso({ texto: leidos > 0 ? `Leímos ${leidos} comprobante${plural(leidos)} nuevo${plural(leidos)}. Revisá que los datos estén bien.` : 'Subimos los archivos pero no encontramos comprobantes nuevos.' })
    }
    setSubiendo(null)
  }

  const importarExcel = async (file) => {
    if (!file) return
    setOcupado(true)
    const antes = comprobantes?.length || 0
    try {
      const lista = await factApi.importar(empresaId, proyectoId, periodo, file)
      aplicar(lista)
      const nuevos = (lista?.length || 0) - antes
      setAviso({ texto: `Importamos ${nuevos} comprobante${plural(nuevos)} del Excel. Acordate de subir los PDF.` })
    } catch (err) {
      setAviso({ texto: `No se pudo importar el Excel: ${err.message}`, error: true })
    } finally {
      setOcupado(false)
      if (excelRef.current) excelRef.current.value = ''
    }
  }

  const bajarBlob = async (pedido, nombre) => {
    try {
      const blob = await pedido()
      const a = document.createElement('a')
      a.href = URL.createObjectURL(blob)
      a.download = nombre
      a.click()
    } catch (err) {
      setAviso({ texto: err.message, error: true })
    }
  }

  const exportar = async () => {
    setConfirmarExport(false)
    setExportando(true)
    await bajarBlob(() => factApi.exportExcel(empresaId, proyectoId, periodo), `comap_${periodo}.xlsx`)
    setExportando(false)
  }

  // ── Plan de ejecución ──────────────────────────────────────
  const moverEnPlan = (id, anio) => {
    setComprobantes((prev) => prev.map((r) => (r.id === id ? { ...r, fecha_ejecucion: `01/01/${anio}` } : r)))
    setPlanPendiente(true)
  }
  const guardarPlan = async () => {
    setPlanGuardando(true)
    if (await guardar(comprobantes, 'Guardaste el plan de ejecución.')) setPlanPendiente(false)
    setPlanGuardando(false)
  }

  const toggle = (id) => setSeleccion((s) => {
    const n = new Set(s)
    if (n.has(id)) n.delete(id)
    else n.add(id)
    return n
  })
  const toggleTodos = () => setSeleccion((s) => (filas.every((f) => s.has(f.id)) ? new Set() : new Set(filas.map((f) => f.id))))
  const ordenar = (campo) => setOrden((o) => ({ campo, dir: o.campo === campo && o.dir === 'asc' ? 'desc' : 'asc' }))

  const abierto = revisados.find((f) => f.id === abiertoId) || null
  const conteo = (id) => (id === 'todos' ? totales.total : totales[id])
  const base = `/empresas/${empresaId}/proyectos/${proyectoId}`
  const paraRevisar = totales.revisar + totales.sin_archivo

  const detalle = abierto && (
    <DetalleComprobante
      comprobante={abierto}
      cotizacion={cotizacion}
      rutEmpresa={empresa?.rut}
      anioBase={anioBase}
      opcionesEjercicio={opcionesEjercicio}
      puedeEditar={puedeEditar}
      onGuardar={corregir}
      onEliminar={(c) => borrar(new Set([c.id]))}
      onCerrar={() => setAbiertoId(null)}
    />
  )

  return (
    <div className="animate-fade-up space-y-5">
      {/* Encabezado */}
      <header className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div className="flex items-start gap-3 min-w-0">
          <Link to={`/empresas/${empresaId}?proyecto=${proyectoId}`} aria-label="Volver a la empresa" className="mt-0.5 rounded-md p-1.5 text-muted-foreground hover:bg-accent hover:text-foreground transition-colors">
            <ArrowLeft size={16} />
          </Link>
          <div className="min-w-0">
            <p className="text-[12px] text-muted-foreground truncate">{empresa?.nombre} · Proyecto {proyecto?.anio_presentacion || ''}</p>
            <h1 className="text-xl font-medium">Paso 2 · Comprobantes de inversión</h1>
            <p className="text-[13px] text-muted-foreground">
              Facturas y presupuestos de lo que se invierte.{puedeEditar && ' Arrastrá los PDF a la tabla y leemos los datos por vos.'}
            </p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2 lg:justify-end">
          <Link to={`${base}/checklist`}>
            <Button variant="ghost" size="sm"><ClipboardCheck size={14} aria-hidden="true" /> Paso 1 · Checklist</Button>
          </Link>
          {puedeEditar && (
            <>
              <input ref={excelRef} type="file" accept=".xlsx" className="hidden" onChange={(e) => importarExcel(e.target.files[0])} />
              <Button variant="outline" size="sm" onClick={() => excelRef.current?.click()} disabled={ocupado}>
                <FileSpreadsheet size={14} aria-hidden="true" /> Importar Excel
              </Button>
              <Button variant="ghost" size="sm" onClick={() => bajarBlob(() => factApi.downloadTemplate(empresaId, proyectoId, periodo), 'template_facturas.xlsx')}>
                Bajar modelo de Excel
              </Button>
            </>
          )}
          <Button
            variant="outline"
            size="sm"
            disabled={exportando || !comprobantes?.length}
            onClick={() => (empresa?.fecha_balance ? exportar() : setConfirmarExport(true))}
          >
            {exportando ? <Spinner size={14} /> : <Download size={14} aria-hidden="true" />} Exportar cuadro
          </Button>
        </div>
      </header>

      {/* Totales */}
      <section aria-label="Resumen" className="grid gap-3 grid-cols-2 lg:grid-cols-4">
        <Tarjeta label="Inversión total" valor={resumen ? fmtUI(resumen.totalUI) : '--'} sub={`${totales.total} comprobante${plural(totales.total)}`} />
        <Tarjeta label="Facturas" valor={resumen ? fmtUI(resumen.facturaUI) : '--'} sub={resumen ? `${fmtPct(resumen.facturaUI, resumen.totalUI)} · ya gastado` : null} className="text-primary" />
        <Tarjeta label="Presupuestos" valor={resumen ? fmtUI(resumen.presupuestoUI) : '--'} sub="a ejecutar" className="text-warning" />
        <button
          type="button"
          onClick={() => { setFiltro(totales.revisar ? 'revisar' : 'sin_archivo'); cambiarParams({ vista: null }) }}
          disabled={paraRevisar === 0}
          className={cn(
            'rounded-xl border p-4 text-left shadow-sm transition-colors cursor-pointer disabled:cursor-default',
            paraRevisar > 0 ? 'border-warning/50 bg-warning/10 hover:bg-warning/15' : 'border-border bg-card'
          )}
        >
          <p className={cn(titulo, paraRevisar > 0 && 'text-warning')}>Para revisar</p>
          <p className="mt-1.5 text-xl font-medium">
            {paraRevisar === 0 ? 'Nada' : `${totales.revisar} con dudas · ${totales.sin_archivo} sin PDF`}
          </p>
          {paraRevisar > 0 && <p className="mt-0.5 text-[12px] font-medium text-primary underline underline-offset-2">Ver sólo esos</p>}
        </button>
      </section>

      {/* Período y vista */}
      <div className="flex flex-wrap items-center gap-2">
        <label className="flex items-center gap-2 text-[13px] text-muted-foreground">
          Período
          <select
            value={periodo}
            onChange={(e) => cambiarParams({ periodo: e.target.value === 'presentacion' ? null : e.target.value })}
            className="h-9 rounded-lg border border-input bg-card px-2.5 text-[13px] text-foreground cursor-pointer"
          >
            {periodos.map((p) => <option key={p} value={p}>{etiquetaPeriodo(p, proyecto)}</option>)}
          </select>
        </label>
        <div role="group" aria-label="Vista" className="inline-flex rounded-lg border border-border bg-card p-0.5 sm:ml-auto">
          {[['revision', 'Revisión'], ['planilla', 'Planilla'], ['plan', 'Plan de ejecución']].map(([v, l]) => (
            <button
              key={v}
              type="button"
              aria-pressed={vista === v}
              onClick={() => cambiarParams({ vista: v === 'revision' ? null : v })}
              className={cn('h-8 rounded-md px-3 text-[13px] font-medium transition-colors cursor-pointer', vista === v ? 'bg-accent text-foreground' : 'text-muted-foreground hover:text-foreground')}
            >
              {l}
            </button>
          ))}
        </div>
      </div>

      {aviso && (
        <div role="status" className={cn('flex items-center gap-3 rounded-lg border px-4 py-2.5 text-[13px]', aviso.error ? 'border-destructive/30 bg-destructive/10 text-destructive' : 'border-primary/30 bg-primary/5')}>
          {aviso.error && <AlertCircle size={15} className="shrink-0" aria-hidden="true" />}
          <span className="flex-1">{aviso.texto}</span>
          {aviso.anterior && (
            <button type="button" onClick={deshacer} disabled={ocupado} className="font-semibold text-primary underline underline-offset-2 cursor-pointer">Deshacer</button>
          )}
          <button type="button" onClick={() => setAviso(null)} aria-label="Cerrar el aviso" className="text-muted-foreground cursor-pointer"><X size={14} /></button>
        </div>
      )}

      {vista === 'plan' && (
        <PlanEjecucion
          comprobantes={comprobantes}
          cargando={cargandoComp}
          columnas={columnas}
          anioBase={anioBase}
          periodoLabel={etiquetaPeriodo(periodo, proyecto)}
          puedeEditar={puedeEditar}
          pendiente={planPendiente}
          guardando={planGuardando}
          onMover={moverEnPlan}
          onGuardar={guardarPlan}
        />
      )}

      {vista === 'planilla' && (
        <TablaComprobantes
          empresaId={empresaId}
          proyectoId={proyectoId}
          periodo={periodo}
          comprobantes={comprobantes}
          cargando={cargandoComp}
          cotizacion={cotizacion}
          cargandoCotizacion={cargandoCotizacion}
          puedeEditar={puedeEditar}
          anioBase={anioBase}
          opcionesEjercicio={opcionesEjercicio}
          categoria={categoria}
          onQuitarCategoria={() => cambiarParams({ categoria: null })}
          onActualizar={aplicar}
        />
      )}

      {vista === 'revision' && (
        <div className={cn('grid gap-4', abierto && esAncho && 'grid-cols-[minmax(0,1fr)_360px]')}>
          <Card className="overflow-hidden min-w-0">
            {/* Filtros */}
            <div className="flex flex-wrap items-center gap-2 border-b border-border px-4 py-3">
              <div role="group" aria-label="Filtrar por estado" className="flex flex-wrap gap-1">
                {FILTROS.map((f) => (
                  <button
                    key={f.id}
                    type="button"
                    aria-pressed={filtro === f.id}
                    onClick={() => setFiltro(f.id)}
                    className={cn('h-8 rounded-md px-2.5 text-[13px] transition-colors cursor-pointer', filtro === f.id ? 'bg-accent font-medium text-foreground' : 'text-muted-foreground hover:text-foreground')}
                  >
                    {f.label} <span className="text-muted-foreground tabular-nums">{conteo(f.id)}</span>
                  </button>
                ))}
              </div>
              <label className="relative w-full sm:ml-auto sm:w-64">
                <span className="sr-only">Buscar</span>
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
                <input
                  type="search"
                  value={busqueda}
                  onChange={(e) => setBusqueda(e.target.value)}
                  placeholder="Proveedor, número o RUT"
                  className="h-9 w-full rounded-lg border border-input bg-background pl-8 pr-3 text-[13px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                />
              </label>
            </div>

            {categoria && (
              <div className="flex items-center gap-2 border-b border-border px-4 py-2 text-[12px]">
                <span className="text-muted-foreground">Mostrando sólo</span>
                <span className="inline-flex items-center gap-1 rounded-md border border-primary/30 bg-primary/10 py-0.5 pl-2 pr-1 font-medium text-primary">
                  {categoria}
                  <button type="button" onClick={() => cambiarParams({ categoria: null })} aria-label="Quitar el filtro de categoría" className="rounded p-0.5 hover:bg-primary/15 cursor-pointer"><X size={12} /></button>
                </span>
              </div>
            )}

            {seleccion.size > 0 && (
              <BarraSeleccion
                cantidad={seleccion.size}
                opcionesEjercicio={opcionesEjercicio}
                ocupado={ocupado}
                onCambiar={cambiarSeleccionados}
                onBorrar={() => borrar(seleccion)}
                onLimpiar={() => setSeleccion(new Set())}
              />
            )}

            <ZonaArchivo envolver multiple tipos={TIPOS_SUBIDA} maxMb={15} disabled={!puedeEditar || Boolean(subiendo)} onArchivos={subirArchivos} onError={(e) => e && setAviso({ texto: e, error: true })}>
              {({ elegir }) => (
                <>
                  {cargandoComp ? (
                    <LoadingState message="Cargando comprobantes..." />
                  ) : filas.length === 0 ? (
                    <p className="px-4 py-12 text-center text-[13px] text-muted-foreground">
                      {totales.total === 0
                        ? 'Todavía no hay comprobantes en este período.'
                        : 'No hay comprobantes que coincidan con el filtro o la búsqueda.'}
                    </p>
                  ) : (
                    <TablaRevision
                      filas={filas}
                      seleccion={seleccion}
                      onToggle={toggle}
                      onToggleTodos={toggleTodos}
                      abiertoId={abiertoId}
                      onAbrir={(id) => setAbiertoId((a) => (a === id ? null : id))}
                      orden={orden}
                      onOrden={ordenar}
                      cotizacion={cotizacion}
                      puedeEditar={puedeEditar}
                    />
                  )}
                  {puedeEditar && (
                    <div className="flex flex-col items-center gap-1 border-t border-border px-4 py-4 text-center text-[13px] text-muted-foreground">
                      {subiendo ? (
                        <span className="flex items-center gap-2 text-primary"><Spinner size={14} className="text-primary" /> Leyendo {subiendo.hechos} de {subiendo.total} archivo{plural(subiendo.total)}...</span>
                      ) : (
                        <>
                          <span>
                            Soltá acá los PDF para cargarlos · o{' '}
                            <button type="button" onClick={elegir} className="font-medium text-primary underline underline-offset-2 cursor-pointer">elegí archivos</button>
                          </span>
                          <span className="text-[12px]">PDF o imágenes, hasta 15 MB cada uno. Para muchos comprobantes juntos usá Importar Excel.</span>
                        </>
                      )}
                    </div>
                  )}
                </>
              )}
            </ZonaArchivo>
          </Card>

          {abierto && esAncho && (
            <Card className="h-fit p-5 lg:sticky lg:top-4">{detalle}</Card>
          )}
        </div>
      )}

      {/* En pantallas chicas el detalle va en un diálogo */}
      <Dialog open={!!abierto && !esAncho && vista === 'revision'} onClose={() => setAbiertoId(null)}>
        <DialogContent>{detalle}</DialogContent>
      </Dialog>

      {!puedeEditar && (
        <p className="text-center text-[12px] text-muted-foreground">Tenés acceso de sólo lectura a los comprobantes de esta empresa.</p>
      )}

      {!cargandoCotizacion && !cotizacion && (
        <p className="text-center text-[12px] text-muted-foreground">No pudimos traer la cotización del BCU: los montos en UI no se muestran.</p>
      )}

      <Dialog open={confirmarExport} onClose={() => setConfirmarExport(false)}>
        <DialogContent onClose={() => setConfirmarExport(false)}>
          <DialogHeader>
            <DialogTitle>Falta la fecha de balance</DialogTitle>
            <DialogDescription>
              La empresa no tiene cargada la fecha del próximo balance y el cuadro la usa. Podés completarla en Datos de la empresa o exportar igual.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="ghost" size="sm" onClick={() => setConfirmarExport(false)}>Cancelar</Button>
            <Button size="sm" onClick={exportar}><Download size={14} aria-hidden="true" /> Exportar igual</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
