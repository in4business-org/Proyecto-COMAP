import { useEffect, useState } from 'react'
import { FileText, Trash2, X } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input, Label } from '@/components/ui/input'
import { Spinner } from '@/components/ui/loading'
import { cn } from '@/lib/utils'
import { anioDe } from '@/lib/fechas'
import { aUI, fmtMonto, fmtUI } from '@/lib/inversion'
import { etiquetaEjercicio } from '@/lib/proyecto'
import { CATEGORIAS, MONEDAS, TIPOS_COMPROBANTE } from '@/lib/constantes'
import { ESTADOS } from '@/lib/revision'

const soloDigitos = (v) => String(v || '').replace(/\D/g, '')

function Select({ id, value, onChange, opciones, vacio = 'Sin elegir' }) {
  return (
    <select
      id={id}
      value={value || ''}
      onChange={(e) => onChange(e.target.value || null)}
      className="flex h-10 w-full rounded-lg border border-input bg-background px-3 text-sm cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      <option value="">{vacio}</option>
      {opciones.map(({ v, l }) => <option key={v} value={v}>{l}</option>)}
    </select>
  )
}

/** Formulario para corregir los datos de un comprobante */
function Formulario({ comprobante, opcionesEjercicio, onGuardar, onCancelar }) {
  const [form, setForm] = useState(comprobante)
  const [guardando, setGuardando] = useState(false)
  const set = (k) => (v) => setForm((f) => ({ ...f, [k]: v }))
  const anio = anioDe(form.fecha_ejecucion)

  const guardar = async (e) => {
    e.preventDefault()
    setGuardando(true)
    try {
      await onGuardar({
        ...form,
        monto: form.monto === '' || form.monto == null ? null : Number(form.monto),
      })
    } finally {
      setGuardando(false)
    }
  }

  const campo = (k, label, props = {}) => (
    <div className="space-y-1.5">
      <Label htmlFor={`det-${k}`}>{label}</Label>
      <Input id={`det-${k}`} value={form[k] ?? ''} onChange={(e) => set(k)(e.target.value)} {...props} />
    </div>
  )

  return (
    <form onSubmit={guardar} className="space-y-3">
      {campo('proveedor', 'Proveedor')}
      <div className="grid grid-cols-2 gap-3">
        {campo('numero_factura', 'Número')}
        {campo('fecha', 'Fecha', { placeholder: 'DD/MM/AAAA', inputMode: 'numeric' })}
      </div>
      <div className="grid grid-cols-[1fr_96px] gap-3">
        {campo('monto', 'Monto', { type: 'number', step: '0.01', inputMode: 'decimal' })}
        <div className="space-y-1.5">
          <Label htmlFor="det-moneda">Moneda</Label>
          <Select id="det-moneda" value={form.moneda} onChange={set('moneda')} opciones={MONEDAS} vacio="--" />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        {campo('rut', 'RUT del proveedor', { inputMode: 'numeric' })}
        {campo('rut_receptor', 'RUT receptor', { inputMode: 'numeric' })}
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="det-categoria">Categoría</Label>
        <Select id="det-categoria" value={form.categoria} onChange={set('categoria')} opciones={CATEGORIAS} />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label htmlFor="det-tipo">Tipo</Label>
          <Select id="det-tipo" value={form.tipo_comprobante} onChange={set('tipo_comprobante')} opciones={TIPOS_COMPROBANTE} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="det-ejercicio">Se ejecuta en</Label>
          <Select
            id="det-ejercicio"
            value={anio ? String(anio) : ''}
            onChange={(v) => set('fecha_ejecucion')(v ? `01/01/${v}` : null)}
            opciones={opcionesEjercicio.filter((o) => o.v)}
          />
        </div>
      </div>
      {campo('descripcion', 'Qué se compró')}
      <div className="flex justify-end gap-2 pt-1">
        <Button type="button" variant="ghost" size="sm" onClick={onCancelar}>Cancelar</Button>
        <Button type="submit" size="sm" disabled={guardando}>
          {guardando ? <><Spinner size={14} className="text-primary-foreground" /> Guardando...</> : 'Guardar'}
        </Button>
      </div>
    </form>
  )
}

/**
 * Panel con el detalle de un comprobante: qué revisar, los datos y las
 * acciones. La vista previa del PDF queda para después de la migración de
 * archivos.
 */
export function DetalleComprobante({
  comprobante: c, cotizacion, rutEmpresa, anioBase, opcionesEjercicio, puedeEditar,
  onGuardar, onEliminar, onCerrar,
}) {
  const [editando, setEditando] = useState(false)
  useEffect(() => { setEditando(false) }, [c?.id])
  if (!c) return null

  const estado = ESTADOS[c.estado]
  const ui = aUI(c.monto, c.moneda, cotizacion)
  const rutRecDistinto = soloDigitos(c.rut_receptor) && soloDigitos(rutEmpresa) && soloDigitos(c.rut_receptor) !== soloDigitos(rutEmpresa)
  const anio = anioDe(c.fecha_ejecucion)

  const datos = [
    ['Comprobante', [c.tipo_comprobante, c.numero_factura].filter(Boolean).join(' ') || '--'],
    ['Fecha', c.fecha || '--'],
    ['Monto', c.monto == null ? '--' : `${c.moneda || ''} ${fmtMonto(c.monto)}${ui != null && c.monto ? ` (≈ ${fmtUI(ui)})` : ''}`],
    ['RUT proveedor', c.rut || '--'],
    ['RUT receptor', c.rut_receptor ? `${c.rut_receptor}${rutRecDistinto ? ' (no coincide)' : ''}` : '--', rutRecDistinto],
    ['Categoría', c.categoria || 'Sin categoría'],
    ['Se ejecuta en', anio ? etiquetaEjercicio(anio, anioBase) : '--'],
    ['Cargado por', c.texto_extraido ? 'Lectura automática del PDF' : c.archivo ? 'Archivo subido, sin lectura automática' : 'A mano o desde Excel'],
  ]

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <h2 className="text-[16px] font-medium leading-snug">{c.proveedor || 'Sin proveedor'}</h2>
          {c.descripcion && <p className="text-[12px] text-muted-foreground mt-0.5">{c.descripcion}</p>}
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <Badge variant={estado.variant}>{estado.label}</Badge>
          <button type="button" onClick={onCerrar} aria-label="Cerrar el detalle" className="rounded-md p-1.5 text-muted-foreground hover:bg-accent hover:text-foreground cursor-pointer">
            <X size={16} />
          </button>
        </div>
      </div>

      {c.problemas.length > 0 && (
        <div className={cn('space-y-1.5 rounded-lg border px-3 py-2.5 text-[13px]', c.estado === 'revisar' ? 'border-warning/40 bg-warning/10' : 'border-destructive/30 bg-destructive/10')}>
          <p className="font-semibold">Qué revisar</p>
          <ul className="space-y-1.5">
            {c.problemas.map((p) => (
              <li key={p.tipo}><span className="font-medium">{p.texto}.</span> {p.ayuda}</li>
            ))}
          </ul>
        </div>
      )}

      {editando ? (
        <Formulario
          comprobante={c}
          opcionesEjercicio={opcionesEjercicio}
          onCancelar={() => setEditando(false)}
          onGuardar={async (cambios) => { await onGuardar(cambios); setEditando(false) }}
        />
      ) : (
        <>
          <div className="flex h-32 flex-col items-center justify-center gap-1.5 rounded-lg border border-dashed border-border bg-muted/40 text-center text-[12px] text-muted-foreground">
            <FileText size={20} aria-hidden="true" />
            {c.archivo ? <>Pronto vas a poder ver el PDF acá<span className="font-mono text-[11px]">{c.archivo}</span></> : 'Este comprobante no tiene PDF'}
          </div>
          <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-[13px]">
            {datos.map(([k, v, alerta]) => (
              <div key={k} className="contents">
                <dt className="text-muted-foreground">{k}</dt>
                <dd className={cn('min-w-0 break-words', alerta && 'font-medium text-destructive')}>{v}</dd>
              </div>
            ))}
          </dl>
          {puedeEditar && (
            <div className="flex flex-wrap gap-2 pt-1">
              <Button size="sm" onClick={() => setEditando(true)}>Corregir datos</Button>
              <Button variant="ghost" size="sm" onClick={() => onEliminar(c)} className="text-destructive hover:bg-destructive/10">
                <Trash2 size={14} aria-hidden="true" /> Borrar
              </Button>
            </div>
          )}
        </>
      )}
    </div>
  )
}
