import { useEffect, useMemo, useState } from 'react'
import { useParams, Link, useSearchParams, Navigate } from 'react-router-dom'
import { ArrowLeft, CheckSquare } from 'lucide-react'
import { LoadingState } from '@/components/ui/loading'
import { empresas as empApi, proyectos as projApi } from '@/lib/api'
import { fmtFecha } from '@/lib/fechas'
import { periodosDeProyecto } from '@/lib/proyecto'
import { Comprobantes } from './proyecto/Comprobantes'

export default function ProyectoDetail() {
  const { empresaId, proyectoId } = useParams()
  // La pantalla de empresa entra con ?periodo=, ?vista=plan o ?categoria=
  const [params, setParams] = useSearchParams()
  const [empresa, setEmpresa] = useState(null)
  const [meta, setMeta] = useState(null)
  const [loading, setLoading] = useState(true)

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

  // El checklist antes era un panel lateral: los links viejos van a su pantalla
  if (params.get('checklist') === '1') return <Navigate to={`/empresas/${empresaId}/proyectos/${proyectoId}/checklist`} replace />
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
          <Link
            to={`/empresas/${empresaId}/proyectos/${proyectoId}/checklist`}
            className="flex items-center gap-2 px-3 h-9 rounded-lg border border-border/60 bg-card hover:bg-accent hover:border-primary/40 transition-all text-[12px] font-medium text-muted-foreground hover:text-foreground shrink-0"
          >
            <CheckSquare size={14} strokeWidth={2} />
            Checklist
          </Link>
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

    </>
  )
}
