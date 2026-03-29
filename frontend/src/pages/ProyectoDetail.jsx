import { useEffect, useState, useCallback } from 'react'
import { useParams, Link } from 'react-router-dom'
import {
  ArrowLeft, Upload, Download, FileText,
  CheckSquare, Calculator, Check, FolderOpen, Plus
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { LoadingState, EmptyState, Spinner } from '@/components/ui/loading'
import { cn } from '@/lib/utils'
import { empresas as empApi, proyectos as projApi, facturas as factApi, checklist as checkApi, simulador as simApi, cotizaciones as cotApi } from '@/lib/api'

/* ─── Facturas ────────────────────────────────────── */

function FacturasTab({ empresaId, proyectoId, periodos, meta }) {
  const [activePeriodo, setActivePeriodo] = useState('presentacion')
  const [files, setFiles] = useState([])
  const [uploading, setUploading] = useState(false)
  const [exporting, setExporting] = useState(false)
  const [importing, setImporting] = useState(false)
  const [results, setResults] = useState(null)
  const [loadingResults, setLoadingResults] = useState(true)
  const [uploadMsg, setUploadMsg] = useState('')
  const [periodoCounts, setPeriodoCounts] = useState({})
  const [isEditing, setIsEditing] = useState(false)
  const [editedResults, setEditedResults] = useState([])
  const [savingEdit, setSavingEdit] = useState(false)
  const [selectedRows, setSelectedRows] = useState([])
  const [cotizacion, setCotizacion] = useState(null)
  const [loadingCotizacion, setLoadingCotizacion] = useState(true)

  // Cache to prevent loading spinners when switching back and forth
  const [resultsCache, setResultsCache] = useState({})

  useEffect(() => {
    setEditedResults(results || [])
  }, [results])

  // Load cotización del mes anterior
  useEffect(() => {
    cotApi.getMesAnterior()
      .then(setCotizacion)
      .catch(() => setCotizacion(null))
      .finally(() => setLoadingCotizacion(false))
  }, [])

  // Load persisted results for current periodo
  useEffect(() => {
    // Show cached immediately if we have it
    if (resultsCache[activePeriodo]) {
      setResults(resultsCache[activePeriodo])
      setLoadingResults(false)
    } else {
      setLoadingResults(true)
    }
    
    // Always fetch latest in background
    factApi.getResults(empresaId, proyectoId, activePeriodo)
      .then((data) => { 
        const items = data && data.length ? data : []
        setResults(items)
        setResultsCache(prev => ({ ...prev, [activePeriodo]: items }))
        setPeriodoCounts(prev => ({ ...prev, [activePeriodo]: items.length }))
      })
      .catch((err) => { console.error(err); setResults([]) })
      .finally(() => setLoadingResults(false))
  }, [empresaId, proyectoId, activePeriodo])

  // Fetch counts for all periodos for the grid
  useEffect(() => {
    const fetchCounts = async () => {
      const counts = {}
      for (const p of periodos) {
        try {
          const data = await factApi.getResults(empresaId, proyectoId, p)
          counts[p] = data && data.length ? data.length : 0
        } catch (e) {
          counts[p] = 0
        }
      }
      setPeriodoCounts(counts)
    }
    fetchCounts()
  }, [empresaId, proyectoId, periodos])

  const handleEditToggle = () => {
  if (isEditing) {
    setEditedResults(results || [])
    setSelectedRows([])
    setIsEditing(false)
    return
  }
  setEditedResults(results || [])
  setSelectedRows([])
  setIsEditing(true)
}

  const handleFieldChange = (index, field, value) => {
    setEditedResults(current =>
      current.map((item, i) =>
        i === index
          ? {
              ...item,
              [field]:
                field === 'monto' || field === 'cantidad'
                  ? (value === '' ? null : Number(value))
                  : value
            }
          : item
      )
    )
  }

  const handleSaveEdit = async () => {
    setSavingEdit(true)
    try {
      // esto lo vamos a conectar al back después
      const updated = await factApi.updateResults(
        empresaId,
        proyectoId,
        activePeriodo,
        editedResults
      )

      setResults(updated)
      setResultsCache(prev => ({ ...prev, [activePeriodo]: updated }))
      setPeriodoCounts(prev => ({ ...prev, [activePeriodo]: updated?.length || 0 }))
      setSelectedRows([])
      setIsEditing(false)
    } catch (err) {
      console.error(err)
    } finally {
      setSavingEdit(false)
    }
  }

  const handleToggleRow = (index) => {
    setSelectedRows((current) =>
      current.includes(index)
        ? current.filter((i) => i !== index)
        : [...current, index]
    )
  }

  const handleToggleAllRows = () => {
    if (selectedRows.length === editedResults.length) {
      setSelectedRows([])
      return
    }
    setSelectedRows(editedResults.map((_, index) => index))
  }

  const handleDeleteSelected = () => {
    if (!selectedRows.length) return

    setEditedResults((current) =>
      current.filter((_, index) => !selectedRows.includes(index))
    )
    setSelectedRows([])
  }

  const handleUpload = async () => {
    if (!files.length) return
    setUploading(true)
    setUploadMsg('')
    try {
      const res = await factApi.upload(empresaId, proyectoId, activePeriodo, files)
      setUploadMsg(`${res.total} archivo(s) subidos`)
      setFiles([])
      document.getElementById('factura-upload').value = ''
    } catch (err) { console.error(err) }
    finally { setUploading(false) }
  }

  const handleAddRow = () => {
    setEditedResults(current => [...current, {
      descripcion: '', numero_factura: '', proveedor: '', rut: '',
      fecha: '', monto: null, moneda: '$', cantidad: 1,
      categoria: null, rut_receptor: '', razon_social_receptor: '',
      texto_extraido: false,
    }])
  }

  const handleDownloadTemplate = async () => {
    try {
      const blob = await factApi.downloadTemplate(empresaId, proyectoId, activePeriodo)
      const a = document.createElement('a')
      a.href = URL.createObjectURL(blob)
      a.download = 'template_facturas.xlsx'
      a.click()
    } catch (err) { console.error(err) }
  }

  const handleImportMasivo = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    setImporting(true)
    try {
      const updated = await factApi.importar(empresaId, proyectoId, activePeriodo, file)
      setResults(updated)
      setResultsCache(prev => ({ ...prev, [activePeriodo]: updated }))
      setPeriodoCounts(prev => ({ ...prev, [activePeriodo]: updated?.length || 0 }))
    } catch (err) { console.error(err) }
    finally {
      setImporting(false)
      e.target.value = ''
    }
  }

  const handleExport = async () => {
    setExporting(true)
    try {
      const blob = await factApi.exportExcel(empresaId, proyectoId, activePeriodo)
      const a = document.createElement('a')
      a.href = URL.createObjectURL(blob)
      a.download = `comap_${activePeriodo}.xlsx`
      a.click()
    } catch (err) { console.error(err) }
    finally { setExporting(false) }
  }
  
  // Calculate stats
  const totalFacturas = results?.length || 0
  const completas = results?.filter(f => f.proveedor && f.fecha && f.monto).length || 0
  const conMonto = results?.filter(f => f.monto).length || 0

  return (
    <div className="space-y-6 animate-fade-in">
      
      {/* Grid de Períodos */}
      <div className="bg-card/30 border border-border/50 rounded-xl p-5 shadow-sm">
        <h2 className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground mb-4">Períodos</h2>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
          {periodos.map(p => {
            const isPresentacion = p === 'presentacion'
            const nombre = isPresentacion ? meta?.anio_presentacion : p.replace('control_', '')
            const label = isPresentacion ? 'Presentación' : 'Control'
            const active = activePeriodo === p
            
            return (
              <button
                key={p}
                onClick={() => setActivePeriodo(p)}
                className={cn(
                  "flex flex-col text-left p-4 rounded-xl border transition-all duration-200",
                  active 
                    ? "border-primary bg-primary/10 shadow-sm" 
                    : "border-border/60 bg-card hover:border-primary/40 hover:bg-card/90 hover:-translate-y-0.5"
                )}
              >
                <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/80">{label}</span>
                <span className="text-[15px] font-medium text-foreground mt-1">{nombre}</span>
                <span className="text-[11px] text-muted-foreground/60 mt-3 font-mono tracking-tight">
                  {periodoCounts[p] !== undefined ? `${periodoCounts[p]} facturas` : 'Cargando...'}
                </span>
              </button>
            )
          })}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6">
        {/* Upload area */}
        <div className="bg-card/30 border border-border/50 rounded-xl p-5 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
              Archivos · {activePeriodo === 'presentacion' ? 'Presentación' : `Control ${activePeriodo.replace('control_', '')}`}
            </h2>
          </div>
          
          <div className="rounded-xl border-[1.5px] border-dashed border-border/60 p-8 text-center bg-card/10 hover:bg-primary/5 hover:border-primary/40 transition-colors group">
            <input
              type="file"
              multiple
              accept=".pdf,.png,.jpg,.jpeg,.webp"
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
                  {files.length > 0 ? `${files.length} archivo(s) seleccionados` : 'Arrastrá los PDFs o hacé clic para seleccionar'}
                </p>
                <p className="text-[11px] text-muted-foreground mt-1">Solo archivos PDF o imágenes compatibles</p>
              </div>
            </label>
            
            {files.length > 0 && (
              <div className="mt-5 flex justify-center">
                <Button onClick={handleUpload} disabled={uploading} size="sm" className="h-[30px] px-6 text-[12px]">
                  {uploading ? <><Spinner size={12} className="mr-2"/> Subiendo...</> : 'Subir archivos'}
                </Button>
              </div>
            )}
          </div>
          {uploadMsg && <p className="text-[11px] text-success font-medium mt-3 text-center">{uploadMsg}</p>}
        </div>

        {/* Results */}
        <div className="bg-card/30 border border-border/50 rounded-xl p-5 shadow-sm">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-5 gap-3">
            <h2 className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">Resultados</h2>
            <div className="flex gap-2 flex-wrap">
              {!isEditing ? (
                <>
                  <Button
                    onClick={handleEditToggle}
                    disabled={loadingResults}
                    variant="outline"
                    size="sm"
                    className="h-[28px] text-[11px] gap-1.5"
                  >
                    Editar
                  </Button>
                  <input
                    type="file"
                    accept=".xlsx"
                    id="import-masivo"
                    className="hidden"
                    onChange={handleImportMasivo}
                  />
                  <Button
                    onClick={handleDownloadTemplate}
                    variant="outline"
                    size="sm"
                    className="h-[28px] text-[11px] gap-1.5"
                  >
                    <Download size={13} />
                    Template
                  </Button>
                  <Button
                    onClick={() => document.getElementById('import-masivo').click()}
                    disabled={importing}
                    variant="secondary"
                    size="sm"
                    className="h-[28px] text-[11px] gap-1.5 bg-background"
                  >
                    {importing ? <Spinner size={12} /> : <Upload size={13} />}
                    Importar
                  </Button>
                </>
              ) : (
                <>
                  <Button
                    onClick={handleAddRow}
                    variant="outline"
                    size="sm"
                    className="h-[28px] text-[11px] gap-1.5"
                  >
                    <Plus size={13} />
                    Agregar
                  </Button>
                  <Button
                    onClick={handleSaveEdit}
                    disabled={savingEdit}
                    variant="default"
                    size="sm"
                    className="h-[28px] text-[11px] gap-1.5"
                  >
                    {savingEdit ? <Spinner size={12} /> : <Check size={13} />}
                    Ok
                  </Button>
                  <Button
                    onClick={handleEditToggle}
                    disabled={savingEdit}
                    variant="outline"
                    size="sm"
                    className="h-[28px] text-[11px] gap-1.5"
                  >
                    Cancelar
                  </Button>
                  <Button
                    onClick={handleDeleteSelected}
                    disabled={!selectedRows.length || savingEdit}
                    variant="destructive"
                    size="sm"
                    className="h-[28px] text-[11px] gap-1.5"
                  >
                    Eliminar seleccionadas
                  </Button>
                </>
              )}

              <Button
                onClick={handleExport}
                disabled={exporting || totalFacturas === 0 || isEditing}
                variant="default"
                size="sm"
                className="h-[28px] text-[11px] gap-1.5 bg-success hover:bg-success/90 text-success-foreground"
              >
                {exporting ? <Spinner size={12} /> : <Download size={13} />}
                Exportar COMAP
              </Button>
            </div>
          </div>
          
          {/* Cotización */}
          <div className="flex items-center gap-3 mb-4 text-[12px] text-muted-foreground">
            <span className="font-semibold uppercase tracking-wider text-[10px]">Cotización</span>
            {loadingCotizacion ? (
              <span className="text-muted-foreground/60">Consultando BCU...</span>
            ) : cotizacion ? (
              <>
                <span className="bg-card border border-border/60 rounded px-2 py-0.5 font-mono">
                  USD <span className="text-foreground font-semibold">${cotizacion.valor_usd.toFixed(2)}</span>
                </span>
                <span className="bg-card border border-border/60 rounded px-2 py-0.5 font-mono">
                  UI <span className="text-foreground font-semibold">${cotizacion.valor_ui.toFixed(2)}</span>
                </span>
                <span className="text-[10px] text-muted-foreground/50">al {cotizacion.fecha}</span>
              </>
            ) : (
              <span className="text-destructive/70 text-[11px]">Servicio BCU no disponible</span>
            )}
          </div>

          {/* Stats Bar */}
          {(results?.length > 0) && (
            <div className="grid grid-cols-3 gap-3 mb-5">
              {[
                { label: 'Facturas', val: totalFacturas },
                { label: 'Completas', val: completas, color: 'text-success' },
                { label: 'Con monto', val: conMonto },
              ].map(stat => (
                <div key={stat.label} className="bg-card border border-border/60 rounded-lg p-3">
                  <p className={cn("text-xl font-mono font-semibold", stat.color || "text-foreground")}>{stat.val}</p>
                  <p className="text-[10px] text-muted-foreground/80 tracking-wide uppercase mt-1">{stat.label}</p>
                </div>
              ))}
            </div>
          )}

          {/* Results table */}
          {loadingResults && <LoadingState message="Cargando resultados guardados..." />}

          {results && !loadingResults && (
            <div>
              {results.length > 0 || isEditing ? (
                <div className={cn("overflow-x-auto shadow-sm", isEditing ? "border border-border/60 rounded-lg" : "border border-border/80 rounded-lg")}>
                  <table className={cn("w-full text-[12px] min-w-[860px]", isEditing && "border-collapse")}>
                    <thead>
                      <tr className={cn("border-b", isEditing ? "border-border/50 bg-muted/30" : "border-border/60")}>
                        {isEditing && (
                          <th className="w-8 px-3 py-2 border-r border-border/30">
                            <input
                              type="checkbox"
                              checked={editedResults.length > 0 && selectedRows.length === editedResults.length}
                              onChange={handleToggleAllRows}
                            />
                          </th>
                        )}
                        {['Descripción', 'N° Factura', 'Proveedor', 'Fecha', 'Monto', 'Moneda', 'Categoría', 'Estado'].map((h) => (
                          <th
                            key={h}
                            className={cn(
                              "py-2.5 text-left text-[11px] font-semibold uppercase tracking-wide text-muted-foreground",
                              isEditing ? "px-2 border-r border-border/30 last:border-r-0" : "px-3"
                            )}
                          >
                            {h}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className={cn(isEditing ? "" : "divide-y divide-border/50")}>
                      {(isEditing ? editedResults : results).map((r, i) => {
                        const completado = r.proveedor && r.fecha && r.monto
                        const cellEdit = "p-0 border-r border-b border-border/25 last:border-r-0"
                        const inputEdit = "w-full min-h-[34px] bg-transparent text-foreground px-2 py-1 text-[12px] outline-none focus:bg-primary/5 placeholder:text-muted-foreground/40"
                        const selectEdit = "w-full min-h-[34px] bg-background text-foreground px-2 py-1 text-[12px] outline-none focus:bg-primary/5 cursor-pointer"
                        const toDateInput = (v) => { if (!v) return ''; const [d, m, y] = v.split('/'); return d && m && y ? `${y}-${m.padStart(2,'0')}-${d.padStart(2,'0')}` : '' }
                        const fromDateInput = (v) => { if (!v) return ''; const [y, m, d] = v.split('-'); return d && m && y ? `${d}/${m}/${y}` : '' }
                        return (
                          <tr key={i} className={cn(isEditing ? "last:border-b-0" : "bg-card hover:bg-accent/30 transition-colors")}>
                            {isEditing && (
                              <td className="w-8 px-3 border-r border-b border-border/25">
                                <input
                                  type="checkbox"
                                  checked={selectedRows.includes(i)}
                                  onChange={() => handleToggleRow(i)}
                                />
                              </td>
                            )}
                            {/* Descripción */}
                            <td className={isEditing ? cellEdit : "px-3 py-2.5 max-w-[220px]"}>
                              {isEditing ? (
                                <input value={r.descripcion || ''} onChange={(e) => handleFieldChange(i, 'descripcion', e.target.value)} className={inputEdit} />
                              ) : (
                                <div className="truncate" title={r.descripcion || ''}>{r.descripcion || '--'}</div>
                              )}
                            </td>
                            {/* N° Factura */}
                            <td className={isEditing ? cellEdit : "px-3 py-2.5 font-mono whitespace-nowrap"}>
                              {isEditing ? (
                                <input value={r.numero_factura || ''} onChange={(e) => handleFieldChange(i, 'numero_factura', e.target.value)} className={cn(inputEdit, "font-mono")} />
                              ) : (
                                r.numero_factura || '--'
                              )}
                            </td>
                            {/* Proveedor */}
                            <td className={isEditing ? cellEdit : "px-3 py-2.5"}>
                              {isEditing ? (
                                <input value={r.proveedor || ''} onChange={(e) => handleFieldChange(i, 'proveedor', e.target.value)} className={inputEdit} />
                              ) : (
                                r.proveedor || '--'
                              )}
                            </td>
                            {/* Fecha */}
                            <td className={isEditing ? cellEdit : "px-3 py-2.5 font-mono whitespace-nowrap"}>
                              {isEditing ? (
                                <input type="date" value={toDateInput(r.fecha || '')} onChange={(e) => handleFieldChange(i, 'fecha', fromDateInput(e.target.value))} className={cn(inputEdit, "font-mono dark:scheme-dark")} />
                              ) : (
                                r.fecha || '--'
                              )}
                            </td>
                            {/* Monto */}
                            <td className={isEditing ? cellEdit : "px-3 py-2.5 font-mono tabular-nums text-right"}>
                              {isEditing ? (
                                <input type="number" step="0.01" value={r.monto ?? ''} onChange={(e) => handleFieldChange(i, 'monto', e.target.value)} className={cn(inputEdit, "font-mono text-right w-24")} />
                              ) : (
                                r.monto != null ? r.monto.toLocaleString() : '--'
                              )}
                            </td>
                            {/* Moneda */}
                            <td className={isEditing ? cellEdit : "px-3 py-2.5 font-mono"}>
                              {isEditing ? (
                                <select value={(r.moneda || '').trim()} onChange={(e) => handleFieldChange(i, 'moneda', e.target.value)} className={selectEdit}>
                                  <option value="">--</option>
                                  <option value="$">$</option>
                                  <option value="USD">USD</option>
                                </select>
                              ) : (
                                r.moneda || '--'
                              )}
                            </td>
                            {/* Categoría */}
                            <td className={isEditing ? cellEdit : "px-3 py-2.5"}>
                              {isEditing ? (
                                <select value={r.categoria || ''} onChange={(e) => handleFieldChange(i, 'categoria', e.target.value)} className={selectEdit}>
                                  <option value="">--</option>
                                  <option value="Maquinaria">Maquinaria</option>
                                  <option value="Equipos">Equipos</option>
                                  <option value="Instalaciones">Instalaciones</option>
                                  <option value="Vehiculos">Vehículos</option>
                                  <option value="MEIV/Imprevistos">MEIV/Imprevistos</option>
                                  <option value="Materiales">Materiales</option>
                                  <option value="Mano de Obra Directa">Mano de Obra Directa</option>
                                  <option value="Mano de Obra Indirecta">Mano de Obra Indirecta</option>
                                  <option value="Leyes Sociales">Leyes Sociales</option>
                                  <option value="Honorarios">Honorarios</option>
                                  <option value="OC/Imprevistos">OC/Imprevistos</option>
                                </select>
                              ) : (
                                r.categoria || '--'
                              )}
                            </td>
                            {/* Estado */}
                            <td className="px-3 py-2.5 whitespace-nowrap">
                              {completado
                                ? <Badge variant="secondary" className="bg-success/15 text-success border-transparent font-medium px-2 h-5 text-[10px]">✓ Completo</Badge>
                                : <Badge variant="secondary" className="bg-warning/15 text-warning border-transparent font-medium px-2 h-5 text-[10px]">⚠ Incompleto</Badge>}
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="border border-dashed border-border/60 rounded-lg py-12 text-center bg-card/5">
                  {isEditing ? (
                    <p className="text-[13px] text-muted-foreground">Usá <strong>+ Agregar</strong> para añadir la primera factura.</p>
                  ) : (
                    <p className="text-[13px] text-muted-foreground">No hay facturas cargadas. Usá <strong>Editar</strong> o <strong>Importar</strong>.</p>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

/* ─── Checklist ───────────────────────────────────── */

function ChecklistTab({ empresaId, proyectoId }) {
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [uploadingId, setUploadingId] = useState(null)

  const load = useCallback(() => {
    setLoading(true)
    checkApi.get(empresaId, proyectoId).then(setItems).catch(console.error).finally(() => setLoading(false))
  }, [empresaId, proyectoId])

  useEffect(() => { load() }, [load])

  const handleToggle = async (item, targetState) => {
    const nuevoEstado = item.estado === targetState ? 'pendiente' : targetState
    // Optimistic update
    setItems(currentItems => currentItems.map(i => 
      i.id === item.id ? { ...i, estado: nuevoEstado } : i
    ))
    
    try {
      await checkApi.updateItem(empresaId, proyectoId, item.id, nuevoEstado, item.nota_usuario || '')
    } catch (err) {
      console.error(err)
      load() // Revert to server state on error
    }
  }

  const handleFileUpload = async (itemId, file) => {
    setUploadingId(itemId)
    try {
      await checkApi.uploadFile(empresaId, proyectoId, itemId, file)
      // Optimistic update without triggering the main loading state
      setItems(currentItems => currentItems.map(i => 
        i.id === itemId ? { ...i, estado: 'completado', archivo: file.name } : i
      ))
    } catch (error) {
      console.error(error)
      load() // Revert to server state on error
    } finally {
      setUploadingId(null)
    }
  }

  if (loading) return <LoadingState message="Cargando checklist..." />

  const completados = items.filter(i => i.estado === 'completado').length
  const noAplica = items.filter(i => i.estado === 'no_aplica').length
  const pendientes = items.length - completados - noAplica
  
  const sections = items.reduce((acc, item) => {
    const s = item.seccion || 'General'
    ;(acc[s] || (acc[s] = [])).push(item)
    return acc
  }, {})

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Progress Stats */}
      <div className="bg-card/30 border border-border/50 rounded-xl p-5 shadow-sm">
        <div className="flex flex-col sm:flex-row gap-4 divide-y sm:divide-y-0 sm:divide-x divide-border/50">
          <div className="flex-1 px-4 py-1 text-center">
            <p className="text-2xl font-mono font-semibold text-success">{completados}</p>
            <p className="text-[10px] text-muted-foreground/80 tracking-wide uppercase mt-1">Completados</p>
          </div>
          <div className="flex-1 px-4 py-1 text-center">
            <p className="text-2xl font-mono font-semibold text-warning">{pendientes}</p>
            <p className="text-[10px] text-muted-foreground/80 tracking-wide uppercase mt-1">Pendientes</p>
          </div>
          <div className="flex-1 px-4 py-1 text-center">
            <p className="text-2xl font-mono font-semibold text-foreground">{noAplica}</p>
            <p className="text-[10px] text-muted-foreground/80 tracking-wide uppercase mt-1">No aplica</p>
          </div>
        </div>
      </div>

      {/* Items by section */}
      <div className="bg-card/30 border border-border/50 rounded-xl p-5 md:p-6 shadow-sm">
        {Object.entries(sections).map(([seccion, sectionItems], sidx) => (
          <div key={seccion} className={sidx > 0 ? "mt-6" : ""}>
            <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground mb-3">{seccion}</p>
            <div className="space-y-2">
              {sectionItems.map((item) => {
                const isOk = item.estado === 'completado'
                const isNa = item.estado === 'no_aplica'
                return (
                  <div
                    key={item.id}
                    className={cn(
                      'flex flex-col sm:flex-row sm:items-start gap-3 p-3 lg:p-4 border rounded-xl transition-all',
                      isOk ? 'bg-success/5 border-success/30 shadow-sm' : isNa ? 'bg-card/40 border-border/40 grayscale-[0.5]' : 'bg-card border-border/60 hover:border-primary/30 shadow-sm',
                    )}
                  >
                    <div className="text-[11px] font-mono text-muted-foreground/60 w-5 shrink-0 pt-0.5">{item.id}</div>
                    
                    <div className={cn("flex-1 min-w-0 pr-4 transition-opacity", isNa ? "opacity-60" : "opacity-100")}>
                      <p className={cn('text-[14px] font-medium leading-snug', isOk ? 'text-foreground/80' : 'text-foreground')}>
                        {item.descripcion}
                      </p>
                      {item.nota && <p className="text-[12px] text-muted-foreground/80 mt-1 italic">{item.nota}</p>}
                      {item.archivo && (
                        <div className="text-[11px] text-success mt-1.5 flex items-center gap-1.5 font-medium">
                          📎 {item.archivo}
                          <a href={`/api/empresas/${empresaId}/proyectos/${proyectoId}/checklist/${item.id}/archivo`} target="_blank" rel="noreferrer" className="text-primary hover:underline ml-2">Descargar</a>
                        </div>
                      )}
                    </div>
                    
                    <div className="flex items-center gap-2 mt-2 sm:mt-0 pt-2 border-t border-border/40 sm:pt-0 sm:border-0 shrink-0">
                      {item.acepta_archivo && (
                        <>
                          <input type="file" id={`cf-${item.id}`} className="hidden" onChange={(e) => e.target.files[0] && handleFileUpload(item.id, e.target.files[0])} />
                          <label htmlFor={`cf-${item.id}`} className="cursor-pointer text-[11px] font-medium border border-border/60 rounded px-2.5 h-[26px] flex items-center bg-background hover:bg-primary/5 hover:border-primary/30 transition-all gap-1.5">
                            {uploadingId === item.id ? <><Spinner size={10} /> Subiendo</> : '📎 Subir'}
                          </label>
                        </>
                      )}
                      <button
                        onClick={() => handleToggle(item, 'completado')}
                        className={cn(
                          'h-[26px] px-2.5 rounded border text-[11px] font-medium transition-all flex items-center gap-1',
                          isOk ? 'bg-success/15 border-success/40 text-success' : 'bg-background border-border/60 text-muted-foreground hover:border-success/50 hover:text-success'
                        )}
                      >
                        ✓ OK
                      </button>
                      <button
                        onClick={() => handleToggle(item, 'no_aplica')}
                        className={cn(
                          'h-[26px] px-2.5 rounded border text-[11px] font-medium transition-all flex items-center gap-1',
                          isNa ? 'bg-muted border-border/80 text-foreground' : 'bg-background border-border/60 text-muted-foreground hover:border-muted-foreground/50 hover:text-foreground'
                        )}
                      >
                        N/A
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

/* ─── Simulador ───────────────────────────────────── */

function SimuladorTab({ empresaId, proyectoId, results, loadingResults, onUpdateResults }) {
  const [downloading, setDownloading] = useState(false)
  const [uploading, setUploading] = useState(false)

  const handleDownload = async () => {
    setDownloading(true)
    try {
      const blob = await simApi.download(empresaId, proyectoId)
      const a = document.createElement('a')
      a.href = URL.createObjectURL(blob)
      a.download = 'Simulador_COMAP.xlsx'
      a.click()
    } catch (err) { console.error(err) }
    finally { setDownloading(false) }
  }

  const handleUpload = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    setUploading(true)
    try { 
      const res = await simApi.upload(empresaId, proyectoId, file)
      if (onUpdateResults) onUpdateResults(res.resultados || res)
    }
    catch (err) { console.error(err) }
    finally { setUploading(false) }
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="bg-card/30 border border-border/50 rounded-xl p-5 shadow-sm">
        <div className="flex flex-col sm:flex-row gap-3">
          <Button onClick={handleDownload} disabled={downloading} variant="secondary" size="sm" className="gap-1.5 h-9 bg-background">
            {downloading ? <Spinner size={13} /> : <Download size={14} />}
            Descargar template (.xlsx)
          </Button>
          <div>
            <input type="file" accept=".xlsx" id="sim-up" className="hidden" onChange={handleUpload} />
            <label htmlFor="sim-up">
              <Button variant="default" size="sm" asChild disabled={uploading} className="gap-1.5 h-9 cursor-pointer shadow-sm">
                <span>{uploading ? <><Spinner size={13} /> Subiendo...</> : <><Upload size={14} /> Subir archivo completado</>}</span>
              </Button>
            </label>
          </div>
        </div>
      </div>

      {loadingResults ? (
        <LoadingState message="Cargando resultados..." />
      ) : results && !results.error && Object.keys(results).length > 0 ? (
        <div className="bg-card/30 border border-border/50 rounded-xl p-5 shadow-sm overflow-hidden">
          <h2 className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground mb-4 pl-1">Resultados Extraídos</h2>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-px bg-border/40 rounded-xl overflow-hidden border border-border/40">
            {[
              { label: 'Puntaje final', value: results.puntaje_final, accent: true },
              { label: 'Alcanza mínimo', value: results.alcanza_minimo, color: results.alcanza_minimo === 'SI' ? 'text-success' : 'text-destructive' },
              { label: 'Exoneración IRAE', value: results.exoneracion_irae_pct ? `${(results.exoneracion_irae_pct * 100).toFixed(1)}%` : '--' },
              { label: 'Exoneración (UI)', value: results.exoneracion_ui ? parseFloat(results.exoneracion_ui).toLocaleString() : '--' },
              { label: 'Plazo exoneración', value: results.plazo_exoneracion ? `${results.plazo_exoneracion} años` : '--' },
            ].map(({ label, value, accent, color }) => (
              <div key={label} className="bg-card px-5 py-5 hover:bg-card/80 transition-colors">
                <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground/80">{label}</p>
                <p className={cn('text-xl font-semibold mt-1 tabular-nums font-mono', accent ? 'text-primary' : (color || 'text-foreground'))}>
                  {value != null ? String(value) : '--'}
                </p>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <EmptyState
          icon={Calculator}
          title="Sin resultados"
          description="Descargá el template o subí el simulador completado para ver los resultados del proyecto."
        />
      )}
    </div>
  )
}

/* ─── Main ────────────────────────────────────────── */

const TABS = [
  { id: 'facturas', label: 'Períodos y facturas', icon: FileText },
  { id: 'checklist', label: 'Checklist presentación', icon: CheckSquare },
  { id: 'simulador', label: 'Simulador', icon: Calculator },
]

export default function ProyectoDetail() {
  const { empresaId, proyectoId } = useParams()
  const [empresa, setEmpresa] = useState(null)
  const [meta, setMeta] = useState(null)
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState('facturas')
  
  // Simulador state moved to top level for Banner
  const [simResults, setSimResults] = useState(null)
  const [simLoading, setSimLoading] = useState(true)

  useEffect(() => {
    // Parallel fetching meta info 
    Promise.all([
      empApi.get(empresaId).catch(() => null),
      projApi.list(empresaId).catch(() => [])
    ]).then(([empData, projs]) => {
      setEmpresa(empData)
      setMeta(projs.find((x) => x.id === proyectoId) || {})
    }).finally(() => {
      setLoading(false)
    })
    
    // Fetch sim results for banner
    setSimLoading(true)
    simApi.results(empresaId, proyectoId)
      .then(res => setSimResults(res))
      .catch(() => {})
      .finally(() => setSimLoading(false))
      
  }, [empresaId, proyectoId])

  if (loading) return <LoadingState />

  const periodos = ['presentacion']
  if (meta?.anio_presentacion && meta?.duracion_seguimiento) {
    for (let i = 1; i <= meta.duracion_seguimiento; i++) {
      periodos.push(`control_${meta.anio_presentacion + i}`)
    }
  }
  
  const hasSimData = simResults && simResults.puntaje_final !== undefined && !simResults.error && !String(simResults.puntaje_final).includes('#')
  const alcanza = simResults?.alcanza_minimo === 'SI'

  return (
    <div className="animate-fade-up">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <Link to={`/empresas/${empresaId}`} className="rounded-md p-1.5 hover:bg-accent transition-colors text-muted-foreground hover:text-foreground">
            <ArrowLeft size={16} />
          </Link>
          <div className="flex flex-col">
            <h1 className="text-xl font-medium truncate flex items-center gap-2">
              {empresa?.nombre} <span className="text-muted-foreground/30">•</span> {meta?.expediente || meta?.fecha_presentacion || (meta?.fecha_creacion ? new Date(meta.fecha_creacion).toLocaleDateString() : 'Sin fecha')}
            </h1>
            <p className="text-[13px] text-muted-foreground font-mono mt-0.5">
              {empresa?.rut} · Presentación {meta?.anio_presentacion || '--'} {meta?.fecha_presentacion ? `· ${meta.fecha_presentacion}` : ''}
            </p>
          </div>
        </div>
      </div>

      {/* Simulador Banner */}
      {hasSimData && (
        <div className={cn(
          "rounded-xl p-4 mb-6 flex gap-6 items-center flex-wrap shadow-sm border",
          alcanza ? "bg-success/5 border-success/20" : "bg-destructive/5 border-destructive/20"
        )}>
          <div className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground/80 w-full sm:w-auto">
            BENEFICIO ESTIMADO
          </div>
          <div className="flex items-center gap-6 flex-wrap flex-1">
            <div>
              <span className={cn("text-lg font-mono font-bold", alcanza ? "text-success" : "text-destructive")}>{simResults.alcanza_minimo}</span>
              <span className="text-[11px] text-muted-foreground/70 ml-2">Puntaje Mínimo</span>
            </div>
            <div>
              <span className="text-lg font-mono font-bold text-primary">
                {simResults.exoneracion_irae_pct ? `${(simResults.exoneracion_irae_pct * 100).toFixed(1)}%` : '--'}
              </span>
              <span className="text-[11px] text-muted-foreground/70 ml-2">Exon. IRAE</span>
            </div>
            <div>
              <span className="text-lg font-mono font-bold text-foreground">
                {simResults.plazo_exoneracion || '--'}
              </span>
              <span className="text-[11px] text-muted-foreground/70 ml-2">Años Plazo</span>
            </div>
            <div>
              <span className="text-lg font-mono font-bold text-foreground">
                {simResults.puntaje_final || '--'}
              </span>
              <span className="text-[11px] text-muted-foreground/70 ml-2">Puntaje Final</span>
            </div>
          </div>
          <Button 
            variant="outline" 
            size="sm" 
            className="h-[28px] text-[11px] px-3 bg-background/50 ml-auto"
            onClick={() => setActiveTab('simulador')}
          >
            Ver detalle
          </Button>
        </div>
      )}

      {/* Tab bar */}
      <div className="flex gap-2 border-b border-border/50 mb-6 px-1">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={cn(
              'flex items-center gap-1.5 px-4 py-2.5 text-[13px] font-medium transition-all mb-[-1px] border-b-2',
              activeTab === tab.id
                ? 'border-primary text-primary'
                : 'border-transparent text-muted-foreground hover:text-foreground hover:border-muted-foreground/30',
            )}
          >
            <tab.icon size={14} strokeWidth={2} className={activeTab === tab.id ? 'opacity-100' : 'opacity-70'} />
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div className="pb-10">
        {activeTab === 'facturas' && <FacturasTab empresaId={empresaId} proyectoId={proyectoId} periodos={periodos} meta={meta} />}
        {activeTab === 'checklist' && <ChecklistTab empresaId={empresaId} proyectoId={proyectoId} />}
        {activeTab === 'simulador' && <SimuladorTab empresaId={empresaId} proyectoId={proyectoId} results={simResults} loadingResults={simLoading} onUpdateResults={setSimResults} />}
      </div>
    </div>
  )
}
