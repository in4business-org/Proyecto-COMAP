import { Link } from 'react-router-dom'
import { CheckCircle2, ArrowRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Spinner } from '@/components/ui/loading'
import { ZonaArchivo } from '@/components/ZonaArchivo'

/**
 * Tarjeta con el primer documento pendiente y cómo cargarlo. Si todo está
 * listo, felicita y lleva al paso 2.
 */
export function LoQueSigue({ item, subiendo, puedeEditar, onSubir, onMarcar, onSaltear, hrefPaso2 }) {
  if (!item) {
    return (
      <Card className="flex flex-col items-start gap-3 border-success/40 bg-success/5 p-5 sm:flex-row sm:items-center">
        <CheckCircle2 size={28} className="text-success shrink-0" aria-hidden="true" />
        <div className="flex-1">
          <p className="text-[15px] font-medium">Están todos los documentos</p>
          <p className="text-[13px] text-muted-foreground">Ahora seguí con los comprobantes de lo que se invierte.</p>
        </div>
        <Link to={hrefPaso2}>
          <Button size="sm">Ir al paso 2 <ArrowRight size={14} aria-hidden="true" /></Button>
        </Link>
      </Card>
    )
  }

  return (
    <Card className="border-primary/50 bg-accent/30 p-4 sm:p-5">
      <div className="flex items-center justify-between gap-2">
        <span className="text-[11px] font-semibold uppercase tracking-widest text-primary">Lo que sigue</span>
        <span className="font-mono text-[11px] text-muted-foreground">{item.id}</span>
      </div>
      <h3 className="mt-1.5 text-[16px] font-medium leading-snug">{item.descripcion}</h3>
      {item.nota && <p className="mt-1 text-[13px] text-muted-foreground">{item.nota}</p>}

      {puedeEditar && (
        <div className="mt-4 space-y-3">
          {item.acepta_archivo ? (
            subiendo === item.id ? (
              <div className="flex items-center justify-center gap-2 rounded-xl border-[1.5px] border-dashed border-primary/50 py-8 text-sm text-primary">
                <Spinner size={16} className="text-primary" /> Subiendo...
              </div>
            ) : (
              <ZonaArchivo onArchivos={([f]) => onSubir(item, f)} />
            )
          ) : (
            <Button size="sm" onClick={() => onMarcar(item, 'completado')}>
              <CheckCircle2 size={14} aria-hidden="true" /> Ya está hecho
            </Button>
          )}
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" size="sm" onClick={() => onMarcar(item, 'no_aplica')}>No aplica a esta empresa</Button>
            <Button variant="ghost" size="sm" onClick={() => onSaltear(item)}>Saltear por ahora</Button>
          </div>
        </div>
      )}
    </Card>
  )
}
