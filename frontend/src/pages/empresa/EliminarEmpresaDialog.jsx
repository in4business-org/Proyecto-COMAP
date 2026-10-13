import { useEffect, useState } from 'react'
import { AlertCircle, AlertTriangle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input, Label } from '@/components/ui/input'
import { Spinner } from '@/components/ui/loading'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog'
import { empresas as empApi } from '@/lib/api'

const plural = (n, uno, varios) => `${n} ${n === 1 ? uno : varios}`

/**
 * Confirmación para borrar una empresa. Muestra lo que se pierde y pide
 * escribir el nombre, igual que al eliminar un usuario.
 */
export function EliminarEmpresaDialog({ empresa, open, onClose, onEliminada }) {
  const [resumen, setResumen] = useState(null)
  const [confirmacion, setConfirmacion] = useState('')
  const [borrando, setBorrando] = useState(false)
  const [error, setError] = useState(null)

  useEffect(() => {
    if (!open || !empresa) return
    setConfirmacion('')
    setError(null)
    setResumen(null)
    empApi.resumenBorrado(empresa.id).then(setResumen).catch(() => setResumen({}))
  }, [open, empresa])

  const coincide = confirmacion.trim() === empresa?.nombre?.trim()

  const borrar = async () => {
    setBorrando(true)
    setError(null)
    try {
      await empApi.eliminar(empresa.id)
      onEliminada()
    } catch (err) {
      setError(err.message)
    } finally {
      setBorrando(false)
    }
  }

  return (
    <Dialog open={open} onClose={onClose}>
      <DialogContent onClose={onClose}>
        <DialogHeader>
          <DialogTitle>Eliminar {empresa?.nombre}</DialogTitle>
          <DialogDescription>Se borra para siempre y no se puede deshacer.</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="rounded-lg border border-destructive/30 bg-destructive/10 px-3.5 py-3 text-[13px]">
            <p className="flex items-center gap-1.5 font-semibold text-destructive">
              <AlertTriangle size={14} aria-hidden="true" /> Se pierde
            </p>
            {!resumen ? (
              <p className="mt-1.5 flex items-center gap-2 text-muted-foreground"><Spinner size={13} /> Contando...</p>
            ) : resumen.proyectos == null ? (
              <p className="mt-1.5">Todos sus proyectos, comprobantes y documentos.</p>
            ) : (
              <ul className="mt-1.5 list-disc space-y-0.5 pl-5">
                <li>{plural(resumen.proyectos, 'proyecto', 'proyectos')}</li>
                <li>{plural(resumen.comprobantes, 'comprobante', 'comprobantes')}</li>
                <li>{plural(resumen.documentos, 'documento del checklist', 'documentos del checklist')}</li>
                <li>El acceso de {plural(resumen.personas, 'persona', 'personas')} a esta empresa (sus cuentas siguen)</li>
              </ul>
            )}
          </div>

          {error && (
            <p role="alert" className="flex items-start gap-2 text-[13px] text-destructive">
              <AlertCircle size={15} className="mt-0.5 shrink-0" aria-hidden="true" />{error}
            </p>
          )}

          <div className="space-y-1.5">
            <Label htmlFor="borrar-confirmar">
              Escribí «<span className="font-semibold">{empresa?.nombre}</span>» para confirmar
            </Label>
            <Input id="borrar-confirmar" value={confirmacion} onChange={(e) => setConfirmacion(e.target.value)} autoComplete="off" />
          </div>
        </div>

        <DialogFooter>
          <Button variant="ghost" size="sm" onClick={onClose}>Cancelar</Button>
          <Button variant="destructive" size="sm" disabled={!coincide || borrando} onClick={borrar}>
            {borrando ? <><Spinner size={14} className="text-destructive-foreground" /> Eliminando...</> : 'Eliminar definitivamente'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
