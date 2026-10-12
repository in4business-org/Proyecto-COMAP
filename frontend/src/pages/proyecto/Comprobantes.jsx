import { useEffect, useMemo, useState } from 'react'
import { cn } from '@/lib/utils'
import { cotizaciones as cotApi, facturas as factApi } from '@/lib/api'
import { anioDe } from '@/lib/fechas'
import { calcularResumen } from '@/lib/inversion'
import { etiquetaPeriodo } from '@/lib/proyecto'
import { useAuth } from '../../context/AuthContext'
import { useComprobantes } from './useComprobantes'
import { ResumenInversion } from './ResumenInversion'
import { PlanEjecucion } from './PlanEjecucion'
import { CargaArchivos } from './CargaArchivos'
import { TablaComprobantes } from './TablaComprobantes'
import { columnasDelPlan, opcionesDeEjercicio } from './plan'

const tabClass = (activa) => cn(
  'px-4 py-2 text-[12px] font-medium rounded-t-md border border-b-0 transition-all duration-150 whitespace-nowrap',
  activa
    ? 'border-border/60 bg-background text-foreground -mb-px'
    : 'border-transparent text-muted-foreground hover:text-foreground hover:border-border/40 hover:bg-card/60'
)

/** Comprobantes de inversión de un proyecto: resumen, plan de ejecución y tabla */
export function Comprobantes({ empresaId, proyectoId, periodos, proyecto, empresa }) {
  // Cosmético: el backend rechaza igual con 403 si alguien fuerza la llamada
  const { puedeEscribir } = useAuth()
  const puedeEditar = puedeEscribir(empresaId, 'facturas')
  const [periodo, setPeriodo] = useState('presentacion')
  const [vista, setVista] = useState('list')
  const [cotizacion, setCotizacion] = useState(null)
  const [cargandoCotizacion, setCargandoCotizacion] = useState(true)
  const [planPendiente, setPlanPendiente] = useState(false)
  const [planGuardando, setPlanGuardando] = useState(false)

  const { comprobantes, setComprobantes, cargando, aplicar } =
    useComprobantes(empresaId, proyectoId, periodos, periodo)

  // Cotización del mes anterior a la presentación (o a hoy si no hay fecha)
  useEffect(() => {
    cotApi.getMesAnterior(proyecto?.fecha_presentacion || null)
      .then(setCotizacion)
      .catch(() => setCotizacion(null))
      .finally(() => setCargandoCotizacion(false))
  }, [proyecto?.fecha_presentacion])

  const resumen = useMemo(() => calcularResumen(comprobantes, cotizacion, anioDe), [comprobantes, cotizacion])

  const anioBase = proyecto?.anio_presentacion ? parseInt(proyecto.anio_presentacion) : new Date().getFullYear()
  const columnas = useMemo(() => columnasDelPlan(periodos, anioBase), [periodos, anioBase])
  const opcionesEjercicio = useMemo(() => opcionesDeEjercicio(columnas, anioBase), [columnas, anioBase])
  const periodoLabel = periodo === 'presentacion' ? 'Presentación' : etiquetaPeriodo(periodo)

  const moverEnPlan = (id, anio) => {
    if (!comprobantes) return
    setComprobantes(prev => prev.map(r => (r.id === id ? { ...r, fecha_ejecucion: `01/01/${anio}` } : r)))
    setPlanPendiente(true)
  }

  const guardarPlan = async () => {
    if (!comprobantes || planGuardando) return
    setPlanGuardando(true)
    try {
      aplicar(await factApi.updateResults(empresaId, proyectoId, periodo, comprobantes))
      setPlanPendiente(false)
    } catch (err) { console.error(err) }
    finally { setPlanGuardando(false) }
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center gap-0.5 border-b border-border/60">
        {periodos.map(p => (
          <button key={p} onClick={() => setPeriodo(p)} className={tabClass(periodo === p)}>
            {etiquetaPeriodo(p, proyecto)}
          </button>
        ))}
      </div>

      <ResumenInversion resumen={resumen} periodoLabel={periodoLabel} />

      <div className="flex items-center gap-0.5 border-b border-border/60">
        {[{ key: 'list', label: 'Comprobantes' }, { key: 'plan', label: 'Plan de ejecución' }].map(v => (
          <button key={v.key} onClick={() => setVista(v.key)} className={tabClass(vista === v.key)}>
            {v.label}
          </button>
        ))}
      </div>

      {vista === 'plan' && (
        <PlanEjecucion
          comprobantes={comprobantes}
          cargando={cargando}
          columnas={columnas}
          anioBase={anioBase}
          periodoLabel={periodoLabel}
          puedeEditar={puedeEditar}
          pendiente={planPendiente}
          guardando={planGuardando}
          onMover={moverEnPlan}
          onGuardar={guardarPlan}
        />
      )}

      {vista === 'list' && (
        <div className="grid grid-cols-1 gap-6">
          <CargaArchivos
            empresaId={empresaId}
            proyectoId={proyectoId}
            periodo={periodo}
            periodoLabel={periodoLabel}
            puedeEditar={puedeEditar}
            cantidadActual={comprobantes?.length || 0}
            onActualizar={aplicar}
          />
          <TablaComprobantes
            empresaId={empresaId}
            proyectoId={proyectoId}
            periodo={periodo}
            empresa={empresa}
            comprobantes={comprobantes}
            cargando={cargando}
            cotizacion={cotizacion}
            cargandoCotizacion={cargandoCotizacion}
            puedeEditar={puedeEditar}
            anioBase={anioBase}
            opcionesEjercicio={opcionesEjercicio}
            onActualizar={aplicar}
          />
        </div>
      )}
    </div>
  )
}
