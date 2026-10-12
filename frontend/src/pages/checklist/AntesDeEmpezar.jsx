import { useState } from 'react'
import { Badge } from '@/components/ui/badge'
import { Card } from '@/components/ui/card'
import { cn } from '@/lib/utils'

function SiNo({ valor, onChange, disabled, etiqueta }) {
  return (
    <div role="radiogroup" aria-label={etiqueta} className="inline-flex rounded-lg border border-border p-0.5 shrink-0">
      {[[true, 'Sí'], [false, 'No']].map(([v, l]) => (
        <button
          key={l}
          type="button"
          role="radio"
          aria-checked={valor === v}
          disabled={disabled}
          onClick={() => onChange(v)}
          className={cn(
            'h-8 min-w-11 rounded-md px-3 text-[13px] font-medium transition-colors cursor-pointer disabled:cursor-not-allowed',
            valor === v ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-accent'
          )}
        >
          {l}
        </button>
      ))}
    </div>
  )
}

/**
 * Preguntas sobre la empresa que dejan afuera los documentos que no
 * corresponden. Cada respuesta se guarda en el momento.
 */
export function AntesDeEmpezar({ preguntas, respuestas, noAplican, puedeEditar, onResponder }) {
  const respondidas = preguntas.filter((p) => typeof respuestas[p.id] === 'boolean').length
  const todas = preguntas.length > 0 && respondidas === preguntas.length
  const [editando, setEditando] = useState(false)
  const abierto = puedeEditar && (!todas || editando)

  if (!preguntas.length) return null

  return (
    <Card className="p-4 sm:p-5">
      <div className="flex flex-wrap items-start justify-between gap-2 mb-3">
        <h3 className="text-[15px] font-medium">Antes de empezar: {preguntas.length} preguntas sobre la empresa</h3>
        {todas
          ? <Badge variant="success">Respondidas{noAplican ? ` · ${noAplican} documento${noAplican !== 1 ? 's' : ''} no aplica${noAplican !== 1 ? 'n' : ''}` : ''}</Badge>
          : <Badge variant="warning">{respondidas} de {preguntas.length} respondidas</Badge>}
      </div>
      {!todas && (
        <p className="text-[13px] text-muted-foreground mb-3">
          Con estas respuestas dejamos afuera los documentos que no le corresponden a la empresa.
        </p>
      )}

      {abierto ? (
        <ul className="divide-y divide-border">
          {preguntas.map((p) => (
            <li key={p.id} className="flex items-center justify-between gap-3 py-2.5">
              <span className="text-[13px]">{p.texto}</span>
              <SiNo
                etiqueta={p.texto}
                valor={respuestas[p.id]}
                onChange={(v) => onResponder({ ...respuestas, [p.id]: v })}
              />
            </li>
          ))}
        </ul>
      ) : (
        <dl className="grid gap-x-8 sm:grid-cols-2">
          {preguntas.map((p) => (
            <div key={p.id} className="flex items-center justify-between gap-3 border-b border-border py-2 text-[13px]">
              <dt className="text-muted-foreground">{p.texto}</dt>
              <dd className="font-medium shrink-0">
                {respuestas[p.id] === true ? 'Sí' : respuestas[p.id] === false ? 'No' : 'Sin responder'}
              </dd>
            </div>
          ))}
        </dl>
      )}

      {puedeEditar && todas && (
        <button
          type="button"
          onClick={() => setEditando((e) => !e)}
          className="mt-3 text-[13px] font-medium text-primary underline underline-offset-2 cursor-pointer"
        >
          {editando ? 'Listo' : 'Cambiar respuestas'}
        </button>
      )}
    </Card>
  )
}
