import { useEffect, useMemo, useState } from 'react'
import { useParams, Link, useSearchParams, useNavigate } from 'react-router-dom'
import {
  AlertTriangle, ArrowRight, FolderOpen, MoreHorizontal, Plus, Settings, Trash2, Users,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card } from '@/components/ui/card'
import { LoadingState, EmptyState } from '@/components/ui/loading'
import { Menu, MenuItem, MenuSeparador } from '@/components/ui/menu'
import { ResumenInversion } from '@/components/inversion/ResumenInversion'
import { cn } from '@/lib/utils'
import { empresas as empApi, proyectos as projApi, checklist as checkApi, cotizaciones as cotApi } from '@/lib/api'
import { anioDe, fmtFecha } from '@/lib/fechas'
import { calcularResumen } from '@/lib/inversion'
import { periodosDeProyecto, etiquetaPeriodo } from '@/lib/proyecto'
import { revisarComprobantes } from '@/lib/revision'
import { datosFaltantes, iniciales } from '@/lib/empresa'
import { avisarCambio } from '@/lib/eventos'
import { useAuth } from '../context/AuthContext'
import { useComprobantes } from './proyecto/useComprobantes'
import { DatosEmpresaDialog } from './empresa/DatosEmpresaDialog'
import { NuevoProyectoDialog, ConfigurarProyectoDialog } from './empresa/ProyectoDialogs'
import { SimuladorDialog } from './empresa/SimuladorDialog'
import { EliminarEmpresaDialog } from './empresa/EliminarEmpresaDialog'

/** Proyecto que se muestra si la URL no dice cuál: el más nuevo */
function proyectoPorDefecto(proyectos) {
  return [...proyectos].sort((a, b) =>
    (b.anio_presentacion || 0) - (a.anio_presentacion || 0) ||
    String(b.fecha_creacion || '').localeCompare(String(a.fecha_creacion || ''))
  )[0]
}

function nombreProyecto(p) {
  return p.expediente ? `Expediente ${p.expediente}` : `Proyecto ${p.anio_presentacion || ''}`.trim()
}

function Progreso({ valor, total, className }) {
  const pct = total > 0 ? Math.round((valor / total) * 100) : 0
  return (
    <div className="h-1.5 rounded-full bg-muted overflow-hidden" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}>
      <div className={cn('h-full rounded-full transition-all', className)} style={{ width: `${pct}%` }} />
    </div>
  )
}

/** Acceso grande a un paso: checklist o comprobantes */
function PasoCard({ to, paso, badge, titulo, descripcion, progreso, resumen, detalle, destacada }) {
  return (
    <Link
      to={to}
      className={cn(
        'group flex flex-col gap-5 rounded-xl border bg-card p-6 shadow-sm transition-colors hover:border-primary/50',
        destacada ? 'border-primary/50' : 'border-border'
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="text-[13px] text-muted-foreground">Paso {paso}</span>
        {badge}
      </div>
      <div>
        <h3 className="text-lg font-medium">{titulo}</h3>
        <p className="mt-0.5 text-sm text-muted-foreground">{descripcion}</p>
      </div>
      <div className="mt-auto space-y-3">
        {progreso}
        <div className="flex items-center justify-between gap-3 text-[13px]">
          <span className="text-foreground">{resumen}</span>
          <span className="flex items-center gap-1 font-medium text-primary shrink-0">
            Abrir <ArrowRight size={14} className="transition-transform group-hover:translate-x-0.5" aria-hidden="true" />
          </span>
        </div>
        {detalle && <p className="text-[12px] text-muted-foreground line-clamp-1">{detalle}</p>}
      </div>
    </Link>
  )
}

export default function EmpresaDetail() {
  const { empresaId } = useParams()
  const navigate = useNavigate()
  const [params, setParams] = useSearchParams()
  const { puedeEscribir, isAdmin, isMaster } = useAuth()
  const puedeEditarEmpresa = puedeEscribir(empresaId, 'empresa')
  const puedeEditarProyectos = puedeEscribir(empresaId, 'proyectos')

  const [empresa, setEmpresa] = useState(null)
  const [proyectos, setProyectos] = useState([])
  const [loading, setLoading] = useState(true)
  const [checklist, setChecklist] = useState(null)
  const [cotizacion, setCotizacion] = useState(null)
  const [dialogo, setDialogo] = useState(null) // 'datos' | 'nuevo' | 'simulador' | 'eliminar'
  const [configurando, setConfigurando] = useState(null)

  const cargarProyectos = () => projApi.list(empresaId).then(setProyectos)

  useEffect(() => {
    setLoading(true)
    Promise.all([
      empApi.get(empresaId).then(setEmpresa),
      cargarProyectos(),
    ]).catch(console.error).finally(() => setLoading(false))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [empresaId])

  const proyecto = proyectos.find((p) => p.id === params.get('proyecto')) || proyectoPorDefecto(proyectos)
  const periodos = useMemo(() => periodosDeProyecto(proyecto), [proyecto])
  const periodo = periodos.includes(params.get('periodo')) ? params.get('periodo') : 'presentacion'

  const elegir = (cambios) => {
    const next = new URLSearchParams(params)
    for (const [k, v] of Object.entries(cambios)) {
      if (v) next.set(k, v)
      else next.delete(k)
    }
    setParams(next, { replace: true })
  }

  // Checklist y cotización del proyecto elegido
  useEffect(() => {
    if (!proyecto?.id) return
    setChecklist(null)
    checkApi.get(empresaId, proyecto.id).then(setChecklist).catch(() => setChecklist([]))
  }, [empresaId, proyecto?.id])

  useEffect(() => {
    if (!proyecto?.id) return
    cotApi.getMesAnterior(proyecto.fecha_presentacion || null).then(setCotizacion).catch(() => setCotizacion(null))
  }, [proyecto?.id, proyecto?.fecha_presentacion])

  const { comprobantes } = useComprobantes(empresaId, proyecto?.id, periodos, periodo)

  const revision = useMemo(() => revisarComprobantes(comprobantes, empresa?.rut).totales, [comprobantes, empresa?.rut])
  const resumen = useMemo(() => calcularResumen(comprobantes, cotizacion, anioDe), [comprobantes, cotizacion])

  if (loading) return <LoadingState />
  if (!empresa) return <EmptyState icon={FolderOpen} title="No encontramos la empresa" description="Puede que no tengas acceso o que se haya borrado." />

  const faltan = datosFaltantes(empresa)
  const base = proyecto ? `/empresas/${empresaId}/proyectos/${proyecto.id}` : ''
  const conPeriodo = (extra = {}) => {
    const q = new URLSearchParams({ ...(periodo !== 'presentacion' ? { periodo } : {}), ...extra })
    const qs = q.toString()
    return `${base}${qs ? `?${qs}` : ''}`
  }

  const aplicables = (checklist || []).filter((i) => i.estado !== 'no_aplica')
  const listos = aplicables.filter((i) => i.estado === 'completado').length
  const siguiente = aplicables.find((i) => i.estado === 'pendiente')
  const checklistCompleto = checklist && aplicables.length > 0 && listos === aplicables.length
  const hayMenu = isAdmin || isMaster

  return (
    <div className="animate-fade-up space-y-10">
      {/* Encabezado: quién es, qué le falta y las acciones */}
      <header className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-start gap-4 min-w-0">
          <span className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-primary text-primary-foreground font-semibold">
            {iniciales(empresa.nombre)}
          </span>
          <div className="min-w-0 space-y-1">
            <h1 className="text-2xl font-medium leading-tight truncate">{empresa.nombre}</h1>
            <p className="text-[13px] text-muted-foreground truncate">
              <span className="font-mono">{empresa.rut}</span>
              {empresa.tipo_contribuyente && ` · ${empresa.tipo_contribuyente}`}
            </p>
            {faltan.length > 0 && (
              <p className="text-[13px] text-muted-foreground">
                <AlertTriangle size={13} className="mr-1.5 inline text-warning align-[-2px]" aria-hidden="true" />
                Faltan datos para presentar: {new Intl.ListFormat('es', { type: 'conjunction' }).format(faltan)}.
                {puedeEditarEmpresa && (
                  <button type="button" onClick={() => setDialogo('datos')} className="ml-1.5 font-medium text-primary underline-offset-2 hover:underline cursor-pointer">
                    Completar
                  </button>
                )}
              </p>
            )}
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => setDialogo('datos')}>Datos de la empresa</Button>
          {puedeEditarProyectos && (
            <Button size="sm" onClick={() => setDialogo('nuevo')}>
              <Plus size={14} aria-hidden="true" /> Nuevo proyecto
            </Button>
          )}
          {hayMenu && (
            <Menu
              trigger={({ props }) => (
                <Button variant="ghost" size="icon" className="size-9" aria-label="Más acciones" {...props}>
                  <MoreHorizontal size={18} />
                </Button>
              )}
            >
              {isAdmin && (
                <MenuItem onClick={() => navigate('/admin')}>
                  <Users size={15} aria-hidden="true" /> Personas con acceso
                </MenuItem>
              )}
              {isMaster && (
                <>
                  {isAdmin && <MenuSeparador />}
                  <MenuItem destructive onClick={() => setDialogo('eliminar')}>
                    <Trash2 size={15} aria-hidden="true" /> Eliminar empresa
                  </MenuItem>
                </>
              )}
            </Menu>
          )}
        </div>
      </header>

      {proyectos.length === 0 ? (
        <Card>
          <EmptyState
            icon={FolderOpen}
            title="Todavía no hay proyectos"
            description="Un proyecto es una presentación a la COMAP. Creá uno para empezar a juntar los documentos y los comprobantes."
            action={puedeEditarProyectos && (
              <Button size="sm" onClick={() => setDialogo('nuevo')}><Plus size={14} /> Crear el primer proyecto</Button>
            )}
          />
        </Card>
      ) : (
        <>
          {/* Qué proyecto y qué período se está mirando */}
          <section aria-label="Proyecto y período" className="space-y-4">
            <div className="flex items-center gap-2">
              <div role="tablist" aria-label="Proyectos de la empresa" className="flex min-w-0 gap-1 overflow-x-auto">
                {proyectos.map((p) => {
                  const activo = p.id === proyecto?.id
                  return (
                    <button
                      key={p.id}
                      role="tab"
                      aria-selected={activo}
                      type="button"
                      onClick={() => elegir({ proyecto: p.id, periodo: null })}
                      className={cn(
                        'shrink-0 rounded-lg px-3.5 py-2 text-left transition-colors cursor-pointer',
                        activo ? 'bg-card shadow-sm ring-1 ring-border' : 'text-muted-foreground hover:bg-accent/60'
                      )}
                    >
                      <span className={cn('block text-sm', activo ? 'font-medium text-foreground' : '')}>{nombreProyecto(p)}</span>
                      <span className="block text-[12px] text-muted-foreground">
                        {p.duracion_seguimiento || 0} años de control
                      </span>
                    </button>
                  )
                })}
              </div>
              {puedeEditarProyectos && proyecto && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-9 shrink-0 text-muted-foreground"
                  onClick={() => setConfigurando(proyecto)}
                  aria-label="Configurar proyecto"
                  title="Configurar proyecto"
                >
                  <Settings size={16} />
                </Button>
              )}
            </div>

            <div className="flex items-center gap-3 overflow-x-auto">
              <span className="text-[13px] text-muted-foreground shrink-0">Período</span>
              <div className="inline-flex shrink-0 gap-0.5 rounded-lg bg-muted p-1">
                {periodos.map((p) => {
                  const activo = p === periodo
                  return (
                    <button
                      key={p}
                      type="button"
                      aria-pressed={activo}
                      onClick={() => elegir({ periodo: p === 'presentacion' ? null : p })}
                      className={cn(
                        'h-8 whitespace-nowrap rounded-md px-3 text-[13px] transition-colors cursor-pointer',
                        activo ? 'bg-card font-medium text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
                      )}
                    >
                      {etiquetaPeriodo(p, proyecto)}
                    </button>
                  )
                })}
              </div>
            </div>
          </section>

          {/* Los dos pasos y los accesos secundarios */}
          <section aria-label="Pasos" className="space-y-4">
            <div className="grid gap-5 md:grid-cols-2">
              <PasoCard
                to={`${base}/checklist`}
                paso={1}
                destacada={!checklistCompleto}
                badge={checklistCompleto
                  ? <Badge variant="success">Completo</Badge>
                  : <Badge>Empezá por acá</Badge>}
                titulo="Checklist de documentos"
                descripcion="Los papeles de la empresa que pide el Ministerio"
                progreso={<Progreso valor={listos} total={aplicables.length} className="bg-primary" />}
                resumen={!checklist ? 'Cargando...' : `${listos} de ${aplicables.length} listos`}
                detalle={siguiente && `Sigue: ${siguiente.descripcion}`}
              />
              <PasoCard
                to={conPeriodo()}
                paso={2}
                badge={revision.revisar > 0 && <Badge variant="warning">{revision.revisar} para revisar</Badge>}
                titulo="Comprobantes de inversión"
                descripcion="Facturas y presupuestos de lo que se invierte"
                progreso={<Progreso valor={revision.listo} total={revision.total} className="bg-warning" />}
                resumen={revision.total === 0 ? 'Todavía no hay comprobantes' : `${revision.listo} de ${revision.total} listos`}
                detalle={revision.sin_archivo > 0 && `${revision.sin_archivo} sin PDF`}
              />
            </div>
            <div className="flex flex-wrap gap-x-6 gap-y-2 px-1 text-sm">
              <Link to={conPeriodo({ vista: 'plan' })} className="group inline-flex items-center gap-1.5 text-muted-foreground hover:text-foreground">
                Plan de ejecución
                <ArrowRight size={14} className="text-primary transition-transform group-hover:translate-x-0.5" aria-hidden="true" />
              </Link>
              <button type="button" onClick={() => setDialogo('simulador')} className="group inline-flex items-center gap-1.5 text-muted-foreground hover:text-foreground cursor-pointer">
                Simulador de beneficios
                <ArrowRight size={14} className="text-primary transition-transform group-hover:translate-x-0.5" aria-hidden="true" />
              </button>
            </div>
          </section>

          {/* Resumen de la inversión */}
          <section aria-labelledby="t-resumen" className="space-y-4">
            <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
              <h2 id="t-resumen" className="text-base font-medium">Resumen de la inversión</h2>
              <span className="text-[12px] text-muted-foreground" title="UI = Unidades Indexadas, la unidad que usa la COMAP">
                {etiquetaPeriodo(periodo, proyecto)}{cotizacion && ` · en UI, cotización del ${fmtFecha(cotizacion.fecha)}`}
              </span>
            </div>
            {resumen ? (
              <ResumenInversion resumen={resumen} onCategoria={(cat) => navigate(conPeriodo({ categoria: cat }))} />
            ) : (
              <Card className="px-4 py-10 text-center text-[13px] text-muted-foreground">
                {revision.total === 0
                  ? 'Cuando cargues comprobantes vas a ver acá cuánto se invierte, por año y por categoría.'
                  : 'No pudimos traer la cotización del BCU, así que no podemos pasar los montos a UI. Probá más tarde.'}
              </Card>
            )}
          </section>
        </>
      )}

      <DatosEmpresaDialog
        open={dialogo === 'datos'}
        onClose={() => setDialogo(null)}
        empresa={empresa}
        puedeEditar={puedeEditarEmpresa}
        onGuardado={(e) => { setEmpresa(e); avisarCambio('empresas') }}
      />
      <NuevoProyectoDialog
        open={dialogo === 'nuevo'}
        onClose={() => setDialogo(null)}
        empresaId={empresaId}
        onCreado={(id) => {
          avisarCambio('proyectos', empresaId)
          cargarProyectos().then(() => elegir({ proyecto: id, periodo: null }))
        }}
      />
      <ConfigurarProyectoDialog
        proyecto={configurando}
        onClose={() => setConfigurando(null)}
        empresaId={empresaId}
        onGuardado={(p) => {
          setProyectos((prev) => prev.map((x) => (x.id === p.id ? p : x)))
          avisarCambio('proyectos', empresaId)
        }}
      />
      {isMaster && (
        <EliminarEmpresaDialog
          empresa={empresa}
          open={dialogo === 'eliminar'}
          onClose={() => setDialogo(null)}
          onEliminada={() => {
            avisarCambio('empresas')
            navigate('/empresas', { replace: true })
          }}
        />
      )}
      {proyecto && (
        <SimuladorDialog
          open={dialogo === 'simulador'}
          onClose={() => setDialogo(null)}
          empresaId={empresaId}
          proyectoId={proyecto.id}
          puedeEditar={puedeEscribir(empresaId, 'simulador')}
        />
      )}
    </div>
  )
}
