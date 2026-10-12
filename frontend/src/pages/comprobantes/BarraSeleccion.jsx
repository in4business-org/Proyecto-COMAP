import { useState } from 'react'
import { Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { CATEGORIAS, TIPOS_COMPROBANTE } from '@/lib/constantes'

function Cambio({ label, opciones, onAplicar, disabled }) {
  const [valor, setValor] = useState('')
  const id = `lote-${label}`
  return (
    <div className="flex items-center gap-1.5">
      <label htmlFor={id} className="text-[12px] text-muted-foreground whitespace-nowrap">{label}</label>
      <select
        id={id}
        value={valor}
        disabled={disabled}
        onChange={(e) => setValor(e.target.value)}
        className="h-9 max-w-[180px] rounded-md border border-input bg-background px-2 text-[13px] cursor-pointer"
      >
        <option value="">Elegí...</option>
        {opciones.map(({ v, l }) => <option key={v} value={v}>{l}</option>)}
      </select>
      <Button
        variant="outline"
        size="sm"
        disabled={!valor || disabled}
        onClick={() => { onAplicar(valor); setValor('') }}
      >
        Aplicar
      </Button>
    </div>
  )
}

/** Barra que aparece al marcar comprobantes: cambia categoría, tipo o ejercicio a todos juntos */
export function BarraSeleccion({ cantidad, opcionesEjercicio, ocupado, onCambiar, onBorrar, onLimpiar }) {
  return (
    <div role="toolbar" aria-label="Cambiar los seleccionados" className="flex flex-wrap items-center gap-x-4 gap-y-2 border-b border-border bg-accent/60 px-4 py-2.5">
      <span className="text-[13px] font-semibold">{cantidad} seleccionado{cantidad !== 1 ? 's' : ''}</span>
      <Cambio label="Categoría" opciones={CATEGORIAS} disabled={ocupado} onAplicar={(v) => onCambiar({ categoria: v }, `categoría ${CATEGORIAS.find((c) => c.v === v)?.l}`)} />
      <Cambio label="Tipo" opciones={TIPOS_COMPROBANTE} disabled={ocupado} onAplicar={(v) => onCambiar({ tipo_comprobante: v }, `tipo ${v}`)} />
      <Cambio
        label="Se ejecuta en"
        opciones={opcionesEjercicio.filter((o) => o.v)}
        disabled={ocupado}
        onAplicar={(v) => onCambiar({ fecha_ejecucion: `01/01/${v}` }, opcionesEjercicio.find((o) => o.v === v)?.l)}
      />
      <div className="flex items-center gap-1 sm:ml-auto">
        <Button variant="ghost" size="sm" disabled={ocupado} onClick={onBorrar} className="text-destructive hover:bg-destructive/10">
          <Trash2 size={14} aria-hidden="true" /> Borrar
        </Button>
        <Button variant="ghost" size="sm" onClick={onLimpiar}>Cancelar</Button>
      </div>
    </div>
  )
}
