import { Link } from 'react-router-dom'
import { Lock } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'

function Barra({ valor, total, className }) {
  const pct = total > 0 ? Math.round((valor / total) * 100) : 0
  return (
    <div className="h-1.5 rounded-full bg-muted overflow-hidden" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}>
      <div className={cn('h-full rounded-full transition-all', className)} style={{ width: `${pct}%` }} />
    </div>
  )
}

function Paso({ to, numero, titulo, badge, actual, children }) {
  const Comp = to ? Link : 'div'
  return (
    <Comp
      to={to}
      aria-current={actual ? 'step' : undefined}
      className={cn(
        'flex flex-col gap-2.5 rounded-xl border bg-card p-4 shadow-sm transition-colors',
        actual ? 'border-primary' : 'border-border',
        to && !actual && 'hover:border-primary/50',
        !to && 'bg-muted/40 shadow-none'
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">Paso {numero}</span>
        {badge}
      </div>
      <span className="text-[15px] font-medium">{titulo}</span>
      {children}
    </Comp>
  )
}

/**
 * Los tres pasos de un proyecto: documentos, comprobantes y presentar.
 * `checklist` sale de resumenChecklist y `comprobantes` de revisarComprobantes().totales.
 */
export function PasosProyecto({ base, actual, checklist, comprobantes }) {
  const docsCompletos = checklist?.completo
  const compCompletos = comprobantes && comprobantes.total > 0 && comprobantes.listo === comprobantes.total

  return (
    <nav aria-label="Pasos del proyecto" className="grid gap-3 md:grid-cols-3">
      <Paso
        to={actual === 'checklist' ? undefined : `${base}/checklist`}
        actual={actual === 'checklist'}
        numero={1}
        titulo="Documentos de la empresa"
        badge={docsCompletos ? <Badge variant="success">Completo</Badge> : <Badge>En curso</Badge>}
      >
        <Barra valor={checklist?.listos || 0} total={checklist?.aplican || 0} className="bg-primary" />
        <span className="text-[12px] text-muted-foreground line-clamp-1">
          {checklist
            ? `${checklist.listos} de ${checklist.aplican} listos${checklist.siguiente ? ` · sigue: ${checklist.siguiente.descripcion}` : ''}`
            : 'Cargando...'}
        </span>
      </Paso>
      <Paso
        to={actual === 'comprobantes' ? undefined : base}
        actual={actual === 'comprobantes'}
        numero={2}
        titulo="Comprobantes de inversión"
        badge={comprobantes?.revisar > 0
          ? <Badge variant="warning">{comprobantes.revisar} para revisar</Badge>
          : compCompletos ? <Badge variant="success">Completo</Badge> : null}
      >
        <Barra valor={comprobantes?.listo || 0} total={comprobantes?.total || 0} className="bg-warning" />
        <span className="text-[12px] text-muted-foreground">
          {!comprobantes
            ? 'Cargando...'
            : comprobantes.total === 0
              ? 'Todavía no hay comprobantes'
              : `${comprobantes.total} cargados · ${comprobantes.listo} listos${comprobantes.sin_archivo ? ` · ${comprobantes.sin_archivo} sin archivo` : ''}`}
        </span>
      </Paso>
      <Paso
        numero={3}
        titulo="Presentar al Ministerio"
        badge={docsCompletos && compCompletos
          ? <Badge variant="success">Listo para presentar</Badge>
          : <Badge variant="secondary" className="gap-1"><Lock size={11} aria-hidden="true" /> Falta</Badge>}
      >
        <span className="text-[12px] text-muted-foreground">
          {docsCompletos && compCompletos
            ? 'Los documentos y los comprobantes están completos: ya se puede presentar en VUCE.'
            : 'Cuando los pasos 1 y 2 estén completos, ya se puede presentar en VUCE.'}
        </span>
      </Paso>
    </nav>
  )
}
