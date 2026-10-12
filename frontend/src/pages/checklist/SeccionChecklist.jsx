import { useState } from 'react'
import { CheckCircle2, Circle, Download, Upload, MinusCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Spinner } from '@/components/ui/loading'
import { ZonaArchivo } from '@/components/ZonaArchivo'
import { cn } from '@/lib/utils'

const nombreArchivo = (ruta) => String(ruta || '').split('/').pop()

function Icono({ estado }) {
  if (estado === 'completado') return <CheckCircle2 size={20} className="text-success" aria-label="Listo" />
  if (estado === 'no_aplica') return <MinusCircle size={20} className="text-muted-foreground" aria-label="No aplica" />
  return <Circle size={20} strokeDasharray="3 3" className="text-muted-foreground" aria-label="Pendiente" />
}

/** Texto debajo de la descripción: qué falta o qué se cargó */
function detalle(item, preguntas) {
  if (item.estado === 'no_aplica') {
    const p = preguntas.find((q) => q.id === item.no_aplica_por)
    return p ? `No aplica: respondiste que no a "${p.texto}"` : 'Marcado como que no aplica a esta empresa'
  }
  if (item.estado === 'completado') {
    return item.archivo ? nombreArchivo(item.archivo) : 'Marcado como hecho'
  }
  if (!item.acepta_archivo) return item.nota || 'Se hace fuera de la plataforma; marcalo cuando esté hecho'
  return item.nota ? `Falta subir el archivo · ${item.nota}` : 'Falta subir el archivo'
}

function ItemChecklist({ item, preguntas, puedeEditar, subiendo, onSubir, onMarcar, onBajar }) {
  const soltable = puedeEditar && item.acepta_archivo && item.estado !== 'no_aplica'
  const fila = ({ elegir } = {}) => (
    <div className="flex flex-wrap items-start gap-x-3 gap-y-2 px-4 py-3">
      <span className="mt-0.5 shrink-0"><Icono estado={item.estado} /></span>
      <span className="mt-1 w-7 shrink-0 font-mono text-[11px] text-muted-foreground">{item.id}</span>
      <div className="min-w-0 flex-1 basis-[calc(100%-5rem)] sm:basis-0">
        <p className={cn('text-[13px] leading-snug', item.estado === 'no_aplica' ? 'text-muted-foreground' : 'text-foreground')}>
          {item.descripcion}
        </p>
        <p className={cn('mt-0.5 text-[12px] break-words', item.estado === 'completado' && item.archivo ? 'text-success' : 'text-muted-foreground')}>
          {detalle(item, preguntas)}
        </p>
      </div>
      <div className="flex shrink-0 flex-wrap items-center gap-1.5 basis-full pl-[4.25rem] sm:basis-auto sm:pl-0 sm:justify-end">
        {subiendo === item.id && <Spinner size={16} className="text-primary" />}
        {item.archivo && item.estado === 'completado' && (
          <Button variant="outline" size="icon" className="size-9" onClick={() => onBajar(item)} aria-label={`Bajar ${nombreArchivo(item.archivo)}`}>
            <Download size={14} />
          </Button>
        )}
        {puedeEditar && item.estado === 'pendiente' && subiendo !== item.id && (
          item.acepta_archivo
            ? <Button variant="outline" size="sm" onClick={elegir}><Upload size={13} aria-hidden="true" /> Subir</Button>
            : <Button variant="outline" size="sm" onClick={() => onMarcar(item, 'completado')}>Ya está hecho</Button>
        )}
        {puedeEditar && item.estado === 'completado' && item.acepta_archivo && subiendo !== item.id && (
          <Button variant="ghost" size="sm" onClick={elegir} className="text-muted-foreground">Reemplazar</Button>
        )}
        {puedeEditar && item.estado === 'completado' && !item.acepta_archivo && (
          <Button variant="ghost" size="sm" onClick={() => onMarcar(item, 'pendiente')} className="text-muted-foreground">Deshacer</Button>
        )}
        {puedeEditar && item.estado === 'pendiente' && (
          <Button variant="ghost" size="sm" onClick={() => onMarcar(item, 'no_aplica')} className="text-muted-foreground">No aplica</Button>
        )}
        {puedeEditar && item.estado === 'no_aplica' && !item.no_aplica_por && (
          <Button variant="ghost" size="sm" onClick={() => onMarcar(item, 'pendiente')} className="text-muted-foreground">Sí aplica</Button>
        )}
      </div>
    </div>
  )

  if (!soltable) return <li>{fila()}</li>
  return (
    <li>
      <ZonaArchivo envolver onArchivos={([f]) => onSubir(item, f)}>
        {({ elegir }) => fila({ elegir })}
      </ZonaArchivo>
    </li>
  )
}

/**
 * Una sección del checklist. `visibles` son los ítems a mostrar según el
 * filtro; los que no aplican van plegados al final.
 */
export function SeccionChecklist({ nombre, items, visibles, preguntas, ...acciones }) {
  const [verNoAplican, setVerNoAplican] = useState(false)
  const aplican = items.filter((i) => i.estado !== 'no_aplica')
  const noAplican = items.filter((i) => i.estado === 'no_aplica')
  const listos = aplican.filter((i) => i.estado === 'completado').length

  if (!visibles.length && !noAplican.length) return null

  return (
    <Card className="overflow-hidden">
      <div className="flex items-center justify-between gap-2 border-b border-border bg-muted/40 px-4 py-2.5">
        <h3 className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">{nombre}</h3>
        <span className="text-[12px] text-muted-foreground shrink-0">{listos} de {aplican.length} listos</span>
      </div>
      {visibles.length > 0 ? (
        <ul className="divide-y divide-border">
          {visibles.map((item) => <ItemChecklist key={item.id} item={item} preguntas={preguntas} {...acciones} />)}
        </ul>
      ) : aplican.length > 0 && (
        <p className="px-4 py-3 text-[13px] text-muted-foreground">No queda nada pendiente en esta sección.</p>
      )}
      {noAplican.length > 0 && (
        <div className="border-t border-border">
          <button
            type="button"
            aria-expanded={verNoAplican}
            onClick={() => setVerNoAplican((v) => !v)}
            className="w-full px-4 py-2.5 text-left text-[12px] text-muted-foreground hover:bg-accent/50 cursor-pointer"
          >
            {noAplican.length} documento{noAplican.length !== 1 ? 's' : ''} no aplica{noAplican.length !== 1 ? 'n' : ''} a esta empresa · {verNoAplican ? 'Ocultar' : 'Ver'}
          </button>
          {verNoAplican && (
            <ul className="divide-y divide-border border-t border-border bg-muted/20">
              {noAplican.map((item) => <ItemChecklist key={item.id} item={item} preguntas={preguntas} {...acciones} />)}
            </ul>
          )}
        </div>
      )}
    </Card>
  )
}
