import { useRef, useState } from 'react'
import { Upload } from 'lucide-react'
import { cn } from '@/lib/utils'
import { problemaArchivo } from '@/lib/archivos'

/**
 * Zona para soltar un archivo o elegirlo con un clic.
 *
 * - `onArchivos(files)` recibe los archivos que pasaron la validación
 * - `envolver`: en vez de dibujar la caja punteada, hace "soltable" a sus
 *   hijos (p. ej. una fila entera de la lista) y los resalta al arrastrar
 */
export function ZonaArchivo({
  onArchivos, multiple = false, disabled, tipos, maxMb = 10, envolver = false,
  titulo = 'Arrastrá el archivo acá o hacé clic para elegirlo', className, children, onError,
}) {
  const inputRef = useRef(null)
  const [encima, setEncima] = useState(false)
  const [error, setError] = useState(null)
  const profundidad = useRef(0)

  const recibir = (lista) => {
    const files = [...(lista || [])].slice(0, multiple ? undefined : 1)
    if (!files.length) return
    const problemas = files.map((f) => problemaArchivo(f, { tipos, maxMb })).filter(Boolean)
    const msg = problemas.length ? problemas.join('. ') : null
    setError(msg)
    onError?.(msg)
    const validos = files.filter((f) => !problemaArchivo(f, { tipos, maxMb }))
    if (validos.length) onArchivos(validos)
  }

  const eventos = disabled ? {} : {
    onDragEnter: (e) => { e.preventDefault(); profundidad.current++; setEncima(true) },
    onDragOver: (e) => { e.preventDefault(); e.dataTransfer.dropEffect = 'copy' },
    onDragLeave: () => { profundidad.current--; if (profundidad.current <= 0) { profundidad.current = 0; setEncima(false) } },
    onDrop: (e) => {
      e.preventDefault()
      profundidad.current = 0
      setEncima(false)
      recibir(e.dataTransfer.files)
    },
  }

  const accept = (tipos || ['pdf', 'jpg', 'jpeg', 'png']).map((t) => `.${t}`).join(',')
  const input = (
    <input
      ref={inputRef}
      type="file"
      className="hidden"
      accept={accept}
      multiple={multiple}
      disabled={disabled}
      onChange={(e) => { recibir(e.target.files); e.target.value = '' }}
    />
  )

  if (envolver) {
    return (
      <div {...eventos} className={cn('relative transition-colors', encima && 'bg-primary/5 ring-2 ring-inset ring-primary/40', className)}>
        {children({ elegir: () => inputRef.current?.click(), encima })}
        {input}
        {encima && (
          <span className="pointer-events-none absolute inset-0 flex items-center justify-center text-[13px] font-medium text-primary">
            Soltalo para subirlo
          </span>
        )}
      </div>
    )
  }

  const tiposTexto = (tipos || ['pdf', 'jpg', 'png']).filter((t) => t !== 'jpeg').map((t) => t.toUpperCase()).join(', ').replace(/, ([^,]*)$/, ' o $1')
  return (
    <div>
      <button
        type="button"
        disabled={disabled}
        onClick={() => inputRef.current?.click()}
        {...eventos}
        className={cn(
          'flex w-full flex-col items-center gap-1.5 rounded-xl border-[1.5px] border-dashed px-4 py-6 text-center transition-colors cursor-pointer',
          encima ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/50 hover:bg-accent/40',
          disabled && 'opacity-60 cursor-not-allowed',
          className
        )}
      >
        <Upload size={20} className="text-primary" aria-hidden="true" />
        <span className="text-sm font-medium text-primary">{encima ? 'Soltalo para subirlo' : titulo}</span>
        <span className="text-[12px] text-muted-foreground">{tiposTexto} · hasta {maxMb} MB</span>
      </button>
      {input}
      {error && <p role="alert" className="mt-2 text-[12px] text-destructive">{error}</p>}
    </div>
  )
}
