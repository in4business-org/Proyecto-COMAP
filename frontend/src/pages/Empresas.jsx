import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Building2, Plus, Search, ArrowUpRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { LoadingState, EmptyState } from '@/components/ui/loading'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { empresas as empApi } from '@/lib/api'

export default function Empresas() {
  const [empresas, setEmpresas] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [dialogOpen, setDialogOpen] = useState(false)
  const [creating, setCreating] = useState(false)
  const [form, setForm] = useState({ rut: '', nombre: '' })

  const load = () => {
    setLoading(true)
    empApi.list().then(setEmpresas).catch(console.error).finally(() => setLoading(false))
  }

  useEffect(() => { load() }, [])

  const filtered = empresas.filter((e) =>
    `${e.nombre} ${e.rut}`.toLowerCase().includes(search.toLowerCase())
  )

  const handleCreate = async () => {
    if (!form.rut || !form.nombre) return
    setCreating(true)
    try {
      await empApi.create(form.rut, form.nombre)
      setDialogOpen(false)
      setForm({ rut: '', nombre: '' })
      load()
    } catch (err) { console.error(err) }
    finally { setCreating(false) }
  }

  return (
    <div className="animate-fade-up">
      {/* Header */}
      <div className="flex items-start justify-between mb-8">
        <div>
          <h1 className="text-xl font-medium">Empresas</h1>
          <p className="text-sm text-muted-foreground mt-0.5">{empresas.length} registradas</p>
        </div>
        <Button onClick={() => setDialogOpen(true)} size="sm" className="gap-1.5">
          <Plus size={14} />
          Nueva
        </Button>
      </div>

      {/* Search */}
      {empresas.length > 0 && (
        <div className="relative mb-6">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Buscar..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-8 max-w-xs h-9 text-sm"
          />
        </div>
      )}

      {/* Content */}
      {loading ? (
        <LoadingState />
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={Building2}
          title={search ? 'Sin resultados' : 'Sin empresas'}
          description={search ? 'Proba con otro termino' : 'Registra una empresa para empezar'}
          action={!search && (
            <Button onClick={() => setDialogOpen(true)} size="sm" variant="outline">
              <Plus size={14} /> Crear empresa
            </Button>
          )}
        />
      ) : (
        <div className="border border-border rounded-xl overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border bg-muted/50">
                <th className="text-left text-[11px] font-medium uppercase tracking-wider text-muted-foreground px-4 py-2.5">Empresa</th>
                <th className="text-left text-[11px] font-medium uppercase tracking-wider text-muted-foreground px-4 py-2.5 hidden sm:table-cell">RUT</th>
                <th className="text-left text-[11px] font-medium uppercase tracking-wider text-muted-foreground px-4 py-2.5 hidden md:table-cell">Giro</th>
                <th className="w-10"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {filtered.map((emp) => (
                <tr key={emp.id} className="bg-card hover:bg-accent transition-colors group">
                  <td className="px-4 py-3">
                    <Link to={`/empresas/${emp.id}`} className="flex items-center gap-2.5">
                      <div className="w-6 h-6 rounded bg-primary/10 flex items-center justify-center shrink-0">
                        <Building2 size={12} className="text-primary" />
                      </div>
                      <span className="text-sm font-medium">{emp.nombre}</span>
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-sm text-muted-foreground font-mono hidden sm:table-cell">{emp.rut}</td>
                  <td className="px-4 py-3 text-sm text-muted-foreground truncate max-w-[200px] hidden md:table-cell">{emp.giro || '--'}</td>
                  <td className="px-4 py-3">
                    <Link to={`/empresas/${emp.id}`}>
                      <ArrowUpRight size={14} className="text-muted-foreground/30 group-hover:text-foreground transition-colors" />
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Dialog */}
      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)}>
        <DialogContent onClose={() => setDialogOpen(false)}>
          <DialogHeader>
            <DialogTitle>Nueva empresa</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">RUT</label>
              <Input placeholder="123456789012" value={form.rut} onChange={(e) => setForm({ ...form, rut: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">Nombre</label>
              <Input placeholder="Nombre de la empresa" value={form.nombre} onChange={(e) => setForm({ ...form, nombre: e.target.value })} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setDialogOpen(false)} size="sm">Cancelar</Button>
            <Button onClick={handleCreate} disabled={creating || !form.rut || !form.nombre} size="sm">
              {creating ? 'Creando...' : 'Crear'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
