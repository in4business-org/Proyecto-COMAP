import { useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { ArrowLeft, Save, Plus, ArrowUpRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { LoadingState, Spinner } from '@/components/ui/loading'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { cn } from '@/lib/utils'
import { empresas as empApi, proyectos as projApi } from '@/lib/api'

const FIELDS = [
  { key: 'razon_social', label: 'Razón Social', span: 1 },
  { key: 'rut', label: 'RUT', span: 1, readonly: true },
  { key: 'domicilio_constituido', label: 'Domicilio Constituido', span: 1 },
  { key: 'domicilio_fiscal', label: 'Domicilio Fiscal', span: 1 },
  { key: 'telefono', label: 'Teléfono', span: 1 },
  { key: 'email', label: 'Email', span: 1 },
  { key: 'giro', label: 'Giro', span: 1 },
  { key: 'codigo_ciiu', label: 'Código CIIU', span: 1 },
  { key: 'fecha_balance', label: 'Fecha de balance (dd/mm)', span: 1 },
  { key: 'tipo_contribuyente', label: 'Tipo de Contribuyente', span: 1 },
]

export default function EmpresaDetail() {
  const { empresaId } = useParams()
  const [empresa, setEmpresa] = useState(null)
  const [form, setForm] = useState({})
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [proyectos, setProyectos] = useState([])
  const [projLoading, setProjLoading] = useState(true)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [creating, setCreating] = useState(false)
  const [projForm, setProjForm] = useState({ anio: new Date().getFullYear(), duracion: 5, fecha: '' })

  const [activeTab, setActiveTab] = useState('proyectos')

  useEffect(() => {
    empApi.get(empresaId).then((e) => { setEmpresa(e); setForm(e) }).catch(console.error).finally(() => setLoading(false))
    projApi.list(empresaId).then(setProyectos).catch(console.error).finally(() => setProjLoading(false))
  }, [empresaId])

  const handleSave = async () => {
    setSaving(true)
    try { await empApi.update(empresaId, form); setEmpresa({ ...form }) }
    catch (err) { console.error(err) }
    finally { setSaving(false) }
  }

  const handleCreateProj = async () => {
    setCreating(true)
    try {
      await projApi.create(empresaId, projForm.anio, projForm.duracion, projForm.fecha || null)
      setDialogOpen(false)
      setProyectos(await projApi.list(empresaId))
      setProjForm({ anio: new Date().getFullYear(), duracion: 5, fecha: '' })
    } catch (err) { console.error(err) }
    finally { setCreating(false) }
  }

  if (loading) return <LoadingState />

  const hasChanges = JSON.stringify(form) !== JSON.stringify(empresa)

  return (
    <div className="animate-fade-up">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center gap-3">
          <Link to="/empresas" className="rounded-md p-1.5 hover:bg-accent transition-colors text-muted-foreground hover:text-foreground">
            <ArrowLeft size={16} />
          </Link>
          <div>
            <h1 className="text-xl font-medium truncate">{empresa?.nombre}</h1>
            <p className="text-xs text-muted-foreground font-mono">{empresa?.rut}</p>
          </div>
        </div>
        <Button onClick={() => setDialogOpen(true)} size="sm" className="gap-1.5 text-xs">
          <Plus size={12} />
          Nuevo proyecto
        </Button>
      </div>

      {/* Tabs Menu */}
      <div className="flex gap-1.5 border-b border-border/50 pb-0 mb-6 px-1">
        {[
          { id: 'proyectos', label: 'Proyectos' },
          { id: 'metadata', label: 'Datos de empresa' },
        ].map((t) => (
          <button
            key={t.id}
            onClick={() => setActiveTab(t.id)}
            className={cn(
              'px-4 py-2.5 text-[13px] font-medium transition-all mb-[-1px] border-b-2',
              activeTab === t.id
                ? 'border-primary text-primary'
                : 'border-transparent text-muted-foreground hover:text-foreground hover:border-muted-foreground/30'
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Proyectos Tab */}
      {activeTab === 'proyectos' && (
        <section className="bg-card/30 border border-border/50 rounded-xl p-5 md:p-6 animate-fade-in shadow-sm">
          <div className="mb-4">
            <h2 className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">Proyectos Asociados</h2>
          </div>

          {projLoading ? (
            <LoadingState message="Cargando proyectos..." />
          ) : proyectos.length === 0 ? (
            <div className="border border-dashed border-border rounded-lg py-12 text-center bg-card/10">
              <p className="text-sm text-muted-foreground">No hay proyectos aún.</p>
              <button onClick={() => setDialogOpen(true)} className="text-sm font-medium text-primary hover:underline mt-2 cursor-pointer transition-colors">
                Crear el primer proyecto
              </button>
            </div>
          ) : (
            <div className="border border-border/80 rounded-lg overflow-x-auto shadow-sm">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border/80 bg-muted/40 text-left">
                    {['Fecha creación', 'Fecha presentación', 'Expediente', 'Año', 'Seguimiento', ''].map((h) => (
                      <th key={h} className="px-4 py-3 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground whitespace-nowrap">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/60">
                  {proyectos.map((p) => {
                    const hasDocs = !!p.expediente
                    return (
                      <tr key={p.id} className="bg-card hover:bg-accent/40 transition-colors group">
                        <td className="px-4 py-3 text-[13px] font-mono text-muted-foreground/80 whitespace-nowrap">
                          {p.fecha_creacion ? new Date(p.fecha_creacion).toLocaleDateString() : '--'}
                        </td>
                        <td className="px-4 py-3 text-[13px] font-mono text-muted-foreground/80 whitespace-nowrap">
                          {p.fecha_presentacion || '--'}
                        </td>
                        <td className="px-4 py-3 text-[13px] whitespace-nowrap">
                          {hasDocs ? (
                            <Badge variant="secondary" className="bg-success/15 text-success hover:bg-success/25 border-success/20 font-medium">
                              {p.expediente}
                            </Badge>
                          ) : (
                            <Badge variant="secondary" className="bg-warning/15 text-warning hover:bg-warning/25 border-warning/20 font-medium">
                              Sin expediente
                            </Badge>
                          )}
                        </td>
                        <td className="px-4 py-3 text-[13px] font-mono text-muted-foreground whitespace-nowrap">
                          {p.anio_presentacion}
                        </td>
                        <td className="px-4 py-3 text-[13px] font-mono text-muted-foreground whitespace-nowrap">
                          {p.duracion_seguimiento} años
                        </td>
                        <td className="px-4 py-3 text-right">
                          <Link to={`/empresas/${empresaId}/proyectos/${p.id}`}>
                            <Button size="sm" variant="secondary" className="h-[28px] px-3 text-[11px] font-medium gap-1 bg-background hover:bg-muted-foreground/10 text-foreground transition-all">
                              Abrir <ArrowUpRight size={12} className="opacity-50" />
                            </Button>
                          </Link>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}

      {/* Metadata Tab */}
      {activeTab === 'metadata' && (
        <section className="bg-card/30 border border-border/50 rounded-xl p-5 md:p-6 animate-fade-in shadow-sm">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">Datos de la empresa</h2>
            {hasChanges && (
              <Button onClick={handleSave} disabled={saving} size="sm" className="h-[28px] text-[11px] gap-1.5 font-medium">
                {saving ? <Spinner size={12} /> : <Save size={12} />}
                Guardar cambios
              </Button>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 gap-y-5">
            {FIELDS.map(({ key, label, span, readonly }) => (
              <div key={key} className={span === 2 ? 'col-span-1 md:col-span-2' : ''}>
                <label className="text-[11px] font-medium text-muted-foreground/80 mb-1.5 block">
                  {label}
                </label>
                <Input
                  readOnly={readonly}
                  value={form[key] || ''}
                  onChange={(e) => setForm({ ...form, [key]: e.target.value })}
                  className={cn("h-9 text-[13px] bg-background border-border/50", readonly && "opacity-60 cursor-not-allowed text-muted-foreground")}
                  placeholder={`Ingrese ${label.toLowerCase()}`}
                />
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Dialog */}
      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)}>
        <DialogContent onClose={() => setDialogOpen(false)}>
          <DialogHeader>
            <DialogTitle>Nuevo proyecto COMAP</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <label className="text-[12px] font-medium text-foreground">Fecha de presentación</label>
              <Input type="date" value={projForm.fecha} onChange={(e) => setProjForm({ ...projForm, fecha: e.target.value })} className="h-9 text-[13px]" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label className="text-[12px] font-medium text-foreground">Año de presentación</label>
                <Input type="number" value={projForm.anio} onChange={(e) => setProjForm({ ...projForm, anio: parseInt(e.target.value) })} className="h-9 text-[13px]" />
              </div>
              <div className="space-y-1.5">
                <label className="text-[12px] font-medium text-foreground">Años seguimiento</label>
                <Input type="number" min="1" max="10" value={projForm.duracion} onChange={(e) => setProjForm({ ...projForm, duracion: parseInt(e.target.value) })} className="h-9 text-[13px]" />
              </div>
            </div>
          </div>
          <DialogFooter className="mt-2">
            <Button variant="ghost" onClick={() => setDialogOpen(false)} size="sm" className="h-9 text-xs">Cancelar</Button>
            <Button onClick={handleCreateProj} disabled={creating} size="sm" className="h-9 text-xs">
              {creating ? 'Creando...' : 'Crear proyecto'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
