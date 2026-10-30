import { useEffect, useMemo, useState } from 'react'
import { Check, Plus, RefreshCw, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { LoadingState, Spinner } from '@/components/ui/loading'
import { cn } from '@/lib/utils'
import { facturas as factApi } from '@/lib/api'
import { anioDe } from '@/lib/fechas'
import { fmtMonto } from '@/lib/inversion'
import { etiquetaEjercicio } from '@/lib/proyecto'
import { CATEGORIAS, TIPOS_COMPROBANTE, MONEDAS } from '@/lib/constantes'
import { CellDropdown, CellDatePicker } from './CeldasEditables'

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

const COLUMNAS = [
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
]

const conVacio = (opciones) => [{ v: '', l: '--' }, ...opciones]

const FILA_NUEVA = {
  descripcion: '', numero_factura: '', proveedor: '', rut: '',
  fecha: '', monto: null, moneda: 'UYU', cantidad: 1,
  categoria: null, tipo_comprobante: 'Factura', rut_receptor: '', razon_social_receptor: '',
  texto_extraido: false,
}

/**
 * Planilla de comprobantes de un período: edición celda por celda, orden y
 * la cotización usada.
 */
export function TablaComprobantes({
  empresaId, proyectoId, periodo, comprobantes, cargando,
  cotizacion, cargandoCotizacion, puedeEditar, anioBase, opcionesEjercicio,
  categoria, onQuitarCategoria, onActualizar,
}) {
  const [isEditing, setIsEditing] = useState(false)
  const [editedResults, setEditedResults] = useState([])
  const [savingEdit, setSavingEdit] = useState(false)
  const [selectedRows, setSelectedRows] = useState([])
  const [reprocesando, setReprocesando] = useState(false)
  const [errorReproceso, setErrorReproceso] = useState(null)
  const [openDropdown, setOpenDropdown] = useState(null)
  const [sortField, setSortField] = useState('numero_factura')
  const [sortDir, setSortDir] = useState('desc')
  const [sortOpen, setSortOpen] = useState(false)

  useEffect(() => {
    setEditedResults(comprobantes || [])
  }, [comprobantes])

  const sortedDisplayResults = useMemo(() => {
    const arr = isEditing ? editedResults : comprobantes
    if (!sortField || !arr) return arr
    return [...arr].sort((a, b) => {
      const av = a[sortField] ?? ''
      const bv = b[sortField] ?? ''
      const cmp = typeof av === 'number' && typeof bv === 'number'
        ? av - bv
        : String(av).localeCompare(String(bv))
      return sortDir === 'asc' ? cmp : -cmp
    })
  }, [comprobantes, editedResults, isEditing, sortField, sortDir])

  // El filtro por categoría sólo cambia lo que se ve: guardar manda siempre la
  // lista completa del período, si no se borrarían las filas ocultas.
  const enCategoria = (r) => !categoria || (categoria === 'Sin categoría' ? !r.categoria : r.categoria === categoria)
  const visibles = (sortedDisplayResults || []).filter(enCategoria)

  const handleSort = (field) => {
    if (sortField === field) {
      setSortDir(d => (d === 'asc' ? 'desc' : 'asc'))
    } else {
      setSortField(field)
      setSortDir('asc')
    }
  }

  const handleEditToggle = () => {
    setEditedResults(isEditing ? comprobantes || [] : sortedDisplayResults || comprobantes || [])
    setSelectedRows([])
    setIsEditing(!isEditing)
  }

  const handleFieldChange = (id, field, value) => {
    const numerico = field === 'monto' || field === 'cantidad'
    setEditedResults(current =>
      current.map(item =>
        item.id === id
          ? { ...item, [field]: numerico ? (value === '' ? null : Number(value)) : value }
          : item
      )
    )
  }

  const handleSaveEdit = async () => {
    setSavingEdit(true)
    try {
      onActualizar(await factApi.updateResults(empresaId, proyectoId, periodo, editedResults))
      setSelectedRows([])
      setIsEditing(false)
    } catch (err) {
      console.error(err)
    } finally {
      setSavingEdit(false)
    }
  }

  const handleToggleRow = (id) => {
    setSelectedRows(current => (current.includes(id) ? current.filter(x => x !== id) : [...current, id]))
  }

  const handleToggleAllRows = () => {
    const ids = editedResults.filter(enCategoria).map(r => r.id)
    setSelectedRows(selectedRows.length === ids.length ? [] : ids)
  }

  const handleDeleteSelected = () => {
    if (!selectedRows.length) return
    setEditedResults(current => current.filter(r => !selectedRows.includes(r.id)))
    setSelectedRows([])
  }

  const handleReprocesarSeleccionadas = async () => {
    const archivos = selectedRows
      .map(id => editedResults.find(r => r.id === id)?.archivo)
      .filter(Boolean)
    if (!archivos.length) return
    setReprocesando(true)
    setErrorReproceso(null)
    try {
      const { comprobantes: nuevos, errores = [] } = await factApi.reprocesar(empresaId, proyectoId, periodo, archivos)
      // Sólo se reemplazan las filas cuyo archivo se volvió a leer; las que fallaron quedan como estaban
      const releidos = new Set(nuevos.map(c => c.archivo))
      const reemplazar = (r) => selectedRows.includes(r.id) && releidos.has(r.archivo)
      setEditedResults(current => [...current.filter(r => !reemplazar(r)), ...nuevos])
      setSelectedRows([])
      setErrorReproceso(errores.length ? `No pudimos leer ${errores.map(e => e.archivo).join(', ')}: ${errores[0].mensaje}` : null)
    } catch (err) {
      setErrorReproceso(`No se pudo reprocesar: ${err.message}`)
    } finally {
      setReprocesando(false)
    }
  }

  const handleAddRow = () => setEditedResults(current => [...current, { ...FILA_NUEVA }])

  const btn = 'h-[28px] text-[11px] gap-1.5'
  const cellEdit = 'p-0 border-r border-b border-border/25 last:border-r-0'
  const inputEdit = 'w-full min-h-[34px] bg-transparent text-foreground px-2 py-1 text-[12px] outline-none focus:bg-primary/5 placeholder:text-muted-foreground/40'

  const dropdown = (r, campo, value, options, toValue = (v) => v) => (
    <CellDropdown
      id={`${r.id}-${campo}`}
      value={value}
      options={options}
      onChange={(v) => handleFieldChange(r.id, campo, toValue(v))}
      open={openDropdown === `${r.id}-${campo}`}
      onOpen={setOpenDropdown}
    />
  )

  return (
    <div className="bg-card/30 border border-border/50 rounded-xl p-5 shadow-sm">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-5 gap-3">
        <h2 className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">Resultados</h2>
        <div className="flex gap-2 flex-wrap">
          {!isEditing ? (
            <>
              {puedeEditar && (
                <Button onClick={handleEditToggle} disabled={cargando} variant="outline" size="sm" className={btn}>
                  Editar
                </Button>
              )}
            </>
          ) : (
            <>
              <Button onClick={handleAddRow} variant="outline" size="sm" className={btn}>
                <Plus size={13} />
                Agregar
              </Button>
              <Button onClick={handleSaveEdit} disabled={savingEdit} variant="default" size="sm" className={btn}>
                {savingEdit ? <Spinner size={12} /> : <Check size={13} />}
                Ok
              </Button>
              <Button onClick={handleEditToggle} disabled={savingEdit} variant="outline" size="sm" className={btn}>
                Cancelar
              </Button>
              <Button
                onClick={handleReprocesarSeleccionadas}
                disabled={!selectedRows.some(id => editedResults.find(r => r.id === id)?.archivo) || reprocesando}
                variant="secondary"
                size="sm"
                className={btn}
              >
                {reprocesando ? <Spinner size={12} /> : <RefreshCw size={13} />}
                Reprocesar seleccionadas
              </Button>
              <Button
                onClick={handleDeleteSelected}
                disabled={!selectedRows.length || savingEdit}
                variant="destructive"
                size="sm"
                className={btn}
              >
                Eliminar seleccionadas
              </Button>
            </>
          )}
        </div>
      </div>

      {errorReproceso && (
        <p role="alert" className="mb-4 rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-[12px] text-destructive">
          {errorReproceso}
        </p>
      )}

      {/* Cotización y orden */}
      <div className="flex items-center justify-between gap-3 mb-4 text-[12px] text-muted-foreground">
        <div className="flex items-center gap-3">
          <span className="font-semibold uppercase tracking-wider text-[10px]">Cotización</span>
          {cargandoCotizacion ? (
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
                      'w-full text-left px-3 py-1.5 text-[12px] flex items-center justify-between hover:bg-accent transition-colors',
                      sortField === field ? 'text-foreground font-medium' : 'text-muted-foreground'
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

      {categoria && (
        <div className="mb-4 flex items-center gap-2 text-[12px]">
          <span className="text-muted-foreground">Mostrando sólo</span>
          <span className="inline-flex items-center gap-1 rounded-md border border-primary/30 bg-primary/10 pl-2 pr-1 py-0.5 font-medium text-primary">
            {categoria}
            <button type="button" onClick={onQuitarCategoria} aria-label="Quitar el filtro de categoría" className="rounded p-0.5 hover:bg-primary/15 cursor-pointer">
              <X size={12} />
            </button>
          </span>
          <span className="text-muted-foreground">({visibles.length})</span>
        </div>
      )}

      {cargando && <LoadingState message="Cargando resultados guardados..." />}

      {comprobantes && !cargando && (
        <div>
          {comprobantes.length > 0 || isEditing ? (
            <div className={cn('overflow-x-auto shadow-sm', isEditing ? 'border border-border/60 rounded-lg' : 'border border-border/80 rounded-lg')}>
              <table className={cn('w-full text-[12px] min-w-[860px]', isEditing && 'border-collapse')}>
                <thead>
                  <tr className={cn('border-b', isEditing ? 'border-border/50 bg-muted/30' : 'border-border/60')}>
                    {isEditing && (
                      <th className="w-8 px-3 py-2 border-r border-border/30">
                        <input
                          type="checkbox"
                          aria-label="Seleccionar todos"
                          checked={visibles.length > 0 && selectedRows.length === visibles.length}
                          onChange={handleToggleAllRows}
                        />
                      </th>
                    )}
                    {COLUMNAS.map(({ label, field }) => (
                      <th
                        key={label}
                        onClick={field ? () => handleSort(field) : undefined}
                        className={cn(
                          'py-2.5 text-left text-[11px] font-semibold uppercase tracking-wide text-muted-foreground select-none',
                          isEditing ? 'px-2 border-r border-border/30 last:border-r-0' : 'px-3',
                          field && 'cursor-pointer hover:text-foreground transition-colors'
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
                <tbody className={cn(isEditing ? '' : 'divide-y divide-border/50')}>
                  {visibles.map((r, i) => {
                    const completado = r.proveedor && r.fecha && r.monto
                    const anioEjec = anioDe(r.fecha_ejecucion)

                    return (
                      <tr key={r.id ?? i} className={cn(isEditing ? 'last:border-b-0' : 'bg-card hover:bg-accent/30 transition-colors')}>
                        {isEditing && (
                          <td className="w-8 px-3 border-r border-b border-border/25">
                            <input
                              type="checkbox"
                              aria-label="Seleccionar fila"
                              checked={selectedRows.includes(r.id)}
                              onChange={() => handleToggleRow(r.id)}
                            />
                          </td>
                        )}
                        <td className={isEditing ? cellEdit : 'px-3 py-2.5 max-w-[220px]'}>
                          {isEditing ? (
                            <input value={r.descripcion || ''} onChange={(e) => handleFieldChange(r.id, 'descripcion', e.target.value)} className={inputEdit} />
                          ) : (
                            <div className="truncate" title={r.descripcion || ''}>{r.descripcion || '--'}</div>
                          )}
                        </td>
                        <td className={isEditing ? cellEdit : 'px-3 py-2.5 whitespace-nowrap'}>
                          {isEditing ? (
                            <input value={r.numero_factura || ''} onChange={(e) => handleFieldChange(r.id, 'numero_factura', e.target.value)} className={inputEdit} />
                          ) : (
                            r.numero_factura || '--'
                          )}
                        </td>
                        <td className={isEditing ? cellEdit : 'px-3 py-2.5'}>
                          {isEditing ? (
                            <input value={r.proveedor || ''} onChange={(e) => handleFieldChange(r.id, 'proveedor', e.target.value)} className={inputEdit} />
                          ) : (
                            r.proveedor || '--'
                          )}
                        </td>
                        <td className={isEditing ? cellEdit : 'px-3 py-2.5 whitespace-nowrap'}>
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
                        <td className={isEditing ? cellEdit : 'px-3 py-2.5 text-right'}>
                          {isEditing ? (
                            <input type="number" step="0.01" value={r.monto ?? ''} onChange={(e) => handleFieldChange(r.id, 'monto', e.target.value)} className={cn(inputEdit, 'text-right w-24')} />
                          ) : (
                            fmtMonto(r.monto)
                          )}
                        </td>
                        <td className={isEditing ? cellEdit : 'px-3 py-2.5'}>
                          {isEditing ? dropdown(r, 'moneda', (r.moneda || '').trim(), conVacio(MONEDAS)) : (r.moneda || '--')}
                        </td>
                        <td className={isEditing ? cellEdit : 'px-3 py-2.5'}>
                          {isEditing ? dropdown(r, 'categoria', r.categoria || '', conVacio(CATEGORIAS)) : (r.categoria || '--')}
                        </td>
                        <td className={isEditing ? cellEdit : 'px-3 py-2.5 whitespace-nowrap'}>
                          {isEditing ? dropdown(r, 'tipo_comprobante', r.tipo_comprobante || '', conVacio(TIPOS_COMPROBANTE)) : (r.tipo_comprobante || '--')}
                        </td>
                        <td className={isEditing ? cellEdit : 'px-3 py-2.5 whitespace-nowrap'}>
                          {isEditing
                            ? dropdown(r, 'fecha_ejecucion', anioEjec ? String(anioEjec) : '', opcionesEjercicio, (v) => (v ? `01/01/${v}` : null))
                            : (anioEjec ? etiquetaEjercicio(anioEjec, anioBase) : '--')}
                        </td>
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
  )
}
