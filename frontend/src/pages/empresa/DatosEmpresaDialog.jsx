import { useEffect, useState } from 'react'
import { AlertCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input, Label } from '@/components/ui/input'
import { Spinner } from '@/components/ui/loading'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog'
import { cn } from '@/lib/utils'
import { empresas as empApi } from '@/lib/api'
import { CAMPOS_EMPRESA, TIPOS_CONTRIBUYENTE } from '@/lib/empresa'

const GRUPOS = [
  { id: 'quien', titulo: 'Quién es' },
  { id: 'contacto', titulo: 'Contacto' },
  { id: 'actividad', titulo: 'Actividad' },
]

/** Opciones de tipo de contribuyente como botones de radio */
export function OpcionesContribuyente({ value, onChange, disabled, name = 'tipo_contribuyente' }) {
  // Un valor viejo cargado a mano que no está en la lista se sigue mostrando
  const opciones = value && !TIPOS_CONTRIBUYENTE.includes(value) ? [...TIPOS_CONTRIBUYENTE, value] : TIPOS_CONTRIBUYENTE
  return (
    <div className="flex flex-wrap gap-2">
      {opciones.map((op) => {
        const activa = value === op
        return (
          <label
            key={op}
            className={cn(
              'flex items-center gap-2 h-10 px-3.5 rounded-lg border text-sm cursor-pointer transition-colors',
              activa ? 'border-primary bg-accent font-medium' : 'border-input bg-background hover:bg-accent/50',
              disabled && 'opacity-60 cursor-not-allowed'
            )}
          >
            <input
              type="radio"
              name={name}
              checked={activa}
              disabled={disabled}
              onChange={() => onChange(op)}
              className="accent-primary"
            />
            {op}
          </label>
        )
      })}
    </div>
  )
}

/** Ver y editar los datos de la empresa */
export function DatosEmpresaDialog({ open, onClose, empresa, puedeEditar, onGuardado }) {
  const [form, setForm] = useState({})
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState(null)

  useEffect(() => {
    if (open) { setForm(empresa || {}); setError(null) }
  }, [open, empresa])

  const cambios = CAMPOS_EMPRESA.some(({ key }) => (form[key] ?? '') !== (empresa?.[key] ?? ''))

  const guardar = async () => {
    if (!String(form.nombre || '').trim()) { setError('El nombre no puede quedar vacío'); return }
    setGuardando(true)
    setError(null)
    try {
      const datos = Object.fromEntries(CAMPOS_EMPRESA.filter((c) => !c.readonly).map(({ key }) => [key, form[key] ?? null]))
      await empApi.update(empresa.id, datos)
      onGuardado({ ...empresa, ...datos })
      onClose()
    } catch (err) {
      setError(err.message)
    } finally {
      setGuardando(false)
    }
  }

  return (
    <Dialog open={open} onClose={onClose}>
      <DialogContent onClose={onClose}>
        <DialogHeader>
          <DialogTitle>Datos de la empresa</DialogTitle>
          <DialogDescription>
            {puedeEditar
              ? 'Se usan para armar la presentación. Podés completarlos de a poco.'
              : 'Tenés acceso de sólo lectura a estos datos.'}
          </DialogDescription>
        </DialogHeader>

        {error && (
          <p role="alert" className="mb-4 flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-[13px] text-destructive">
            <AlertCircle size={15} className="shrink-0 mt-0.5" aria-hidden="true" />{error}
          </p>
        )}

        <div className="space-y-6">
          {GRUPOS.map((g) => (
            <fieldset key={g.id} className="space-y-4">
              <legend className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground mb-3">{g.titulo}</legend>
              {CAMPOS_EMPRESA.filter((c) => c.grupo === g.id).map(({ key, label, tipo, readonly, ayuda }) => (
                <div key={key} className="space-y-1.5">
                  {tipo === 'opciones' ? (
                    <>
                      <p className="text-sm font-medium">{label}</p>
                      <OpcionesContribuyente
                        value={form[key] || ''}
                        disabled={!puedeEditar}
                        onChange={(v) => setForm((f) => ({ ...f, [key]: v }))}
                      />
                    </>
                  ) : (
                    <>
                      <Label htmlFor={`emp-${key}`}>{label}</Label>
                      <Input
                        id={`emp-${key}`}
                        type={tipo || 'text'}
                        readOnly={readonly || !puedeEditar}
                        value={form[key] || ''}
                        onChange={(e) => setForm((f) => ({ ...f, [key]: e.target.value }))}
                        className={cn((readonly || !puedeEditar) && 'bg-muted text-muted-foreground', key === 'rut' && 'font-mono')}
                      />
                    </>
                  )}
                  {ayuda && <p className="text-[12px] text-muted-foreground">{ayuda}</p>}
                </div>
              ))}
            </fieldset>
          ))}
        </div>

        <DialogFooter>
          <Button variant="ghost" size="sm" onClick={onClose}>{puedeEditar ? 'Cancelar' : 'Cerrar'}</Button>
          {puedeEditar && (
            <Button size="sm" onClick={guardar} disabled={guardando || !cambios}>
              {guardando ? <><Spinner size={14} className="text-primary-foreground" /> Guardando...</> : 'Guardar'}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
