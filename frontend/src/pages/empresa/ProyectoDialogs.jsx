import { useEffect, useState } from 'react'
import { AlertCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input, Label } from '@/components/ui/input'
import { Spinner } from '@/components/ui/loading'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog'
import { proyectos as projApi } from '@/lib/api'
import { anioDe } from '@/lib/fechas'

function ErrorBox({ error }) {
  if (!error) return null
  return (
    <p role="alert" className="mb-4 flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-[13px] text-destructive">
      <AlertCircle size={15} className="shrink-0 mt-0.5" aria-hidden="true" />{error}
    </p>
  )
}

/** Fecha, año y años de control: los campos que comparten crear y configurar */
export function CamposProyecto({ form, setForm, idPrefijo }) {
  return (
    <div className="space-y-4">
      <div className="space-y-1.5">
        <Label htmlFor={`${idPrefijo}-fecha`}>Fecha de presentación</Label>
        <Input
          id={`${idPrefijo}-fecha`}
          type="date"
          value={form.fecha_presentacion || ''}
          onChange={(e) => {
            const fecha = e.target.value
            setForm((f) => ({ ...f, fecha_presentacion: fecha, anio_presentacion: anioDe(fecha) || f.anio_presentacion }))
          }}
        />
        <p className="text-[12px] text-muted-foreground">Si todavía no la sabés, dejala vacía y poné sólo el año.</p>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label htmlFor={`${idPrefijo}-anio`}>Año de presentación</Label>
          <Input
            id={`${idPrefijo}-anio`}
            type="number"
            inputMode="numeric"
            value={form.anio_presentacion ?? ''}
            onChange={(e) => setForm((f) => ({ ...f, anio_presentacion: e.target.value }))}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor={`${idPrefijo}-duracion`}>Años de control</Label>
          <Input
            id={`${idPrefijo}-duracion`}
            type="number"
            inputMode="numeric"
            min="0"
            max="10"
            value={form.duracion_seguimiento ?? ''}
            onChange={(e) => setForm((f) => ({ ...f, duracion_seguimiento: e.target.value }))}
          />
        </div>
      </div>
      <p className="text-[12px] text-muted-foreground">
        Después de presentar, cada año se controla lo que se invirtió. Lo habitual son entre 3 y 5 años.
      </p>
    </div>
  )
}

const proyectoVacio = () => ({ fecha_presentacion: '', anio_presentacion: new Date().getFullYear(), duracion_seguimiento: 5 })

/** Crear un proyecto. `onCreado(id)` recibe el id del proyecto nuevo. */
export function NuevoProyectoDialog({ open, onClose, empresaId, onCreado }) {
  const [form, setForm] = useState(proyectoVacio)
  const [creando, setCreando] = useState(false)
  const [error, setError] = useState(null)

  useEffect(() => { if (open) { setForm(proyectoVacio()); setError(null) } }, [open])

  const crear = async () => {
    const anio = parseInt(form.anio_presentacion)
    if (!anio) { setError('Poné el año de presentación'); return }
    setCreando(true)
    setError(null)
    try {
      const { proyecto_id } = await projApi.create(empresaId, anio, parseInt(form.duracion_seguimiento) || 0, form.fecha_presentacion || null)
      onCreado(proyecto_id)
      onClose()
    } catch (err) {
      setError(err.message)
    } finally {
      setCreando(false)
    }
  }

  return (
    <Dialog open={open} onClose={onClose}>
      <DialogContent onClose={onClose}>
        <DialogHeader>
          <DialogTitle>Nuevo proyecto</DialogTitle>
          <DialogDescription>Un proyecto es una presentación a la COMAP y sus años de control.</DialogDescription>
        </DialogHeader>
        <ErrorBox error={error} />
        <CamposProyecto form={form} setForm={setForm} idPrefijo="nuevo" />
        <DialogFooter>
          <Button variant="ghost" size="sm" onClick={onClose}>Cancelar</Button>
          <Button size="sm" onClick={crear} disabled={creando}>
            {creando ? <><Spinner size={14} className="text-primary-foreground" /> Creando...</> : 'Crear proyecto'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

/** Cambiar fechas, años de control y número de expediente de un proyecto */
export function ConfigurarProyectoDialog({ proyecto, onClose, empresaId, onGuardado }) {
  const [form, setForm] = useState({})
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState(null)

  useEffect(() => {
    if (!proyecto) return
    setForm({
      fecha_presentacion: proyecto.fecha_presentacion || '',
      anio_presentacion: proyecto.anio_presentacion ?? '',
      duracion_seguimiento: proyecto.duracion_seguimiento ?? 1,
      expediente: proyecto.expediente || '',
    })
    setError(null)
  }, [proyecto])

  const guardar = async () => {
    setGuardando(true)
    setError(null)
    try {
      const datos = {
        fecha_presentacion: form.fecha_presentacion || null,
        anio_presentacion: form.anio_presentacion ? Number(form.anio_presentacion) : null,
        duracion_seguimiento: Number(form.duracion_seguimiento) || 0,
      }
      const expediente = form.expediente.trim() || null
      await Promise.all([
        projApi.updateMetadata(empresaId, proyecto.id, datos),
        expediente !== (proyecto.expediente || null)
          ? projApi.updateExpediente(empresaId, proyecto.id, expediente)
          : null,
      ])
      onGuardado({ ...proyecto, ...datos, expediente })
      onClose()
    } catch (err) {
      setError(err.message)
    } finally {
      setGuardando(false)
    }
  }

  return (
    <Dialog open={!!proyecto} onClose={onClose}>
      <DialogContent onClose={onClose}>
        <DialogHeader>
          <DialogTitle>Configurar proyecto</DialogTitle>
        </DialogHeader>
        <ErrorBox error={error} />
        <div className="space-y-4">
          <CamposProyecto form={form} setForm={setForm} idPrefijo="config" />
          <div className="space-y-1.5">
            <Label htmlFor="config-expediente">Número de expediente</Label>
            <Input
              id="config-expediente"
              value={form.expediente || ''}
              onChange={(e) => setForm((f) => ({ ...f, expediente: e.target.value }))}
              placeholder="Lo da el Ministerio al presentar"
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" size="sm" onClick={onClose}>Cancelar</Button>
          <Button size="sm" onClick={guardar} disabled={guardando}>
            {guardando ? <><Spinner size={14} className="text-primary-foreground" /> Guardando...</> : 'Guardar'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
