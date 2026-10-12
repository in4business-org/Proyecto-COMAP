import { useEffect, useRef, useState } from 'react'
import { AlertCircle, Download, Upload } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Spinner } from '@/components/ui/loading'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog'
import { simulador as simApi } from '@/lib/api'

const nf = new Intl.NumberFormat('es-UY', { maximumFractionDigits: 2 })
const fmt = (v) => (v == null || v === '' ? '--' : typeof v === 'number' ? nf.format(v) : String(v?.result ?? v))

const FILAS = [
  { key: 'puntaje_final', label: 'Puntaje' },
  { key: 'alcanza_minimo', label: '¿Llega al mínimo?' },
  { key: 'exoneracion_irae_pct', label: 'Exoneración de IRAE (%)' },
  { key: 'exoneracion_ui', label: 'Exoneración (UI)' },
  { key: 'plazo_exoneracion', label: 'Plazo de la exoneración' },
]

/**
 * Simulador de beneficios: se baja la planilla oficial, se completa en Excel y
 * se vuelve a subir; leemos el resultado de la hoja SIMULADOR.
 */
export function SimuladorDialog({ open, onClose, empresaId, proyectoId, puedeEditar }) {
  const inputRef = useRef(null)
  const [resultados, setResultados] = useState(null)
  const [cargando, setCargando] = useState(false)
  const [bajando, setBajando] = useState(false)
  const [subiendo, setSubiendo] = useState(false)
  const [error, setError] = useState(null)

  useEffect(() => {
    if (!open || !proyectoId) return
    setCargando(true)
    setError(null)
    simApi.results(empresaId, proyectoId)
      .then(setResultados)
      .catch(() => setResultados(null))
      .finally(() => setCargando(false))
  }, [open, empresaId, proyectoId])

  const bajar = async () => {
    setBajando(true)
    setError(null)
    try {
      const blob = await simApi.download(empresaId, proyectoId)
      const a = document.createElement('a')
      a.href = URL.createObjectURL(blob)
      a.download = 'Simulador_COMAP.xlsx'
      a.click()
    } catch (err) {
      setError(`No se pudo bajar la planilla: ${err.message}`)
    } finally {
      setBajando(false)
    }
  }

  const subir = async (file) => {
    if (!file) return
    setSubiendo(true)
    setError(null)
    try {
      const { resultados: r } = await simApi.upload(empresaId, proyectoId, file)
      setResultados(r)
    } catch (err) {
      setError(`No se pudo leer la planilla: ${err.message}`)
    } finally {
      setSubiendo(false)
      if (inputRef.current) inputRef.current.value = ''
    }
  }

  const hayResultados = resultados && Object.values(resultados).some((v) => v != null && v !== '')

  return (
    <Dialog open={open} onClose={onClose}>
      <DialogContent onClose={onClose}>
        <DialogHeader>
          <DialogTitle>Simulador de beneficios</DialogTitle>
          <DialogDescription>
            Calcula cuánto podría exonerar la empresa. Bajá la planilla, completala en Excel y subila acá para ver el resultado.
          </DialogDescription>
        </DialogHeader>

        {error && (
          <p role="alert" className="mb-4 flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-[13px] text-destructive">
            <AlertCircle size={15} className="shrink-0 mt-0.5" aria-hidden="true" />{error}
          </p>
        )}

        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" onClick={bajar} disabled={bajando}>
            {bajando ? <Spinner size={14} /> : <Download size={14} />} Bajar planilla
          </Button>
          {puedeEditar && (
            <>
              <input ref={inputRef} id="simulador-subir" type="file" accept=".xlsx" className="hidden" onChange={(e) => subir(e.target.files[0])} />
              <Button size="sm" onClick={() => inputRef.current?.click()} disabled={subiendo}>
                {subiendo ? <Spinner size={14} className="text-primary-foreground" /> : <Upload size={14} />} Subir planilla completa
              </Button>
            </>
          )}
        </div>

        <div className="mt-5 rounded-lg border border-border">
          {cargando ? (
            <div className="py-8 flex justify-center"><Spinner /></div>
          ) : hayResultados ? (
            <dl className="divide-y divide-border">
              {FILAS.map(({ key, label }) => (
                <div key={key} className="flex justify-between gap-3 px-4 py-2.5 text-sm">
                  <dt className="text-muted-foreground">{label}</dt>
                  <dd className="font-medium text-right">{fmt(resultados[key])}</dd>
                </div>
              ))}
            </dl>
          ) : (
            <p className="px-4 py-6 text-center text-[13px] text-muted-foreground">Todavía no se subió la planilla completa.</p>
          )}
        </div>

        <DialogFooter>
          <Button variant="ghost" size="sm" onClick={onClose}>Cerrar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
