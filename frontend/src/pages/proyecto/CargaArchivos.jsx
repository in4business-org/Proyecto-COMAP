import { useRef, useState } from 'react'
import { Download, FileText } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Spinner } from '@/components/ui/loading'
import { facturas as factApi } from '@/lib/api'

const esExcel = (files) => files.length === 1 && files[0].name.toLowerCase().endsWith('.xlsx')

/**
 * Zona para subir comprobantes de un período: PDFs/imágenes que lee la IA o un
 * Excel con el template para importación masiva.
 */
export function CargaArchivos({ empresaId, proyectoId, periodo, periodoLabel, puedeEditar, cantidadActual, onActualizar }) {
  const inputRef = useRef(null)
  const [files, setFiles] = useState([])
  const [uploading, setUploading] = useState(false)
  const [importing, setImporting] = useState(false)
  const [uploadMsg, setUploadMsg] = useState('')

  const limpiar = () => {
    setFiles([])
    if (inputRef.current) inputRef.current.value = ''
  }

  const handleImport = async (file) => {
    setImporting(true)
    try {
      onActualizar(await factApi.importar(empresaId, proyectoId, periodo, file))
      setUploadMsg('Importación masiva completada')
    } catch (err) {
      console.error(err)
      setUploadMsg('Error al importar el archivo')
    } finally {
      setImporting(false)
    }
  }

  const handleUpload = async () => {
    if (!files.length) return
    setUploadMsg('')
    if (esExcel(files)) {
      await handleImport(files[0])
      limpiar()
      return
    }
    setUploading(true)
    try {
      const updated = await factApi.uploadAndProcess(empresaId, proyectoId, periodo, files)
      onActualizar(updated)
      const nuevas = (updated?.length || 0) - cantidadActual
      setUploadMsg(nuevas > 0 ? `${nuevas} factura(s) procesada(s)` : 'Archivos procesados sin nuevas facturas detectadas')
      limpiar()
    } catch (err) {
      console.error(err)
      setUploadMsg('Error al procesar los archivos')
    } finally {
      setUploading(false)
    }
  }

  const handleDownloadTemplate = async () => {
    try {
      const blob = await factApi.downloadTemplate(empresaId, proyectoId, periodo)
      const a = document.createElement('a')
      a.href = URL.createObjectURL(blob)
      a.download = 'template_facturas.xlsx'
      a.click()
    } catch (err) { console.error(err) }
  }

  return (
    <div className="bg-card/30 border border-border/50 rounded-xl p-5 shadow-sm">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
          Archivos · {periodoLabel}
        </h2>
        <Button onClick={handleDownloadTemplate} variant="outline" size="sm" className="h-[26px] text-[11px] gap-1.5">
          <Download size={12} />
          Template Excel
        </Button>
      </div>

      {!puedeEditar && (
        <p className="rounded-lg border border-border/60 bg-muted/30 px-3.5 py-2.5 text-[12px] text-muted-foreground">
          Tenés acceso de sólo lectura a las facturas de esta empresa.
        </p>
      )}

      {puedeEditar && (
        <div className="rounded-xl border-[1.5px] border-dashed border-border/60 p-8 text-center bg-card/10 hover:bg-primary/5 hover:border-primary/40 transition-colors group">
          <input
            ref={inputRef}
            type="file"
            multiple
            accept=".xlsx,.pdf,.png,.jpg,.jpeg,.webp"
            onChange={(e) => { setFiles([...e.target.files]); setUploadMsg('') }}
            className="hidden"
            id="factura-upload"
          />
          <label htmlFor="factura-upload" className="cursor-pointer flex flex-col items-center gap-3">
            <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center group-hover:bg-primary/20 transition-colors">
              <FileText size={20} className="text-muted-foreground group-hover:text-primary transition-colors" />
            </div>
            <div>
              <p className="text-[13px] font-medium text-foreground group-hover:text-primary transition-colors">
                {files.length > 0
                  ? `${files.length} archivo(s) seleccionados`
                  : 'Arrastrá archivos o hacé clic para seleccionar'}
              </p>
              <p className="text-[11px] text-muted-foreground mt-1">PDF / imágenes (procesado por IA) · o Excel completo para importación masiva</p>
            </div>
          </label>

          {files.length > 0 && (
            <div className="mt-5 flex justify-center">
              <Button onClick={handleUpload} disabled={uploading || importing} size="sm" className="h-[30px] px-6 text-[12px]">
                {uploading ? <><Spinner size={12} className="mr-2" /> Procesando...</>
                  : importing ? <><Spinner size={12} className="mr-2" /> Importando...</>
                  : esExcel(files) ? 'Importar Excel'
                  : 'Subir y procesar'}
              </Button>
            </div>
          )}
        </div>
      )}
      {uploadMsg && <p className="text-[11px] text-success font-medium mt-3 text-center">{uploadMsg}</p>}
    </div>
  )
}
