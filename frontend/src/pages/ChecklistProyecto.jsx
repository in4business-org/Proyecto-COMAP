import { useMemo, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { AlertCircle, ArrowLeft, Settings, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { LoadingState } from '@/components/ui/loading'
import { PasosProyecto } from '@/components/proyecto/PasosProyecto'
import { cn } from '@/lib/utils'
import { periodosDeProyecto } from '@/lib/proyecto'
import { revisarComprobantes } from '@/lib/revision'
import { useAuth } from '../context/AuthContext'
import { useProyecto } from './proyecto/useProyecto'
import { useComprobantes } from './proyecto/useComprobantes'
import { useChecklist, resumenChecklist } from './checklist/useChecklist'
import { AntesDeEmpezar } from './checklist/AntesDeEmpezar'
import { LoQueSigue } from './checklist/LoQueSigue'
import { SeccionChecklist } from './checklist/SeccionChecklist'
import { ConfigurarProyectoDialog } from './empresa/ProyectoDialogs'

const titulo = 'text-[11px] font-semibold uppercase tracking-widest text-muted-foreground'

/** Paso 1: el checklist de documentos de la presentación */
export default function ChecklistProyecto() {
  const { empresaId, proyectoId } = useParams()
  const { puedeEscribir } = useAuth()
  const puedeEditar = puedeEscribir(empresaId, 'checklist')
  const { empresa, proyecto, setProyecto, cargando } = useProyecto(empresaId, proyectoId)
  const { items, perfil, subiendo, error, setError, marcar, subir, bajar, responder } = useChecklist(empresaId, proyectoId)
  const [filtro, setFiltro] = useState('pendientes')
  const [salteados, setSalteados] = useState([])
  const [configurando, setConfigurando] = useState(false)

  const periodos = useMemo(() => periodosDeProyecto(proyecto), [proyecto])
  const { comprobantes } = useComprobantes(empresaId, proyecto?.id ? proyectoId : null, periodos, 'presentacion')
  const totalesComprobantes = useMemo(
    () => (comprobantes ? revisarComprobantes(comprobantes, empresa?.rut).totales : null),
    [comprobantes, empresa?.rut]
  )

  if (cargando || !items) return <LoadingState message="Cargando el checklist..." />

  const resumen = resumenChecklist(items)
  const base = `/empresas/${empresaId}/proyectos/${proyectoId}`
  const siguiente = items.find((i) => i.estado === 'pendiente' && !salteados.includes(i.id))
    || items.find((i) => i.estado === 'pendiente')

  const secciones = items.reduce((acc, item) => {
    const s = item.seccion || 'Otros'
    ;(acc[s] ||= []).push(item)
    return acc
  }, {})
  const visible = (i) => i.estado !== 'no_aplica' && (filtro === 'todos' || i.estado === 'pendiente')

  const acciones = {
    preguntas: perfil.preguntas,
    puedeEditar,
    subiendo,
    onSubir: subir,
    onMarcar: marcar,
    onBajar: bajar,
  }

  return (
    <div className="animate-fade-up space-y-6">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3 min-w-0">
          <Link to={`/empresas/${empresaId}?proyecto=${proyectoId}`} aria-label="Volver a la empresa" className="rounded-md p-1.5 text-muted-foreground hover:bg-accent hover:text-foreground transition-colors">
            <ArrowLeft size={16} />
          </Link>
          <div className="min-w-0">
            <h1 className="text-xl font-medium truncate">
              {empresa?.nombre} <span className="text-muted-foreground/40">•</span> Proyecto {proyecto?.anio_presentacion || ''}
            </h1>
            <p className="text-[13px] text-muted-foreground truncate">
              <span className="font-mono">{empresa?.rut}</span> · Presentación {proyecto?.anio_presentacion || '--'} · {proyecto?.duracion_seguimiento || 0} años de control
            </p>
          </div>
        </div>
        {puedeEscribir(empresaId, 'proyectos') && (
          <Button variant="outline" size="sm" onClick={() => setConfigurando(true)} className="self-start sm:self-auto">
            <Settings size={14} aria-hidden="true" /> Configurar proyecto
          </Button>
        )}
      </header>

      <PasosProyecto base={base} actual="checklist" checklist={resumen} comprobantes={totalesComprobantes} />

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_300px]">
        <section aria-labelledby="t-checklist" className="space-y-4 min-w-0">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 id="t-checklist" className={titulo}>Checklist de presentación</h2>
            <div role="group" aria-label="Mostrar" className="inline-flex rounded-lg border border-border bg-card p-0.5">
              {[['pendientes', `Pendientes (${resumen.pendientes})`], ['todos', `Todos (${resumen.aplican})`]].map(([v, l]) => (
                <button
                  key={v}
                  type="button"
                  aria-pressed={filtro === v}
                  onClick={() => setFiltro(v)}
                  className={cn(
                    'h-8 rounded-md px-3 text-[13px] font-medium transition-colors cursor-pointer',
                    filtro === v ? 'bg-accent text-foreground' : 'text-muted-foreground hover:text-foreground'
                  )}
                >
                  {l}
                </button>
              ))}
            </div>
          </div>

          {!puedeEditar && (
            <p className="rounded-lg border border-border bg-muted/40 px-4 py-2.5 text-[13px] text-muted-foreground">
              Podés ver el checklist pero no cambiarlo: tenés acceso de sólo lectura.
            </p>
          )}

          {error && (
            <p role="alert" className="flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-[13px] text-destructive">
              <AlertCircle size={15} className="mt-0.5 shrink-0" aria-hidden="true" />
              <span className="flex-1">{error}</span>
              <button type="button" onClick={() => setError(null)} aria-label="Cerrar el aviso" className="cursor-pointer"><X size={14} /></button>
            </p>
          )}

          <AntesDeEmpezar
            preguntas={perfil.preguntas}
            respuestas={perfil.respuestas}
            noAplican={items.filter((i) => i.no_aplica_por).length}
            puedeEditar={puedeEditar}
            onResponder={responder}
          />

          <LoQueSigue
            item={siguiente}
            subiendo={subiendo}
            puedeEditar={puedeEditar}
            onSubir={subir}
            onMarcar={marcar}
            onSaltear={(item) => setSalteados((s) => [...s.filter((x) => x !== item.id), item.id])}
            hrefPaso2={base}
          />

          {Object.entries(secciones).map(([nombre, its]) => (
            <SeccionChecklist key={nombre} nombre={nombre} items={its} visibles={its.filter(visible)} {...acciones} />
          ))}

          {filtro === 'pendientes' && resumen.pendientes === 0 && resumen.aplican > 0 && (
            <p className="text-center text-[13px] text-muted-foreground">
              No queda nada pendiente. Tocá <button type="button" onClick={() => setFiltro('todos')} className="font-medium text-primary underline underline-offset-2 cursor-pointer">Todos</button> para ver lo que ya se cargó.
            </p>
          )}
        </section>

        <aside className="space-y-3">
          <h2 className={titulo}>¿Qué es todo esto?</h2>
          <Card className="space-y-3 p-4 text-[13px] leading-relaxed text-muted-foreground">
            <p>
              La COMAP evalúa los proyectos de inversión para que la empresa acceda a beneficios fiscales.
              Para presentarlo hace falta juntar dos cosas: los documentos de la empresa y los comprobantes
              de lo que se invierte.
            </p>
            <p>Andá de a uno: arriba siempre está lo que sigue. Podés arrastrar el archivo directo arriba de cualquier documento de la lista.</p>
            <p>Si algo no le corresponde a la empresa, marcalo como que no aplica y deja de contar.</p>
          </Card>
        </aside>
      </div>

      <ConfigurarProyectoDialog
        proyecto={configurando ? proyecto : null}
        onClose={() => setConfigurando(false)}
        empresaId={empresaId}
        onGuardado={setProyecto}
      />
    </div>
  )
}
