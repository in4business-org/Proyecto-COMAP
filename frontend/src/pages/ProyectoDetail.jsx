import { useEffect, useState, useCallback, useRef, useMemo } from 'react'
import { useParams, Link } from 'react-router-dom'
import { createPortal } from 'react-dom'
import {
  ArrowLeft, Upload, Download, FileText,
  CheckSquare, Check, FolderOpen, Plus, RefreshCw, X
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { LoadingState, EmptyState, Spinner } from '@/components/ui/loading'
import { cn } from '@/lib/utils'
import { empresas as empApi, proyectos as projApi, facturas as factApi, checklist as checkApi, cotizaciones as cotApi } from '@/lib/api'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts'

/* ─── CellDropdown ────────────────────────────────── */

function CellDropdown({ id, value, options, onChange, open, onOpen }) {
  const btnRef = useRef(null)
  const [pos, setPos] = useState({ top: 0, left: 0 })
  const label = options.find(o => o.v === value)?.l ?? '--'

  const handleOpen = () => {
    if (!open && btnRef.current) {
      const rect = btnRef.current.getBoundingClientRect()
      setPos({ top: rect.bottom + 4, left: rect.left })
    }
    onOpen(open ? null : id)
  }

  return (
    <div>
      <button
        ref={btnRef}
        type="button"
        onClick={handleOpen}
        className="flex items-center justify-between gap-1.5 w-full px-2 h-full min-h-[34px] bg-transparent hover:bg-primary/5 text-[12px] text-foreground transition-colors"
      >
        <span className="truncate">{label}</span>
        <span className="text-[9px] text-muted-foreground shrink-0">▼</span>
      </button>
      {open && createPortal(
        <>
          <div style={{ position: 'fixed', inset: 0, zIndex: 100 }} onClick={() => onOpen(null)} />
          <div
            style={{ position: 'absolute', top: pos.top + window.scrollY, left: pos.left + window.scrollX, zIndex: 101, width: 'max-content', minWidth: '120px' }}
            className="bg-popover border border-border rounded-lg shadow-lg py-1"
          >
            {options.map(({ v, l }) => (
              <button
                key={v}
                type="button"
                onClick={() => { onChange(v); onOpen(null) }}
                className={cn(
                  "block text-left px-3 py-1.5 text-[12px] whitespace-nowrap hover:bg-accent transition-colors",
                  value === v ? "text-foreground font-medium" : "text-muted-foreground"
                )}
              >
                {l}
              </button>
            ))}
          </div>
        </>,
        document.body
      )}
    </div>
  )
}

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
  const [reprocesando, setReprocesando] = useState(false)
  const [openDropdown, setOpenDropdown] = useState(null)
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

  const handleReprocesarSeleccionadas = async () => {
    const archivos = selectedRows
      .map(i => editedResults[i]?.archivo)
      .filter(Boolean)
    if (!archivos.length) return
    setReprocesando(true)
    try {
      const nuevos = await factApi.reprocesar(empresaId, proyectoId, activePeriodo, archivos)
      setEditedResults(current => [
        ...current.filter((_, i) => !selectedRows.includes(i)),
        ...nuevos,
      ])
      setSelectedRows([])
    } catch (err) {
      console.error(err)
    } finally {
      setReprocesando(false)
    }
  }

  const handleUpload = async () => {
    if (!files.length) return
    setUploadMsg('')
    const isExcel = files.length === 1 && files[0].name.toLowerCase().endsWith('.xlsx')
    if (isExcel) {
      await handleImportMasivo(files[0])
      setFiles([])
      document.getElementById('factura-upload').value = ''
      return
    }
    setUploading(true)
    try {
      const prevCount = results?.length || 0
      const updated = await factApi.uploadAndProcess(empresaId, proyectoId, activePeriodo, files)
      setResults(updated)
      setResultsCache(prev => ({ ...prev, [activePeriodo]: updated }))
      setPeriodoCounts(prev => ({ ...prev, [activePeriodo]: updated?.length || 0 }))
      const nuevas = (updated?.length || 0) - prevCount
      setUploadMsg(nuevas > 0 ? `${nuevas} factura(s) procesada(s)` : 'Archivos procesados sin nuevas facturas detectadas')
      setFiles([])
      document.getElementById('factura-upload').value = ''
    } catch (err) {
      console.error(err)
      setUploadMsg('Error al procesar los archivos')
    }
    finally { setUploading(false) }
  }

  const handleAddRow = () => {
    setEditedResults(current => [...current, {
      descripcion: '', numero_factura: '', proveedor: '', rut: '',
      fecha: '', monto: null, moneda: 'UYU', cantidad: 1,
      categoria: null, tipo_comprobante: 'Factura', rut_receptor: '', razon_social_receptor: '',
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

  const handleImportMasivo = async (file) => {
    if (!file) return
    setImporting(true)
    try {
      const updated = await factApi.importar(empresaId, proyectoId, activePeriodo, file)
      setResults(updated)
      setResultsCache(prev => ({ ...prev, [activePeriodo]: updated }))
      setPeriodoCounts(prev => ({ ...prev, [activePeriodo]: updated?.length || 0 }))
      setUploadMsg('Importación masiva completada')
    } catch (err) {
      console.error(err)
      setUploadMsg('Error al importar el archivo')
    } finally {
      setImporting(false)
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
  
  const [sortField, setSortField] = useState('numero_factura')
  const [sortDir, setSortDir] = useState('desc')
  const [sortOpen, setSortOpen] = useState(false)

  const toUI = useCallback((monto, moneda) => {
    if (monto == null || !cotizacion) return null
    const pesos = moneda === 'USD' ? monto * cotizacion.valor_usd : monto
    return pesos / cotizacion.valor_ui
  }, [cotizacion])

  const fmtUI = (n) => n == null ? '--' : `UI ${Math.round(n).toLocaleString('es-UY')}`
  const fmtPct = (n, total) => total > 0 ? `${((n / total) * 100).toFixed(1)}%` : '--'

  const kpis = useMemo(() => {
    if (!results?.length || !cotizacion) return null
    const withMonto = results.filter(f => f.monto != null)
    if (!withMonto.length) return null

    const totalUI = withMonto.reduce((s, f) => s + (toUI(f.monto, f.moneda) ?? 0), 0)
    const facturaUI = withMonto.filter(f => f.tipo_comprobante === 'Factura')
      .reduce((s, f) => s + (toUI(f.monto, f.moneda) ?? 0), 0)
    const presupuestoUI = withMonto.filter(f => f.tipo_comprobante === 'Presupuesto')
      .reduce((s, f) => s + (toUI(f.monto, f.moneda) ?? 0), 0)

    const catMap = {}
    withMonto.forEach(f => {
      const cat = f.categoria || 'Sin categoría'
      catMap[cat] = (catMap[cat] || 0) + (toUI(f.monto, f.moneda) ?? 0)
    })
    const porCategoria = Object.entries(catMap)
      .sort((a, b) => b[1] - a[1])
      .map(([cat, ui]) => ({ cat, ui }))

    const mesMap = {}
    withMonto.forEach(f => {
      const parts = (f.fecha || '').split('/')
      if (parts.length === 3) {
        const key = `${parts[2]}-${parts[1]}`
        if (!mesMap[key]) mesMap[key] = { mes: key, factura: 0, presupuesto: 0 }
        const ui = toUI(f.monto, f.moneda) ?? 0
        if (f.tipo_comprobante === 'Factura') mesMap[key].factura += ui
        else mesMap[key].presupuesto += ui
      }
    })
    const porMes = Object.values(mesMap).sort((a, b) => a.mes.localeCompare(b.mes))
      .map(d => ({
        ...d,
        label: (() => {
          const [y, m] = d.mes.split('-')
          const meses = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic']
          return `${meses[parseInt(m, 10) - 1]} ${y.slice(2)}`
        })()
      }))

    return { totalUI, facturaUI, presupuestoUI, porCategoria, porMes, total: results.length, conMonto: withMonto.length }
  }, [results, cotizacion, toUI])

  const SORT_OPTIONS = [
    { label: 'N° Comprobante', field: 'numero_factura' },
    { label: 'Proveedor', field: 'proveedor' },
    { label: 'Fecha', field: 'fecha' },
    { label: 'Monto', field: 'monto' },
    { label: 'Moneda', field: 'moneda' },
    { label: 'Categoría', field: 'categoria' },
    { label: 'Tipo', field: 'tipo_comprobante' },
    { label: 'Actualización', field: 'updatedAt' },
  ]

  const handleSort = (field) => {
    if (sortField === field) {
      setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    } else {
      setSortField(field)
      setSortDir('asc')
    }
  }

  const sortedResults = (arr) => {
    if (!sortField || !arr) return arr
    return [...arr].sort((a, b) => {
      const av = a[sortField] ?? ''
      const bv = b[sortField] ?? ''
      const cmp = typeof av === 'number' && typeof bv === 'number'
        ? av - bv
        : String(av).localeCompare(String(bv))
      return sortDir === 'asc' ? cmp : -cmp
    })
  }

  return (
    <div className="space-y-6 animate-fade-in">
      
      {/* Pestañas de Períodos */}
      <div className="flex items-center gap-0.5 border-b border-border/60">
        {periodos.map(p => {
          const isPresentacion = p === 'presentacion'
          const anio = isPresentacion ? meta?.anio_presentacion : p.replace('control_', '')
          const label = isPresentacion ? `Presentación ${anio}` : `Control ${anio}`
          const active = activePeriodo === p

          return (
            <button
              key={p}
              onClick={() => setActivePeriodo(p)}
              className={cn(
                "px-4 py-2 text-[12px] font-medium rounded-t-md border border-b-0 transition-all duration-150 whitespace-nowrap",
                active
                  ? "border-border/60 bg-background text-foreground -mb-px"
                  : "border-transparent text-muted-foreground hover:text-foreground hover:border-border/40 hover:bg-card/60"
              )}
            >
              {label}
            </button>
          )
        })}
      </div>

      {/* ── KPI Panel ─────────────────────────────────── */}
      {kpis && (
        <div className="bg-card/30 border border-border/50 rounded-xl p-5 shadow-sm space-y-5">
          <h2 className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
            Resumen · <span className="normal-case font-normal">{activePeriodo === 'presentacion' ? 'Presentación' : `Control ${activePeriodo.replace('control_', '')}`}</span>
          </h2>

          {/* Tarjetas de resumen */}
          <div className="grid grid-cols-3 gap-3">
            {[
              { label: 'Total inversión', val: fmtUI(kpis.totalUI), sub: `${kpis.total} comprobante${kpis.total !== 1 ? 's' : ''}` },
              { label: 'Facturas', val: fmtUI(kpis.facturaUI), sub: fmtPct(kpis.facturaUI, kpis.totalUI) + ' del total', color: 'text-primary' },
              { label: 'Presupuestos', val: fmtUI(kpis.presupuestoUI), sub: fmtPct(kpis.presupuestoUI, kpis.totalUI) + ' del total', color: 'text-warning' },
            ].map(({ label, val, sub, color }) => (
              <div key={label} className="bg-card border border-border/60 rounded-lg p-3">
                <p className={cn('text-[14px] font-medium truncate', color || 'text-foreground')}>{val}</p>
                <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground mt-1">{label}</p>
                {sub && <p className="text-[10px] text-muted-foreground/50 mt-0.5">{sub}</p>}
              </div>
            ))}
          </div>

          {/* Gráfico de inversión mensual */}
          {kpis.porMes.length > 0 && (
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground mb-2">Inversión por mes (UI)</p>
              <ResponsiveContainer width="100%" height={180}>
                <BarChart data={kpis.porMes} margin={{ top: 4, right: 8, left: 8, bottom: 0 }} barSize={18}>
                  <CartesianGrid strokeDasharray="3 3" stroke="currentColor" strokeOpacity={0.08} />
                  <XAxis dataKey="label" tick={{ fontSize: 10, fill: 'var(--muted-foreground)' }} axisLine={false} tickLine={false} />
                  <YAxis
                    tick={{ fontSize: 10, fill: 'var(--muted-foreground)' }}
                    axisLine={false}
                    tickLine={false}
                    tickFormatter={(v) => v >= 1000 ? `${Math.round(v / 1000)}k` : Math.round(v)}
                    width={40}
                  />
                  <Tooltip
                    formatter={(value, name) => [fmtUI(value), name === 'factura' ? 'Factura' : 'Presupuesto']}
                    contentStyle={{ fontSize: 11, borderRadius: 6, border: '1px solid var(--border)', background: 'var(--card)', color: 'var(--foreground)' }}
                    cursor={{ fill: 'var(--muted)', fillOpacity: 0.3 }}
                  />
                  <Legend
                    formatter={(value) => <span style={{ fontSize: 10, color: 'var(--muted-foreground)' }}>{value === 'factura' ? 'Factura' : 'Presupuesto'}</span>}
                    iconSize={8}
                    wrapperStyle={{ paddingTop: 6 }}
                  />
                  <Bar dataKey="factura" name="factura" fill="var(--primary)" radius={[3, 3, 0, 0]} />
                  <Bar dataKey="presupuesto" name="presupuesto" fill="var(--warning)" radius={[3, 3, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}

          {/* Desglose por categoría */}
          {kpis.porCategoria.length > 0 && (
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground mb-2">Inversión por categoría (UI)</p>
              <div className="space-y-1.5">
                {kpis.porCategoria.map(({ cat, ui }) => {
                  const pct = (ui / kpis.porCategoria[0].ui) * 100
                  return (
                    <div key={cat} className="flex items-center gap-2">
                      <span className="text-[11px] text-muted-foreground w-40 shrink-0 truncate">{cat}</span>
                      <div className="flex-1 bg-muted/40 rounded-full h-1.5 overflow-hidden">
                        <div className="h-full bg-primary/70 rounded-full" style={{ width: `${pct}%` }} />
                      </div>
                      <span className="text-[11px] text-foreground w-28 text-right shrink-0">{fmtUI(ui)}</span>
                    </div>
                  )
                })}
              </div>
            </div>
          )}
        </div>
      )}

      <div className="grid grid-cols-1 gap-6">
        {/* Upload area */}
        <div className="bg-card/30 border border-border/50 rounded-xl p-5 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
              Archivos · {activePeriodo === 'presentacion' ? 'Presentación' : `Control ${activePeriodo.replace('control_', '')}`}
            </h2>
            <Button
              onClick={handleDownloadTemplate}
              variant="outline"
              size="sm"
              className="h-[26px] text-[11px] gap-1.5"
            >
              <Download size={12} />
              Template Excel
            </Button>
          </div>

          <div className="rounded-xl border-[1.5px] border-dashed border-border/60 p-8 text-center bg-card/10 hover:bg-primary/5 hover:border-primary/40 transition-colors group">
            <input
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
                  {uploading ? <><Spinner size={12} className="mr-2"/> Procesando...</>
                    : importing ? <><Spinner size={12} className="mr-2"/> Importando...</>
                    : files.length === 1 && files[0].name.toLowerCase().endsWith('.xlsx') ? 'Importar Excel'
                    : 'Subir y procesar'}
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
                  <Button
                    onClick={handleExport}
                    disabled={exporting || !results?.length}
                    variant="default"
                    size="sm"
                    className="h-[28px] text-[11px] gap-1.5 bg-success hover:bg-success/90 text-success-foreground"
                  >
                    {exporting ? <Spinner size={12} /> : <Download size={13} />}
                    Exportar COMAP
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
                    onClick={handleReprocesarSeleccionadas}
                    disabled={!selectedRows.some(i => editedResults[i]?.archivo) || reprocesando}
                    variant="secondary"
                    size="sm"
                    className="h-[28px] text-[11px] gap-1.5"
                  >
                    {reprocesando ? <Spinner size={12} /> : <RefreshCw size={13} />}
                    Reprocesar seleccionadas
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
            </div>
          </div>
          
          {/* Cotización */}
          <div className="flex items-center justify-between gap-3 mb-4 text-[12px] text-muted-foreground">
            <div className="flex items-center gap-3">
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
            <div className="relative">
              <button
                onClick={() => setSortOpen(o => !o)}
                className="flex items-center gap-1.5 px-2.5 h-7 rounded border border-border/60 bg-card hover:bg-accent text-[11px] text-muted-foreground hover:text-foreground transition-all"
              >
                {SORT_OPTIONS.find(o => o.field === sortField)?.label ?? 'Ordenar'}
                <span className="text-[10px]">{sortDir === 'asc' ? '↑' : '↓'}</span>
              </button>
              {sortOpen && (
                <>
                  <div className="fixed inset-0 z-10" onClick={() => setSortOpen(false)} />
                  <div className="absolute right-0 top-full mt-1 z-20 bg-popover border border-border rounded-lg shadow-lg py-1 min-w-40">
                    {SORT_OPTIONS.map(({ label, field }) => (
                      <button
                        key={field}
                        onClick={() => { handleSort(field); setSortOpen(false) }}
                        className={cn(
                          "w-full text-left px-3 py-1.5 text-[12px] flex items-center justify-between hover:bg-accent transition-colors",
                          sortField === field ? "text-foreground font-medium" : "text-muted-foreground"
                        )}
                      >
                        {label}
                        {sortField === field && <span className="text-[10px] ml-2">{sortDir === 'asc' ? '↑' : '↓'}</span>}
                      </button>
                    ))}
                  </div>
                </>
              )}
            </div>
          </div>

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
                        {[
                          { label: 'Descripción', field: null },
                          { label: 'N° Comprobante', field: 'numero_factura' },
                          { label: 'Proveedor', field: 'proveedor' },
                          { label: 'Fecha', field: 'fecha' },
                          { label: 'Monto', field: 'monto' },
                          { label: 'Moneda', field: 'moneda' },
                          { label: 'Categoría', field: 'categoria' },
                          { label: 'Tipo', field: 'tipo_comprobante' },
                          { label: 'Estado', field: null },
                        ].map(({ label, field }) => (
                          <th
                            key={label}
                            onClick={field && !isEditing ? () => handleSort(field) : undefined}
                            className={cn(
                              "py-2.5 text-left text-[11px] font-semibold uppercase tracking-wide text-muted-foreground select-none",
                              isEditing ? "px-2 border-r border-border/30 last:border-r-0" : "px-3",
                              field && !isEditing && "cursor-pointer hover:text-foreground transition-colors"
                            )}
                          >
                            {label}
                            {field && !isEditing && sortField === field && (
                              <span className="ml-1 opacity-70">{sortDir === 'asc' ? '↑' : '↓'}</span>
                            )}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className={cn(isEditing ? "" : "divide-y divide-border/50")}>
                      {(isEditing ? editedResults : sortedResults(results)).map((r, i) => {
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
                            <td className={isEditing ? cellEdit : "px-3 py-2.5 whitespace-nowrap"}>
                              {isEditing ? (
                                <input value={r.numero_factura || ''} onChange={(e) => handleFieldChange(i, 'numero_factura', e.target.value)} className={inputEdit} />
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
                            <td className={isEditing ? cellEdit : "px-3 py-2.5 whitespace-nowrap"}>
                              {isEditing ? (
                                <input type="date" value={toDateInput(r.fecha || '')} onChange={(e) => handleFieldChange(i, 'fecha', fromDateInput(e.target.value))} className={cn(inputEdit, "dark:scheme-dark")} />
                              ) : (
                                r.fecha || '--'
                              )}
                            </td>
                            {/* Monto */}
                            <td className={isEditing ? cellEdit : "px-3 py-2.5 text-right"}>
                              {isEditing ? (
                                <input type="number" step="0.01" value={r.monto ?? ''} onChange={(e) => handleFieldChange(i, 'monto', e.target.value)} className={cn(inputEdit, "text-right w-24")} />
                              ) : (
                                r.monto != null ? r.monto.toLocaleString() : '--'
                              )}
                            </td>
                            {/* Moneda */}
                            <td className={isEditing ? cellEdit : "px-3 py-2.5"}>
                              {isEditing ? (
                                <CellDropdown
                                  id={`${i}-moneda`}
                                  value={(r.moneda || '').trim()}
                                  options={[{ v: '', l: '--' }, { v: 'UYU', l: 'UYU' }, { v: 'USD', l: 'USD' }]}
                                  onChange={(v) => handleFieldChange(i, 'moneda', v)}
                                  open={openDropdown === `${i}-moneda`}
                                  onOpen={setOpenDropdown}
                                />
                              ) : (
                                r.moneda || '--'
                              )}
                            </td>
                            {/* Categoría */}
                            <td className={isEditing ? cellEdit : "px-3 py-2.5"}>
                              {isEditing ? (
                                <CellDropdown
                                  id={`${i}-categoria`}
                                  value={r.categoria || ''}
                                  options={[
                                    { v: '', l: '--' },
                                    { v: 'Maquinaria', l: 'Maquinaria' },
                                    { v: 'Equipos', l: 'Equipos' },
                                    { v: 'Instalaciones', l: 'Instalaciones' },
                                    { v: 'Vehiculos', l: 'Vehículos' },
                                    { v: 'MEIV/Imprevistos', l: 'MEIV/Imprevistos' },
                                    { v: 'Materiales', l: 'Materiales' },
                                    { v: 'Mano de Obra Directa', l: 'Mano de Obra Directa' },
                                    { v: 'Mano de Obra Indirecta', l: 'Mano de Obra Indirecta' },
                                    { v: 'Leyes Sociales', l: 'Leyes Sociales' },
                                    { v: 'Honorarios', l: 'Honorarios' },
                                    { v: 'OC/Imprevistos', l: 'OC/Imprevistos' },
                                  ]}
                                  onChange={(v) => handleFieldChange(i, 'categoria', v)}
                                  open={openDropdown === `${i}-categoria`}
                                  onOpen={setOpenDropdown}
                                />
                              ) : (
                                r.categoria || '--'
                              )}
                            </td>
                            {/* Tipo de comprobante */}
                            <td className={isEditing ? cellEdit : "px-3 py-2.5 whitespace-nowrap"}>
                              {isEditing ? (
                                <CellDropdown
                                  id={`${i}-tipo`}
                                  value={r.tipo_comprobante || ''}
                                  options={[{ v: '', l: '--' }, { v: 'Factura', l: 'Factura' }, { v: 'Presupuesto', l: 'Presupuesto' }]}
                                  onChange={(v) => handleFieldChange(i, 'tipo_comprobante', v)}
                                  open={openDropdown === `${i}-tipo`}
                                  onOpen={setOpenDropdown}
                                />
                              ) : (
                                r.tipo_comprobante || '--'
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

const ESTADO_ORDER = { pendiente: 0, completado: 1, no_aplica: 2 }

function ChecklistTab({ empresaId, proyectoId, onCountUpdate }) {
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [uploadingId, setUploadingId] = useState(null)

  const load = useCallback(() => {
    setLoading(true)
    checkApi.get(empresaId, proyectoId).then(setItems).catch(console.error).finally(() => setLoading(false))
  }, [empresaId, proyectoId])

  useEffect(() => { load() }, [load])

  useEffect(() => {
    const pendientes = items.filter(i => i.estado === 'pendiente').length
    onCountUpdate?.(pendientes)
  }, [items, onCountUpdate])

  const handleToggle = async (item, targetState) => {
    const nuevoEstado = item.estado === targetState ? 'pendiente' : targetState
    setItems(currentItems => currentItems.map(i =>
      i.id === item.id ? { ...i, estado: nuevoEstado } : i
    ))
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
      setItems(currentItems => currentItems.map(i =>
        i.id === itemId ? { ...i, estado: 'completado', archivo: file.name } : i
      ))
    } catch (error) {
      console.error(error)
      load()
    } finally {
      setUploadingId(null)
    }
  }

  const [naOpen, setNaOpen] = useState(false)

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
                <a href={`/api/empresas/${empresaId}/proyectos/${proyectoId}/checklist/${item.id}/archivo`} target="_blank" rel="noreferrer" className="text-primary hover:underline ml-1">Descargar</a>
              </div>
            )}
          </div>
        </div>
        <div className="flex items-center gap-1.5 pl-6">
          {item.acepta_archivo && (
            <>
              <input type="file" id={`cf-${item.id}`} className="hidden" onChange={(e) => e.target.files[0] && handleFileUpload(item.id, e.target.files[0])} />
              <label htmlFor={`cf-${item.id}`} className="cursor-pointer text-[10px] font-medium border border-border/60 rounded px-2 h-[22px] flex items-center bg-background hover:bg-primary/5 hover:border-primary/30 transition-all gap-1">
                {uploadingId === item.id ? <><Spinner size={9} /> Subiendo</> : '📎 Subir'}
              </label>
            </>
          )}
          <button
            onClick={() => handleToggle(item, 'completado')}
            className={cn(
              'h-[22px] px-2 rounded border text-[10px] font-medium transition-all',
              isOk ? 'bg-success/15 border-success/40 text-success' : 'bg-background border-border/60 text-muted-foreground hover:border-success/50 hover:text-success'
            )}
          >✓ OK</button>
          <button
            onClick={() => handleToggle(item, 'no_aplica')}
            className={cn(
              'h-[22px] px-2 rounded border text-[10px] font-medium transition-all',
              isNa ? 'bg-muted border-border/80 text-foreground' : 'bg-background border-border/60 text-muted-foreground hover:border-muted-foreground/50 hover:text-foreground'
            )}
          >N/A</button>
        </div>
      </div>
    )
  }

  return (
    <div className="p-4 space-y-5">
      <p className="text-[11px] text-muted-foreground">
        <span className="text-warning font-medium">{pendientes} pendientes</span>
        {' · '}<span className="text-success font-medium">{completados} completados</span>
        {naItems.length > 0 && <>{' · '}{naItems.length} N/A</>}
      </p>

      {Object.entries(sections).map(([seccion, sectionItems], sidx) => (
        <div key={seccion} className={sidx > 0 ? "mt-4" : ""}>
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

/* ─── Main ────────────────────────────────────────── */

export default function ProyectoDetail() {
  const { empresaId, proyectoId } = useParams()
  const [empresa, setEmpresa] = useState(null)
  const [meta, setMeta] = useState(null)
  const [loading, setLoading] = useState(true)
  const [checklistOpen, setChecklistOpen] = useState(false)
  const [checklistPendientes, setChecklistPendientes] = useState(null)

  useEffect(() => {
    Promise.all([
      empApi.get(empresaId).catch(() => null),
      projApi.list(empresaId).catch(() => [])
    ]).then(([empData, projs]) => {
      setEmpresa(empData)
      setMeta(projs.find((x) => x.id === proyectoId) || {})
    }).finally(() => {
      setLoading(false)
    })
  }, [empresaId, proyectoId])

  if (loading) return <LoadingState />

  const periodos = ['presentacion']
  if (meta?.anio_presentacion && meta?.duracion_seguimiento) {
    for (let i = 1; i <= meta.duracion_seguimiento; i++) {
      periodos.push(`control_${meta.anio_presentacion + i}`)
    }
  }

  return (
    <>
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
          <button
            onClick={() => setChecklistOpen(o => !o)}
            className="flex items-center gap-2 px-3 h-9 rounded-lg border border-border/60 bg-card hover:bg-accent hover:border-primary/40 transition-all text-[12px] font-medium text-muted-foreground hover:text-foreground shrink-0"
          >
            <CheckSquare size={14} strokeWidth={2} />
            Checklist
            {checklistPendientes !== null && checklistPendientes > 0 && (
              <span className="bg-warning/20 text-warning text-[10px] rounded-full px-1.5 py-0.5 font-semibold leading-none">
                {checklistPendientes}
              </span>
            )}
          </button>
        </div>

        {/* Facturas (vista principal) */}
        <div className="pb-10">
          <FacturasTab empresaId={empresaId} proyectoId={proyectoId} periodos={periodos} meta={meta} />
        </div>
      </div>


      {/* Panel checklist */}
      <div className={cn(
        "fixed top-0 right-0 h-screen w-[440px] z-50 bg-background border-l border-border shadow-2xl flex flex-col transition-transform duration-300",
        checklistOpen ? "translate-x-0" : "translate-x-full"
      )}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-border/60 shrink-0">
          <h2 className="text-[14px] font-semibold">Checklist presentación</h2>
          <button
            onClick={() => setChecklistOpen(false)}
            className="rounded-md p-1.5 hover:bg-accent transition-colors text-muted-foreground hover:text-foreground"
          >
            <X size={15} />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto">
          <ChecklistTab
            empresaId={empresaId}
            proyectoId={proyectoId}
            onCountUpdate={setChecklistPendientes}
          />
        </div>
      </div>
    </>
  )
}
