import { useEffect, useState, useCallback, useRef, useMemo } from 'react'
import { useParams, Link } from 'react-router-dom'
import { createPortal } from 'react-dom'
import {
  ArrowLeft, Upload, Download, FileText,
  CheckSquare, Check, FolderOpen, Plus, RefreshCw, X,
  ChevronLeft, ChevronRight, CalendarDays,
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
                  "w-full block text-left px-3 py-1.5 text-[12px] whitespace-nowrap hover:bg-accent transition-colors",
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

/* ─── CellDatePicker ──────────────────────────────── */

function CellDatePicker({ id, value, onChange, open, onOpen }) {
  const btnRef = useRef(null)
  const [pos, setPos] = useState({ top: 0, left: 0 })

  // value is DD/MM/YYYY
  const parseValue = (v) => {
    if (!v) return null
    const [d, m, y] = v.split('/')
    return d && m && y ? new Date(+y, +m - 1, +d) : null
  }

  const selectedDate = parseValue(value)

  const [viewDate, setViewDate] = useState(() => {
    const s = parseValue(value)
    return s ? new Date(s.getFullYear(), s.getMonth(), 1) : new Date(new Date().getFullYear(), new Date().getMonth(), 1)
  })

  const handleOpen = () => {
    if (!open && btnRef.current) {
      const rect = btnRef.current.getBoundingClientRect()
      setPos({ top: rect.bottom + 4, left: rect.left })
      const s = parseValue(value)
      if (s) setViewDate(new Date(s.getFullYear(), s.getMonth(), 1))
    }
    onOpen(open ? null : id)
  }

  const year = viewDate.getFullYear()
  const month = viewDate.getMonth()

  const today = new Date()
  today.setHours(0, 0, 0, 0)

  // Build days grid (week starts Monday)
  const days = []
  const firstDow = new Date(year, month, 1).getDay()
  const startPad = firstDow === 0 ? 6 : firstDow - 1
  for (let i = startPad - 1; i >= 0; i--) days.push({ date: new Date(year, month, -i), current: false })
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  for (let d = 1; d <= daysInMonth; d++) days.push({ date: new Date(year, month, d), current: true })
  while (days.length % 7 !== 0) days.push({ date: new Date(year, month + 1, days.length - daysInMonth - startPad + 1), current: false })

  const handleDay = (date) => {
    const d = String(date.getDate()).padStart(2, '0')
    const m = String(date.getMonth() + 1).padStart(2, '0')
    onChange(`${d}/${m}/${date.getFullYear()}`)
    onOpen(null)
  }

  const monthLabel = new Intl.DateTimeFormat('es-UY', { month: 'long', year: 'numeric' }).format(viewDate)

  return (
    <div>
      <button
        ref={btnRef}
        type="button"
        onClick={handleOpen}
        className="flex items-center justify-between gap-1.5 w-full px-2 h-full min-h-[34px] bg-transparent hover:bg-primary/5 text-[12px] text-foreground transition-colors"
      >
        <span className="truncate">{value || '--'}</span>
        <CalendarDays size={11} className="text-muted-foreground/60 shrink-0" />
      </button>

      {open && createPortal(
        <>
          <div style={{ position: 'fixed', inset: 0, zIndex: 100 }} onClick={() => onOpen(null)} />
          <div
            style={{ position: 'absolute', top: pos.top + window.scrollY, left: pos.left + window.scrollX, zIndex: 101 }}
            className="bg-popover border border-border rounded-lg shadow-lg p-3 w-60"
          >
            {/* Month navigation */}
            <div className="flex items-center justify-between mb-2.5">
              <button
                type="button"
                onClick={() => setViewDate(new Date(year, month - 1, 1))}
                className="p-1 rounded-md hover:bg-accent text-muted-foreground hover:text-foreground transition-colors"
              >
                <ChevronLeft size={13} />
              </button>
              <span className="text-[12px] font-medium text-foreground capitalize">{monthLabel}</span>
              <button
                type="button"
                onClick={() => setViewDate(new Date(year, month + 1, 1))}
                className="p-1 rounded-md hover:bg-accent text-muted-foreground hover:text-foreground transition-colors"
              >
                <ChevronRight size={13} />
              </button>
            </div>

            {/* Weekday labels */}
            <div className="grid grid-cols-7 mb-1">
              {['L', 'M', 'X', 'J', 'V', 'S', 'D'].map(d => (
                <div key={d} className="text-center text-[10px] font-medium text-muted-foreground/40 py-0.5">{d}</div>
              ))}
            </div>

            {/* Days */}
            <div className="grid grid-cols-7 gap-y-0.5">
              {days.map(({ date, current }, i) => {
                const isSel = selectedDate && date.toDateString() === selectedDate.toDateString()
                const isToday = date.toDateString() === today.toDateString()
                return (
                  <button
                    key={i}
                    type="button"
                    onClick={() => handleDay(date)}
                    className={cn(
                      'text-center text-[12px] py-1 rounded-md transition-colors',
                      isSel
                        ? 'bg-primary text-primary-foreground font-medium'
                        : isToday
                          ? 'border border-primary/30 text-primary font-medium hover:bg-accent'
                          : current
                            ? 'text-foreground hover:bg-accent'
                            : 'text-muted-foreground/25 hover:bg-accent/40',
                    )}
                  >
                    {date.getDate()}
                  </button>
                )
              })}
            </div>

            {/* Hoy shortcut */}
            <div className="mt-2 pt-2 border-t border-border flex justify-between items-center">
              <button
                type="button"
                onClick={() => { onChange(''); onOpen(null) }}
                className="text-[11px] text-muted-foreground hover:text-foreground transition-colors"
              >
                Borrar
              </button>
              <button
                type="button"
                onClick={() => handleDay(today)}
                className="text-[11px] text-primary hover:text-primary/70 transition-colors font-medium"
              >
                Hoy
              </button>
            </div>
          </div>
        </>,
        document.body
      )}
    </div>
  )
}

/* ─── Facturas ────────────────────────────────────── */

function FacturasTab({ empresaId, proyectoId, periodos, meta, empresa }) {
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

  // Load cotización del mes anterior a la fecha de presentación (o hoy si no está definida)
  useEffect(() => {
    cotApi.getMesAnterior(meta?.fecha_presentacion || null)
      .then(setCotizacion)
      .catch(() => setCotizacion(null))
      .finally(() => setLoadingCotizacion(false))
  }, [meta?.fecha_presentacion])

  // Bulk-load all periodos' results in ONE request
  useEffect(() => {
    setLoadingResults(true)
    factApi.getAllResults(empresaId, proyectoId)
      .then((grouped) => {
        // grouped = { presentacion: [...], control_2027: [...], ... }
        const cache = {}
        const counts = {}
        for (const p of periodos) {
          const items = grouped[p] || []
          cache[p] = items
          counts[p] = items.length
        }
        setResultsCache(cache)
        setPeriodoCounts(counts)
        setResults(cache[activePeriodo] || [])
      })
      .catch((err) => { console.error(err); setResults([]) })
      .finally(() => setLoadingResults(false))
  }, [empresaId, proyectoId])

  // When switching periodo, use the cache
  useEffect(() => {
    if (resultsCache[activePeriodo] !== undefined) {
      setResults(resultsCache[activePeriodo])
    }
  }, [activePeriodo, resultsCache])

  const handleEditToggle = () => {
    if (isEditing) {
      setEditedResults(results || [])
      setSelectedRows([])
      setIsEditing(false)
      return
    }
    setEditedResults(sortedDisplayResults || results || [])
    setSelectedRows([])
    setIsEditing(true)
  }

  const handleFieldChange = (id, field, value) => {
    setEditedResults(current =>
      current.map(item =>
        item.id === id
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

  const handleToggleRow = (id) => {
    setSelectedRows((current) =>
      current.includes(id)
        ? current.filter((x) => x !== id)
        : [...current, id]
    )
  }

  const handleToggleAllRows = () => {
    if (selectedRows.length === editedResults.length) {
      setSelectedRows([])
      return
    }
    setSelectedRows(editedResults.map((r) => r.id))
  }

  const handleDeleteSelected = () => {
    if (!selectedRows.length) return
    setEditedResults((current) => current.filter((r) => !selectedRows.includes(r.id)))
    setSelectedRows([])
  }

  const handleReprocesarSeleccionadas = async () => {
    const archivos = selectedRows
      .map(id => editedResults.find(r => r.id === id)?.archivo)
      .filter(Boolean)
    if (!archivos.length) return
    setReprocesando(true)
    try {
      const nuevos = await factApi.reprocesar(empresaId, proyectoId, activePeriodo, archivos)
      setEditedResults(current => [
        ...current.filter((r) => !selectedRows.includes(r.id)),
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
    if (!empresa?.fecha_balance) {
      const ok = window.confirm('La empresa no tiene fecha de balance cargada.\n¿Querés continuar de todas formas?')
      if (!ok) return
    }
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
  const [activeView, setActiveView] = useState('list')
  const [planDirty, setPlanDirty] = useState(false)
  const [planSaving, setPlanSaving] = useState(false)
  const [dragOverCol, setDragOverCol] = useState(null)

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

    const anioMap = {}
    withMonto.forEach(f => {
      const parts = (f.fecha || '').split('/')
      if (parts.length === 3) {
        const key = parts[2]
        if (!anioMap[key]) anioMap[key] = { anio: key, factura: 0, presupuesto: 0 }
        const ui = toUI(f.monto, f.moneda) ?? 0
        if (f.tipo_comprobante === 'Factura') anioMap[key].factura += ui
        else anioMap[key].presupuesto += ui
      }
    })
    const porAnio = Object.values(anioMap).sort((a, b) => a.anio.localeCompare(b.anio))
      .map(d => ({ ...d, label: d.anio }))

    return { totalUI, facturaUI, presupuestoUI, porCategoria, porAnio, total: results.length, conMonto: withMonto.length }
  }, [results, cotizacion, toUI])

  const SORT_OPTIONS = [
    { label: 'N° Comprobante', field: 'numero_factura' },
    { label: 'Proveedor', field: 'proveedor' },
    { label: 'Fecha', field: 'fecha' },
    { label: 'Monto', field: 'monto' },
    { label: 'Moneda', field: 'moneda' },
    { label: 'Categoría', field: 'categoria' },
    { label: 'Tipo', field: 'tipo_comprobante' },
    { label: 'Ejercicio', field: 'fecha_ejecucion' },
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

  const sortedDisplayResults = useMemo(() => {
    const arr = isEditing ? editedResults : results
    if (!sortField || !arr) return arr
    return [...arr].sort((a, b) => {
      const av = a[sortField] ?? ''
      const bv = b[sortField] ?? ''
      const cmp = typeof av === 'number' && typeof bv === 'number'
        ? av - bv
        : String(av).localeCompare(String(bv))
      return sortDir === 'asc' ? cmp : -cmp
    })
  }, [results, editedResults, isEditing, sortField, sortDir])

  const anioBase = meta?.anio_presentacion ? parseInt(meta.anio_presentacion) : new Date().getFullYear()

  const yearToEjercicioLabel = (year, base) => {
    const n = year - base
    return n === 0 ? `Ejercicio 0 - ${base}` : `Ejercicio ${n}`
  }

  // Extrae el año de fecha_ejecucion, que se guarda como DD/MM/YYYY
  const getYearFromFechaEjecucion = (fe) => {
    if (!fe) return null
    const parts = fe.split('/')
    if (parts.length === 3) return parseInt(parts[2])
    // fallback para registros viejos en formato YYYY-MM-DD
    return parseInt(fe.substring(0, 4))
  }

  // Investment year columns derived from periodos: each control_YYYY → investment year YYYY-1
  const planColumns = useMemo(() => {
    const controlYears = periodos
      .filter(p => p.startsWith('control_'))
      .map(p => parseInt(p.replace('control_', '')) - 1)
      .sort((a, b) => a - b)
    const years = controlYears.length > 0 ? controlYears : [anioBase, anioBase + 1, anioBase + 2]
    return [
      { key: 'antes', label: 'Antes de presentación', sub: 'Facturas emitidas', locked: true },
      ...years.map((y, i) => ({
        key: String(y),
        label: yearToEjercicioLabel(y, anioBase),
        sub: i === 0 ? 'Año de presentación · después de presentación' : null,
        locked: false,
      })),
    ]
  }, [periodos, anioBase])

  const yearOptions = useMemo(() => {
    const cols = planColumns.filter(c => !c.locked)
    if (cols.length > 0) return [{ v: '', l: '--' }, ...cols.map(c => ({ v: c.key, l: c.label }))]
    return [{ v: '', l: '--' }, ...Array.from({ length: 4 }, (_, i) => ({ v: String(anioBase + i), l: yearToEjercicioLabel(anioBase + i, anioBase) }))]
  }, [planColumns, anioBase])

  const getItemColumn = (item) => {
    if (item.tipo_comprobante === 'Factura') return 'antes'
    if (!item.fecha_ejecucion) return String(anioBase)
    const year = getYearFromFechaEjecucion(item.fecha_ejecucion)
    // clamp to first available year column
    const available = planColumns.filter(c => !c.locked).map(c => parseInt(c.key))
    if (!available.length) return String(anioBase)
    if (year < available[0]) return String(available[0])
    if (year > available[available.length - 1]) return String(available[available.length - 1])
    return String(year)
  }

  const handlePlanDrop = (e, colKey) => {
    e.preventDefault()
    setDragOverCol(null)
    if (colKey === 'antes') return
    const itemId = e.dataTransfer.getData('text/plain')
    if (!itemId || !results) return
    setResults(prev => prev.map(r => r.id === itemId ? { ...r, fecha_ejecucion: `01/01/${colKey}` } : r))
    setKanbanDirty(true)
  }

  const handlePlanSave = async () => {
    if (!results || planSaving) return
    setKanbanSaving(true)
    try {
      const saved = await factApi.updateResults(empresaId, proyectoId, activePeriodo, results)
      setResults(saved)
      setResultsCache(prev => ({ ...prev, [activePeriodo]: saved }))
      setKanbanDirty(false)
    } catch (err) { console.error(err) }
    finally { setKanbanSaving(false) }
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
                {sub && <p className="text-[11px] text-muted-foreground/70 mt-0.5">{sub}</p>}
              </div>
            ))}
          </div>

          {/* Gráfico de inversión anual */}
          {kpis.porAnio.length > 0 && (
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground mb-2">Inversión por año (UI)</p>
              <ResponsiveContainer width="100%" height={180}>
                <BarChart data={kpis.porAnio} margin={{ top: 4, right: 8, left: 8, bottom: 0 }} barSize={18}>
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

      {/* ── View toggle ─────────────────────────────────── */}
      <div className="flex items-center gap-0.5 border-b border-border/60">
        {[{ key: 'list', label: 'Comprobantes' }, { key: 'plan', label: 'Plan de ejecución' }].map(v => (
          <button
            key={v.key}
            onClick={() => setActiveView(v.key)}
            className={cn(
              "px-4 py-2 text-[12px] font-medium rounded-t-md border border-b-0 transition-all duration-150 whitespace-nowrap",
              activeView === v.key
                ? "border-border/60 bg-background text-foreground -mb-px"
                : "border-transparent text-muted-foreground hover:text-foreground hover:border-border/40 hover:bg-card/60"
            )}
          >
            {v.label}
          </button>
        ))}
      </div>

      {/* ── Plan view ──────────────────────────────────── */}
      {activeView === 'plan' && (
        <div className="bg-card/30 border border-border/50 rounded-xl p-5 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
              Plan de ejecución · <span className="normal-case font-normal">{activePeriodo === 'presentacion' ? 'Presentación' : `Control ${activePeriodo.replace('control_', '')}`}</span>
            </h2>
            {(planDirty || planSaving) && (
              <Button
                onClick={handlePlanSave}
                disabled={planSaving}
                size="sm"
                className="h-[28px] text-[11px] gap-1.5"
              >
                {planSaving ? <><Spinner size={12} /> Guardando...</> : <><Check size={13} /> Guardar plan</>}
              </Button>
            )}
          </div>
          {loadingResults ? (
            <LoadingState message="Cargando..." />
          ) : (
            <div className="flex gap-3 overflow-x-auto pb-2">
              {planColumns.map(col => {
                const items = (results || []).filter(r => getItemColumn(r) === col.key)
                const isOver = dragOverCol === col.key && !col.locked
                return (
                  <div
                    key={col.key}
                    className={cn(
                      "flex flex-col rounded-lg border transition-colors",
                      "min-w-[210px] w-[210px]",
                      isOver ? "border-primary/60 bg-primary/5" : "border-border/50 bg-muted/10"
                    )}
                    onDragOver={(e) => { e.preventDefault(); if (!col.locked) setDragOverCol(col.key) }}
                    onDragLeave={() => setDragOverCol(null)}
                    onDrop={(e) => handlePlanDrop(e, col.key)}
                  >
                    <div className="px-3 py-2.5 border-b border-border/40">
                      <p className="text-[12px] font-semibold text-foreground">{col.label}</p>
                      {col.sub && <p className="text-[10px] text-muted-foreground/70 mt-0.5">{col.sub}</p>}
                      <p className="text-[10px] text-muted-foreground/50 mt-1">{items.length} item{items.length !== 1 ? 's' : ''}</p>
                    </div>
                    <div className="flex flex-col gap-2 p-2 flex-1 min-h-[140px]">
                      {items.map(item => {
                        const isFactura = item.tipo_comprobante === 'Factura'
                        return (
                          <div
                            key={item.id}
                            draggable={!isFactura}
                            onDragStart={(e) => e.dataTransfer.setData('text/plain', item.id)}
                            className={cn(
                              "rounded-md border p-2.5 text-[11px] space-y-1 select-none",
                              isFactura
                                ? "border-border/30 bg-card/50 opacity-60 cursor-default"
                                : "border-border/50 bg-card cursor-grab active:cursor-grabbing hover:border-primary/50 hover:shadow-sm transition-all"
                            )}
                          >
                            <div className="flex items-center justify-between gap-1">
                              <Badge className={cn(
                                "text-[9px] h-4 px-1.5 border-transparent font-medium",
                                isFactura ? "bg-primary/15 text-primary" : "bg-warning/15 text-warning"
                              )}>
                                {item.tipo_comprobante || 'Sin tipo'}
                              </Badge>
                              {isFactura && <span className="text-[10px] text-muted-foreground/50" title="Bloqueada">⬤</span>}
                            </div>
                            <p className="font-medium text-foreground truncate" title={item.proveedor}>{item.proveedor || '(sin proveedor)'}</p>
                            {item.monto != null && (
                              <p className="text-muted-foreground">{item.moneda} {item.monto.toLocaleString()}</p>
                            )}
                            {item.categoria && <p className="text-muted-foreground/60 truncate">{item.categoria}</p>}
                          </div>
                        )
                      })}
                      {!col.locked && items.length === 0 && (
                        <div className="flex-1 flex items-center justify-center rounded-md border border-dashed border-border/30 min-h-[80px]">
                          <p className="text-[11px] text-muted-foreground/40 text-center px-2">Arrastrá presupuestos acá</p>
                        </div>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}

      {/* ── List view ─────────────────────────────────────── */}
      {activeView === 'list' && <div className="grid grid-cols-1 gap-6">
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
                    className="h-[28px] text-[11px] gap-1.5 bg-[#22b86c] hover:bg-[#1aa35f] text-white"
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
                  <span className="bg-card border border-border/60 rounded px-2 py-0.5">
                    USD <span className="text-foreground font-semibold">${cotizacion.valor_usd.toFixed(2)}</span>
                  </span>
                  <span className="bg-card border border-border/60 rounded px-2 py-0.5">
                    UI <span className="text-foreground font-semibold">${cotizacion.valor_ui.toFixed(2)}</span>
                  </span>
                  <span className="text-[11px] text-muted-foreground/70">al {cotizacion.fecha}</span>
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
                          { label: 'Ejercicio', field: 'fecha_ejecucion' },
                          { label: 'Estado', field: null },
                        ].map(({ label, field }) => (
                          <th
                            key={label}
                            onClick={field ? () => handleSort(field) : undefined}
                            className={cn(
                              "py-2.5 text-left text-[11px] font-semibold uppercase tracking-wide text-muted-foreground select-none",
                              isEditing ? "px-2 border-r border-border/30 last:border-r-0" : "px-3",
                              field && "cursor-pointer hover:text-foreground transition-colors"
                            )}
                          >
                            {label}
                            {field && sortField === field && (
                              <span className="ml-1 opacity-70">{sortDir === 'asc' ? '↑' : '↓'}</span>
                            )}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className={cn(isEditing ? "" : "divide-y divide-border/50")}>
                      {(sortedDisplayResults || []).map((r, i) => {
                        const completado = r.proveedor && r.fecha && r.monto
                        const cellEdit = "p-0 border-r border-b border-border/25 last:border-r-0"
                        const inputEdit = "w-full min-h-[34px] bg-transparent text-foreground px-2 py-1 text-[12px] outline-none focus:bg-primary/5 placeholder:text-muted-foreground/40"
                        const selectEdit = "w-full min-h-[34px] bg-background text-foreground px-2 py-1 text-[12px] outline-none focus:bg-primary/5 cursor-pointer"

                        return (
                          <tr key={r.id ?? i} className={cn(isEditing ? "last:border-b-0" : "bg-card hover:bg-accent/30 transition-colors")}>
                            {isEditing && (
                              <td className="w-8 px-3 border-r border-b border-border/25">
                                <input
                                  type="checkbox"
                                  checked={selectedRows.includes(r.id)}
                                  onChange={() => handleToggleRow(r.id)}
                                />
                              </td>
                            )}
                            {/* Descripción */}
                            <td className={isEditing ? cellEdit : "px-3 py-2.5 max-w-[220px]"}>
                              {isEditing ? (
                                <input value={r.descripcion || ''} onChange={(e) => handleFieldChange(r.id, 'descripcion', e.target.value)} className={inputEdit} />
                              ) : (
                                <div className="truncate" title={r.descripcion || ''}>{r.descripcion || '--'}</div>
                              )}
                            </td>
                            {/* N° Factura */}
                            <td className={isEditing ? cellEdit : "px-3 py-2.5 whitespace-nowrap"}>
                              {isEditing ? (
                                <input value={r.numero_factura || ''} onChange={(e) => handleFieldChange(r.id, 'numero_factura', e.target.value)} className={inputEdit} />
                              ) : (
                                r.numero_factura || '--'
                              )}
                            </td>
                            {/* Proveedor */}
                            <td className={isEditing ? cellEdit : "px-3 py-2.5"}>
                              {isEditing ? (
                                <input value={r.proveedor || ''} onChange={(e) => handleFieldChange(r.id, 'proveedor', e.target.value)} className={inputEdit} />
                              ) : (
                                r.proveedor || '--'
                              )}
                            </td>
                            {/* Fecha */}
                            <td className={isEditing ? cellEdit : "px-3 py-2.5 whitespace-nowrap"}>
                              {isEditing ? (
                                <CellDatePicker
                                  id={`fecha-${r.id}`}
                                  value={r.fecha || ''}
                                  onChange={(v) => handleFieldChange(r.id, 'fecha', v)}
                                  open={openDropdown === `fecha-${r.id}`}
                                  onOpen={setOpenDropdown}
                                />
                              ) : (
                                r.fecha || '--'
                              )}
                            </td>
                            {/* Monto */}
                            <td className={isEditing ? cellEdit : "px-3 py-2.5 text-right"}>
                              {isEditing ? (
                                <input type="number" step="0.01" value={r.monto ?? ''} onChange={(e) => handleFieldChange(r.id, 'monto', e.target.value)} className={cn(inputEdit, "text-right w-24")} />
                              ) : (
                                r.monto != null ? r.monto.toLocaleString() : '--'
                              )}
                            </td>
                            {/* Moneda */}
                            <td className={isEditing ? cellEdit : "px-3 py-2.5"}>
                              {isEditing ? (
                                <CellDropdown
                                  id={`${r.id}-moneda`}
                                  value={(r.moneda || '').trim()}
                                  options={[{ v: '', l: '--' }, { v: 'UYU', l: 'UYU' }, { v: 'USD', l: 'USD' }]}
                                  onChange={(v) => handleFieldChange(r.id, 'moneda', v)}
                                  open={openDropdown === `${r.id}-moneda`}
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
                                  id={`${r.id}-categoria`}
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
                                  onChange={(v) => handleFieldChange(r.id, 'categoria', v)}
                                  open={openDropdown === `${r.id}-categoria`}
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
                                  id={`${r.id}-tipo`}
                                  value={r.tipo_comprobante || ''}
                                  options={[{ v: '', l: '--' }, { v: 'Factura', l: 'Factura' }, { v: 'Presupuesto', l: 'Presupuesto' }]}
                                  onChange={(v) => handleFieldChange(r.id, 'tipo_comprobante', v)}
                                  open={openDropdown === `${r.id}-tipo`}
                                  onOpen={setOpenDropdown}
                                />
                              ) : (
                                r.tipo_comprobante || '--'
                              )}
                            </td>
                            {/* Año ejecución */}
                            <td className={isEditing ? cellEdit : "px-3 py-2.5 whitespace-nowrap"}>
                              {isEditing ? (
                                <CellDropdown
                                  id={`${r.id}-anio-ejec`}
                                  value={r.fecha_ejecucion ? String(getYearFromFechaEjecucion(r.fecha_ejecucion)) : ''}
                                  options={yearOptions}
                                  onChange={(v) => handleFieldChange(r.id, 'fecha_ejecucion', v ? `01/01/${v}` : null)}
                                  open={openDropdown === `${r.id}-anio-ejec`}
                                  onOpen={setOpenDropdown}
                                />
                              ) : (
                                r.fecha_ejecucion ? yearToEjercicioLabel(getYearFromFechaEjecucion(r.fecha_ejecucion), anioBase) : '--'
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
      </div>}
    </div>
  )
}

/* ─── Checklist ───────────────────────────────────── */

const ESTADO_ORDER = { pendiente: 0, completado: 1, no_aplica: 2 }

function ChecklistTab({ empresaId, proyectoId, onCountUpdate }) {
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [uploadingId, setUploadingId] = useState(null)
  const [downloadingId, setDownloadingId] = useState(null)

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
              <p className="text-[13px] text-muted-foreground mt-0.5">
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
          <FacturasTab empresaId={empresaId} proyectoId={proyectoId} periodos={periodos} meta={meta} empresa={empresa} />
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
