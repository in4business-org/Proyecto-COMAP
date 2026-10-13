import { useEffect, useMemo, useState } from 'react'
import { useParams, Link, useSearchParams, useNavigate } from 'react-router-dom'
import {
  AlertTriangle, ArrowRight, ClipboardCheck, FolderOpen, Plus, ReceiptText, Settings, Trash2, Users,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card } from '@/components/ui/card'
import { LoadingState, EmptyState } from '@/components/ui/loading'
import { ResumenInversion } from '@/components/inversion/ResumenInversion'
import { cn } from '@/lib/utils'
import { empresas as empApi, proyectos as projApi, checklist as checkApi, cotizaciones as cotApi } from '@/lib/api'
import { anioDe } from '@/lib/fechas'
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

const titulo = 'text-[11px] font-semibold uppercase tracking-widest text-muted-foreground'

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
function PasoCard({ to, icono: Icono, iconoClass, badge, titulo: t, descripcion, progreso, resumen, destacada }) {
  return (
    <Link
      to={to}
      className={cn(
        'group flex flex-col gap-4 rounded-xl border bg-card p-5 shadow-sm transition-colors hover:border-primary/50',
        destacada ? 'border-primary/60' : 'border-border'
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <span className={cn('flex size-10 items-center justify-center rounded-lg', iconoClass)}>
          <Icono size={20} strokeWidth={1.8} aria-hidden="true" />
        </span>
        {badge}
      </div>
      <div>
        <h3 className="text-lg font-medium">{t}</h3>
        <p className="text-sm text-muted-foreground">{descripcion}</p>
      </div>
      <div className="mt-auto space-y-2.5">
        {progreso}
        <div className="flex items-end justify-between gap-2 text-[12px] text-muted-foreground">
          <span className="line-clamp-2">{resumen}</span>
          <span className="flex items-center gap-1 font-medium text-primary shrink-0">
            Abrir <ArrowRight size={13} className="transition-transform group-hover:translate-x-0.5" aria-hidden="true" />
          </span>
        </div>
      </div>
    </Link>
  )
}

/** Acceso secundario: plan de ejecución, simulador */
function AccesoSecundario({ titulo: t, descripcion, ...props }) {
  const Comp = props.to ? Link : 'button'
  return (
    <Comp
      type={props.to ? undefined : 'button'}
      {...props}
      className="flex w-full items-center justify-between gap-3 rounded-xl border border-border bg-card px-4 py-3.5 text-left shadow-sm transition-colors hover:border-primary/50 cursor-pointer"
    >
      <span>
        <span className="block text-sm font-medium">{t}</span>
        <span className="block text-[12px] text-muted-foreground">{descripcion}</span>
      </span>
      <ArrowRight size={14} className="text-primary shrink-0" aria-hidden="true" />
    </Comp>
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

  return (
    <div className="animate-fade-up space-y-7">
      {/* Encabezado */}
      <header className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3 min-w-0">
          <span className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-primary text-primary-foreground font-semibold">
            {iniciales(empresa.nombre)}
          </span>
          <div className="min-w-0">
            <h1 className="text-xl font-medium truncate">{empresa.nombre}</h1>
            <p className="text-[13px] text-muted-foreground truncate">
              <span className="font-mono">{empresa.rut}</span>
              {empresa.tipo_contribuyente && ` · ${empresa.tipo_contribuyente}`}
            </p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" onClick={() => setDialogo('datos')}>Datos de la empresa</Button>
          {isAdmin && (
            <Button variant="outline" size="sm" onClick={() => navigate('/admin')}>
              <Users size={14} aria-hidden="true" /> Personas con acceso
            </Button>
          )}
          {puedeEditarProyectos && (
            <Button size="sm" onClick={() => setDialogo('nuevo')}>
              <Plus size={14} aria-hidden="true" /> Nuevo proyecto
            </Button>
          )}
          {isMaster && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setDialogo('eliminar')}
              className="text-destructive hover:bg-destructive/10 hover:text-destructive"
            >
              <Trash2 size={14} aria-hidden="true" /> Eliminar empresa
            </Button>
          )}
        </div>
      </header>

      {/* Datos que faltan */}
      {faltan.length > 0 && (
        <div className="flex flex-col gap-2 rounded-xl border border-warning/40 bg-warning/10 px-4 py-3 sm:flex-row sm:items-center">
          <AlertTriangle size={16} className="text-warning shrink-0" aria-hidden="true" />
          <p className="flex-1 text-[13px]">
            Faltan datos de la empresa: <strong className="font-semibold">{faltan.join(', ')}</strong>. Se usan para presentar.
          </p>
          {puedeEditarEmpresa && (
            <button type="button" onClick={() => setDialogo('datos')} className="text-[13px] font-medium text-primary underline underline-offset-2 cursor-pointer self-start sm:self-auto">
              Completar
            </button>
          )}
        </div>
      )}

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
          {/* Proyectos */}
          <section aria-labelledby="t-proyectos" className="space-y-3">
            <div className="flex items-center justify-between gap-2">
              <h2 id="t-proyectos" className={titulo}>Proyectos</h2>
              {puedeEditarProyectos && proyecto && (
                <Button variant="ghost" size="sm" onClick={() => setConfigurando(proyecto)} className="h-8 text-[12px] text-muted-foreground">
                  <Settings size={13} aria-hidden="true" /> Configurar proyecto
                </Button>
              )}
            </div>
            <div role="tablist" aria-label="Proyectos de la empresa" className="flex gap-2 overflow-x-auto pb-1">
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
                      'shrink-0 rounded-xl border px-4 py-2.5 text-left transition-colors cursor-pointer',
                      activo ? 'border-primary bg-card shadow-sm' : 'border-border bg-card/50 hover:bg-card'
                    )}
                  >
                    <span className="block text-sm font-medium">{nombreProyecto(p)}</span>
                    <span className="block text-[12px] text-muted-foreground">
                      Presentación {p.anio_presentacion || 'sin año'} · {p.duracion_seguimiento || 0} años de control
                    </span>
                  </button>
                )
              })}
            </div>
          </section>

          {/* Períodos */}
          <Card className="flex flex-wrap items-center gap-2 px-4 py-3">
            <span className="text-[13px] text-muted-foreground mr-1">Período:</span>
            {periodos.map((p) => {
              const activo = p === periodo
              return (
                <button
                  key={p}
                  type="button"
                  aria-pressed={activo}
                  onClick={() => elegir({ periodo: p === 'presentacion' ? null : p })}
                  className={cn(
                    'rounded-md border px-2.5 py-1 text-[12px] font-medium transition-colors cursor-pointer',
                    activo ? 'border-primary/40 bg-primary/10 text-primary' : 'border-border text-muted-foreground hover:bg-accent'
                  )}
                >
                  {etiquetaPeriodo(p, proyecto)}
                </button>
              )
            })}
            <span className="w-full sm:w-auto sm:ml-auto text-[12px] text-muted-foreground">
              La presentación y cada año de control tienen sus propios comprobantes
            </span>
          </Card>

          {/* Accesos */}
          <section aria-label="Entrar a" className="grid gap-3 lg:grid-cols-[1fr_1fr_minmax(0,0.9fr)]">
            <PasoCard
              to={`${base}/checklist`}
              icono={ClipboardCheck}
              iconoClass="bg-accent text-primary"
              destacada={!checklistCompleto}
              badge={checklistCompleto
                ? <Badge variant="success">Completo</Badge>
                : <Badge>Empezá por acá</Badge>}
              titulo="1 · Checklist de documentos"
              descripcion="Los papeles de la empresa que pide el Ministerio"
              progreso={<Progreso valor={listos} total={aplicables.length} className="bg-primary" />}
              resumen={!checklist
                ? 'Cargando...'
                : `${listos} de ${aplicables.length} listos${siguiente ? ' · sigue: ' + siguiente.descripcion : ''}`}
            />
            <PasoCard
              to={conPeriodo()}
              icono={ReceiptText}
              iconoClass="bg-warning/15 text-warning"
              badge={revision.revisar > 0 && <Badge variant="warning">{revision.revisar} para revisar</Badge>}
              titulo="2 · Comprobantes de inversión"
              descripcion="Facturas y presupuestos de lo que se invierte"
              progreso={<Progreso valor={revision.listo} total={revision.total} className="bg-warning" />}
              resumen={revision.total === 0
                ? 'Todavía no hay comprobantes cargados'
                : `${revision.total} cargados · ${revision.listo} listos${revision.sin_archivo ? ` · ${revision.sin_archivo} sin archivo` : ''}`}
            />
            <div className="flex flex-col gap-3">
              <AccesoSecundario to={conPeriodo({ vista: 'plan' })} titulo="Plan de ejecución" descripcion="Qué se invierte en cada año" />
              <AccesoSecundario onClick={() => setDialogo('simulador')} titulo="Simulador de beneficios" descripcion="Cuánto podría exonerar la empresa" />
            </div>
          </section>

          {/* Resumen de la inversión */}
          <section aria-labelledby="t-resumen" className="space-y-3">
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <h2 id="t-resumen" className={titulo}>Resumen de la inversión · {etiquetaPeriodo(periodo, proyecto)}</h2>
              {cotizacion && (
                <span className="text-[12px] text-muted-foreground" title="UI = Unidades Indexadas, la unidad que usa la COMAP">
                  En UI · cotización al {cotizacion.fecha}
                </span>
              )}
            </div>
            {resumen ? (
              <ResumenInversion resumen={resumen} onCategoria={(cat) => navigate(conPeriodo({ categoria: cat }))} />
            ) : (
              <Card className="px-4 py-8 text-center text-[13px] text-muted-foreground">
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
