import { useEffect, useMemo, useState } from 'react'
import { useParams, Link, useSearchParams } from 'react-router-dom'
import { ArrowLeft, CheckSquare, X } from 'lucide-react'
import { LoadingState } from '@/components/ui/loading'
import { cn } from '@/lib/utils'
import { empresas as empApi, proyectos as projApi } from '@/lib/api'
import { fmtFecha } from '@/lib/fechas'
import { periodosDeProyecto } from '@/lib/proyecto'
import { Comprobantes } from './proyecto/Comprobantes'
import { ChecklistPanel } from './proyecto/ChecklistPanel'

export default function ProyectoDetail() {
  const { empresaId, proyectoId } = useParams()
  // La pantalla de empresa entra con ?checklist=1, ?periodo=, ?vista=plan o ?categoria=
  const [params, setParams] = useSearchParams()
  const [empresa, setEmpresa] = useState(null)
  const [meta, setMeta] = useState(null)
  const [loading, setLoading] = useState(true)
  const [checklistOpen, setChecklistOpen] = useState(params.get('checklist') === '1')
  const [checklistPendientes, setChecklistPendientes] = useState(null)

  useEffect(() => {
    Promise.all([
      empApi.get(empresaId).catch(() => null),
      projApi.list(empresaId).catch(() => []),
    ]).then(([empData, projs]) => {
      setEmpresa(empData)
      setMeta(projs.find((x) => x.id === proyectoId) || {})
    }).finally(() => setLoading(false))
  }, [empresaId, proyectoId])

  const periodos = useMemo(() => periodosDeProyecto(meta), [meta])

  if (loading) return <LoadingState />

  const titulo = meta?.expediente || meta?.fecha_presentacion || (meta?.fecha_creacion ? fmtFecha(meta.fecha_creacion) : 'Sin fecha')

  return (
    <>
      <div className="animate-fade-up">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <Link to={`/empresas/${empresaId}`} aria-label="Volver a la empresa" className="rounded-md p-1.5 hover:bg-accent transition-colors text-muted-foreground hover:text-foreground">
              <ArrowLeft size={16} />
            </Link>
            <div className="flex flex-col">
              <h1 className="text-xl font-medium truncate flex items-center gap-2">
                {empresa?.nombre} <span className="text-muted-foreground/30">•</span> {titulo}
              </h1>
              <p className="text-[13px] text-muted-foreground mt-0.5">
                {empresa?.rut} · Presentación {meta?.anio_presentacion || '--'} {meta?.fecha_presentacion ? `· ${meta.fecha_presentacion}` : ''}
              </p>
            </div>
          </div>
          <button
            onClick={() => setChecklistOpen(o => !o)}
            className="flex items-center gap-2 px-3 h-9 rounded-lg border border-border/60 bg-card hover:bg-accent hover:border-primary/40 transition-all text-[12px] font-medium text-muted-foreground hover:text-foreground shrink-0"
          >
            <CheckSquare size={14} strokeWidth={2} />
            Checklist
            {checklistPendientes > 0 && (
              <span className="bg-warning/20 text-warning text-[10px] rounded-full px-1.5 py-0.5 font-semibold leading-none">
                {checklistPendientes}
              </span>
            )}
          </button>
        </div>

        <div className="pb-10">
          <Comprobantes
            empresaId={empresaId}
            proyectoId={proyectoId}
            periodos={periodos}
            proyecto={meta}
            empresa={empresa}
            periodoInicial={params.get('periodo') || 'presentacion'}
            vistaInicial={params.get('vista')}
            categoria={params.get('categoria')}
            onQuitarCategoria={() => {
              const next = new URLSearchParams(params)
              next.delete('categoria')
              setParams(next, { replace: true })
            }}
          />
        </div>
      </div>

      <div className={cn(
        'fixed top-0 right-0 h-screen w-[440px] z-50 bg-background border-l border-border shadow-2xl flex flex-col transition-transform duration-300',
        checklistOpen ? 'translate-x-0' : 'translate-x-full'
      )}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-border/60 shrink-0">
          <h2 className="text-[14px] font-semibold">Checklist presentación</h2>
          <button
            onClick={() => setChecklistOpen(false)}
            aria-label="Cerrar checklist"
            className="rounded-md p-1.5 hover:bg-accent transition-colors text-muted-foreground hover:text-foreground"
          >
            <X size={15} />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto">
          <ChecklistPanel empresaId={empresaId} proyectoId={proyectoId} onCountUpdate={setChecklistPendientes} />
        </div>
      </div>
    </>
  )
}
