import { cn } from '@/lib/utils'
import {
  Building2,
  FolderOpen,
  FileCheck,
  FileText,
  DollarSign,
  Calculator,
  Headphones,
  CheckCircle2,
  Circle,
  Search,
  Link2,
} from 'lucide-react'

const toolIcons = {
  obtener_empresa: Building2,
  listar_proyectos: FolderOpen,
  ver_checklist: FileCheck,
  actualizar_item_checklist: FileCheck,
  ver_facturas_periodo: FileText,
  ver_todas_facturas: FileText,
  obtener_cotizacion: DollarSign,
  ver_resultados_simulador: Calculator,
  buscar_empresa: Search,
  vincular_empresa: Link2,
  derivar_a_gestor: Headphones,
}

const toolTitles = {
  obtener_empresa: 'Datos de la empresa',
  listar_proyectos: 'Proyectos',
  ver_checklist: 'Checklist documental',
  actualizar_item_checklist: 'Actualización de checklist',
  ver_facturas_periodo: 'Facturas del periodo',
  ver_todas_facturas: 'Todas las facturas',
  obtener_cotizacion: 'Cotización',
  ver_resultados_simulador: 'Resultados del simulador',
  buscar_empresa: 'Búsqueda de empresa',
  vincular_empresa: 'Vinculación de empresa',
  derivar_a_gestor: 'Derivación a gestor',
}

function EmpresaResult({ data }) {
  if (data.error) return <p className="text-destructive text-sm">{data.error}</p>
  const fields = [
    ['Nombre', data.nombre],
    ['RUT', data.rut],
    ['Razón social', data.razon_social],
    ['Email', data.email],
    ['Teléfono', data.telefono],
    ['Giro', data.giro],
    ['Domicilio fiscal', data.domicilio_fiscal],
  ].filter(([, v]) => v)

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
      {fields.map(([label, value]) => (
        <div key={label}>
          <span className="text-[11px] text-muted-foreground uppercase tracking-wide">{label}</span>
          <p className="text-sm font-medium">{value}</p>
        </div>
      ))}
    </div>
  )
}

function ProyectosResult({ data }) {
  if (!data.proyectos?.length) return <p className="text-sm text-muted-foreground">{data.mensaje || 'Sin proyectos'}</p>
  return (
    <div className="space-y-2">
      <p className="text-xs text-muted-foreground">{data.total} proyecto(s)</p>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border text-left">
              <th className="py-1.5 pr-3 text-xs font-medium text-muted-foreground">Expediente</th>
              <th className="py-1.5 pr-3 text-xs font-medium text-muted-foreground">Año</th>
              <th className="py-1.5 pr-3 text-xs font-medium text-muted-foreground">Seguimiento</th>
              <th className="py-1.5 text-xs font-medium text-muted-foreground">Presentación</th>
            </tr>
          </thead>
          <tbody>
            {data.proyectos.map(p => (
              <tr key={p.id} className="border-b border-border/50">
                <td className="py-1.5 pr-3 font-medium">{p.expediente}</td>
                <td className="py-1.5 pr-3">{p.anio_presentacion}</td>
                <td className="py-1.5 pr-3">{p.duracion_seguimiento} años</td>
                <td className="py-1.5">{p.fecha_presentacion}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function ChecklistResult({ data }) {
  if (!data.items?.length) return <p className="text-sm text-muted-foreground">Sin items en el checklist</p>
  return (
    <div className="space-y-2">
      <div className="flex gap-3 text-xs">
        <span className="text-success">{data.completados} completados</span>
        <span className="text-warning">{data.pendientes} pendientes</span>
        <span className="text-muted-foreground">{data.total} total</span>
      </div>
      <div className="space-y-1 max-h-60 overflow-y-auto">
        {data.items.map(item => (
          <div key={item.id} className="flex items-start gap-2 py-1">
            {item.estado === 'completado' ? (
              <CheckCircle2 size={14} className="text-success mt-0.5 shrink-0" />
            ) : (
              <Circle size={14} className="text-muted-foreground/40 mt-0.5 shrink-0" />
            )}
            <div className="min-w-0">
              <p className={cn('text-sm leading-tight', item.estado === 'completado' && 'text-muted-foreground')}>
                {item.descripcion}
              </p>
              {item.nota && <p className="text-xs text-muted-foreground mt-0.5">{item.nota}</p>}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

function FacturasResult({ data }) {
  const facturas = data.facturas || []
  if (!facturas.length) return <p className="text-sm text-muted-foreground">{data.mensaje || 'Sin facturas'}</p>
  return (
    <div className="space-y-2">
      <p className="text-xs text-muted-foreground">{data.total || facturas.length} factura(s) — {data.periodo}</p>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border text-left">
              <th className="py-1.5 pr-3 text-xs font-medium text-muted-foreground">Proveedor</th>
              <th className="py-1.5 pr-3 text-xs font-medium text-muted-foreground">N°</th>
              <th className="py-1.5 pr-3 text-xs font-medium text-muted-foreground">Fecha</th>
              <th className="py-1.5 pr-3 text-xs font-medium text-muted-foreground">Monto</th>
              <th className="py-1.5 text-xs font-medium text-muted-foreground">Moneda</th>
            </tr>
          </thead>
          <tbody>
            {facturas.map(f => (
              <tr key={f.id} className="border-b border-border/50">
                <td className="py-1.5 pr-3 font-medium truncate max-w-[150px]">{f.proveedor}</td>
                <td className="py-1.5 pr-3">{f.numero_factura}</td>
                <td className="py-1.5 pr-3">{f.fecha || '-'}</td>
                <td className="py-1.5 pr-3 font-mono">{f.monto != null ? f.monto.toLocaleString() : '-'}</td>
                <td className="py-1.5">{f.moneda}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function TodasFacturasResult({ data }) {
  if (!data.periodos?.length) return <p className="text-sm text-muted-foreground">Sin facturas</p>
  return (
    <div className="space-y-3">
      <p className="text-xs text-muted-foreground">{data.total} factura(s) en total</p>
      {data.periodos.map(p => (
        <div key={p.periodo}>
          <p className="text-xs font-medium text-foreground mb-1">{p.periodo} ({p.cantidad})</p>
          <FacturasResult data={{ facturas: p.facturas, periodo: p.periodo }} />
        </div>
      ))}
    </div>
  )
}

function CotizacionResult({ data }) {
  if (data.error) return <p className="text-destructive text-sm">{data.error}</p>
  return (
    <div className="flex gap-6">
      <div>
        <span className="text-[11px] text-muted-foreground uppercase tracking-wide">USD</span>
        <p className="text-xl font-semibold font-mono">${data.valor_usd?.toFixed(2)}</p>
      </div>
      <div>
        <span className="text-[11px] text-muted-foreground uppercase tracking-wide">UI</span>
        <p className="text-xl font-semibold font-mono">${data.valor_ui?.toFixed(4)}</p>
      </div>
      <div>
        <span className="text-[11px] text-muted-foreground uppercase tracking-wide">Fecha</span>
        <p className="text-sm mt-1">{data.fecha}</p>
      </div>
    </div>
  )
}

function SimuladorResult({ data }) {
  if (data.mensaje) return <p className="text-sm text-muted-foreground">{data.mensaje}</p>
  const fields = [
    ['Puntaje final', data.puntaje_final],
    ['Alcanza mínimo', data.alcanza_minimo],
    ['Exoneración IRAE %', data.exoneracion_irae_pct],
    ['Exoneración UI', data.exoneracion_ui],
    ['Plazo exoneración', data.plazo_exoneracion],
  ].filter(([, v]) => v != null)

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
      {fields.map(([label, value]) => (
        <div key={label}>
          <span className="text-[11px] text-muted-foreground uppercase tracking-wide">{label}</span>
          <p className="text-lg font-semibold">{value}</p>
        </div>
      ))}
    </div>
  )
}

function HandoffResult({ data }) {
  return (
    <div className="flex items-center gap-2 text-sm">
      <Headphones size={16} className="text-warning" />
      <p>{data.mensaje}</p>
    </div>
  )
}

function BuscarEmpresaResult({ data }) {
  if (data.error) return <p className="text-destructive text-sm">{data.error}</p>
  if (!data.empresas?.length) return <p className="text-sm text-muted-foreground">{data.mensaje || 'No se encontraron empresas'}</p>
  return (
    <div className="space-y-2">
      <p className="text-xs text-muted-foreground">{data.total} empresa(s) encontrada(s)</p>
      <div className="space-y-1.5">
        {data.empresas.map(e => (
          <div key={e.id} className="flex items-center gap-3 py-1.5 px-2 rounded-md bg-accent/50">
            <Building2 size={14} className="text-primary shrink-0" />
            <div className="min-w-0">
              <p className="text-sm font-medium truncate">{e.nombre}</p>
              <p className="text-xs text-muted-foreground">RUT: {e.rut}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

function VincularEmpresaResult({ data }) {
  if (data.error) return <p className="text-destructive text-sm">{data.error}</p>
  return (
    <div className="flex items-center gap-2 text-sm">
      <CheckCircle2 size={16} className="text-success shrink-0" />
      <div>
        <p className="font-medium text-success">{data.mensaje || 'Empresa vinculada exitosamente'}</p>
        {data.empresa && (
          <p className="text-xs text-muted-foreground mt-0.5">{data.empresa.nombre} — RUT: {data.empresa.rut}</p>
        )}
      </div>
    </div>
  )
}

function GenericResult({ data }) {
  if (!data) return <p className="text-sm text-muted-foreground">Sin datos</p>
  if (data.error) return <p className="text-destructive text-sm">{data.error}</p>
  if (data.exito) return <p className="text-success text-sm">{data.mensaje || 'Operación exitosa'}</p>
  if (data.mensaje) return <p className="text-sm">{data.mensaje}</p>
  return <pre className="text-xs overflow-x-auto whitespace-pre-wrap">{JSON.stringify(data, null, 2)}</pre>
}

const resultRenderers = {
  obtener_empresa: EmpresaResult,
  listar_proyectos: ProyectosResult,
  ver_checklist: ChecklistResult,
  actualizar_item_checklist: GenericResult,
  ver_facturas_periodo: FacturasResult,
  ver_todas_facturas: TodasFacturasResult,
  obtener_cotizacion: CotizacionResult,
  ver_resultados_simulador: SimuladorResult,
  buscar_empresa: BuscarEmpresaResult,
  vincular_empresa: VincularEmpresaResult,
  derivar_a_gestor: HandoffResult,
}

export function ChatToolResult({ toolName, result }) {
  const Icon = toolIcons[toolName] || FileText
  const title = toolTitles[toolName] || toolName
  const Renderer = resultRenderers[toolName] || GenericResult

  let parsedResult = result
  if (typeof result === 'string') {
    try { parsedResult = JSON.parse(result) } catch { parsedResult = { mensaje: result } }
  }

  return (
    <div className="rounded-lg border border-border bg-card p-3 my-1">
      <div className="flex items-center gap-2 mb-2 pb-2 border-b border-border/50">
        <Icon size={14} className="text-primary shrink-0" />
        <span className="text-xs font-medium text-muted-foreground">{title}</span>
      </div>
      <Renderer data={parsedResult} />
    </div>
  )
}
