import { useEffect, useState, useCallback } from 'react'
import { Spinner, LoadingState } from '@/components/ui/loading'
import { cn } from '@/lib/utils'
import { checklist as checkApi } from '@/lib/api'
import { useAuth } from '../../context/AuthContext'

/** Checklist de presentación de un proyecto, agrupado por sección */
export function ChecklistPanel({ empresaId, proyectoId, onCountUpdate }) {
  const { puedeEscribir } = useAuth()
  const puedeEditar = puedeEscribir(empresaId, 'checklist')
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [uploadingId, setUploadingId] = useState(null)
  const [downloadingId, setDownloadingId] = useState(null)
  const [naOpen, setNaOpen] = useState(false)

  const load = useCallback(() => {
    setLoading(true)
    checkApi.get(empresaId, proyectoId).then(setItems).catch(console.error).finally(() => setLoading(false))
  }, [empresaId, proyectoId])

  useEffect(() => { load() }, [load])

  useEffect(() => {
    onCountUpdate?.(items.filter(i => i.estado === 'pendiente').length)
  }, [items, onCountUpdate])

  const handleToggle = async (item, targetState) => {
    const nuevoEstado = item.estado === targetState ? 'pendiente' : targetState
    setItems(current => current.map(i => (i.id === item.id ? { ...i, estado: nuevoEstado } : i)))
    try {
      await checkApi.updateItem(empresaId, proyectoId, item.id, nuevoEstado, item.nota_usuario || '')
    } catch (err) {
      console.error(err)
      load()
    }
  }

  const handleFileUpload = async (itemId, file) => {
    setUploadingId(itemId)
    try {
      await checkApi.uploadFile(empresaId, proyectoId, itemId, file)
      setItems(current => current.map(i => (i.id === itemId ? { ...i, estado: 'completado', archivo: file.name } : i)))
    } catch (error) {
      console.error(error)
      load()
    } finally {
      setUploadingId(null)
    }
  }

  const handleFileDownload = async (item) => {
    setDownloadingId(item.id)
    try {
      const blob = await checkApi.downloadFile(empresaId, proyectoId, item.id)
      const a = document.createElement('a')
      a.href = URL.createObjectURL(blob)
      a.download = item.archivo.split('/').pop()
      a.click()
    } catch (error) {
      console.error(error)
    } finally {
      setDownloadingId(null)
    }
  }

  if (loading) return <LoadingState message="Cargando checklist..." />

  const completados = items.filter(i => i.estado === 'completado').length
  const naItems = items.filter(i => i.estado === 'no_aplica')
  const activeItems = items.filter(i => i.estado !== 'no_aplica')
  const pendientes = activeItems.filter(i => i.estado === 'pendiente').length

  const sections = activeItems.reduce((acc, item) => {
    const s = item.seccion || 'General'
    ;(acc[s] || (acc[s] = [])).push(item)
    return acc
  }, {})

  const renderItem = (item) => {
    const isOk = item.estado === 'completado'
    const isNa = item.estado === 'no_aplica'
    return (
      <div
        key={item.id}
        className={cn(
          'flex flex-col gap-2 p-3 border rounded-lg transition-all',
          isOk ? 'bg-success/5 border-success/30' : isNa ? 'bg-card/40 border-border/30 opacity-60' : 'bg-card border-border/60 hover:border-primary/30',
        )}
      >
        <div className="flex items-start gap-2">
          <div className="text-[10px] font-mono text-muted-foreground/60 w-4 shrink-0 pt-0.5">{item.id}</div>
          <div className="flex-1 min-w-0">
            <p className={cn('text-[12px] font-medium leading-snug', isOk ? 'text-foreground/80' : 'text-foreground')}>
              {item.descripcion}
            </p>
            {item.nota && <p className="text-[11px] text-muted-foreground/70 mt-0.5 italic">{item.nota}</p>}
            {item.archivo && (
              <div className="text-[10px] text-success mt-1 flex items-center gap-1 font-medium">
                📎 {item.archivo}
                <button
                  onClick={() => handleFileDownload(item)}
                  disabled={downloadingId === item.id}
                  className="text-primary hover:underline ml-1 disabled:opacity-60 disabled:no-underline"
                >{downloadingId === item.id ? 'Descargando...' : 'Descargar'}</button>
              </div>
            )}
          </div>
        </div>
        <div className="flex items-center gap-1.5 pl-6">
          {item.acepta_archivo && puedeEditar && (
            <>
              <input type="file" id={`cf-${item.id}`} className="hidden" onChange={(e) => e.target.files[0] && handleFileUpload(item.id, e.target.files[0])} />
              <label htmlFor={`cf-${item.id}`} className="cursor-pointer text-[10px] font-medium border border-border/60 rounded px-2 h-[22px] flex items-center bg-background hover:bg-primary/5 hover:border-primary/30 transition-all gap-1">
                {uploadingId === item.id ? <><Spinner size={9} /> Subiendo</> : '📎 Subir'}
              </label>
            </>
          )}
          <button
            onClick={() => handleToggle(item, 'completado')}
            disabled={!puedeEditar}
            className={cn(
              'h-[22px] px-2 rounded border text-[10px] font-medium transition-all',
              'disabled:opacity-60 disabled:cursor-not-allowed',
              isOk ? 'bg-success/15 border-success/40 text-success' : 'bg-background border-border/60 text-muted-foreground hover:border-success/50 hover:text-success'
            )}
          >✓ OK</button>
          <button
            onClick={() => handleToggle(item, 'no_aplica')}
            disabled={!puedeEditar}
            className={cn(
              'h-[22px] px-2 rounded border text-[10px] font-medium transition-all',
              'disabled:opacity-60 disabled:cursor-not-allowed',
              isNa ? 'bg-muted border-border/80 text-foreground' : 'bg-background border-border/60 text-muted-foreground hover:border-muted-foreground/50 hover:text-foreground'
            )}
          >N/A</button>
        </div>
      </div>
    )
  }

  return (
    <div className="p-4 space-y-5">
      {!puedeEditar && (
        <p className="rounded-lg border border-border/60 bg-muted/30 px-3.5 py-2.5 text-[12px] text-muted-foreground">
          Tenés acceso de sólo lectura al checklist de esta empresa.
        </p>
      )}
      <p className="text-[11px] text-muted-foreground">
        <span className="text-warning font-medium">{pendientes} pendientes</span>
        {' · '}<span className="text-success font-medium">{completados} completados</span>
        {naItems.length > 0 && <>{' · '}{naItems.length} N/A</>}
      </p>

      {Object.entries(sections).map(([seccion, sectionItems], sidx) => (
        <div key={seccion} className={sidx > 0 ? 'mt-4' : ''}>
          <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground mb-2">{seccion}</p>
          <div className="space-y-1.5">
            {sectionItems.map(renderItem)}
          </div>
        </div>
      ))}

      {naItems.length > 0 && (
        <div className="mt-4">
          <button
            onClick={() => setNaOpen(o => !o)}
            className="w-full flex items-center justify-between px-3 py-2 rounded-lg border border-border/40 bg-card/40 text-[11px] font-medium text-muted-foreground hover:text-foreground hover:border-border/70 transition-all"
          >
            <span>No aplica · {naItems.length}</span>
            <span className="text-[10px]">{naOpen ? '▲' : '▼'}</span>
          </button>
          {naOpen && (
            <div className="mt-1.5 space-y-1.5">
              {naItems.map(renderItem)}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
