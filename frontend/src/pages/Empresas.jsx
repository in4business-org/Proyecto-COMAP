import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Building2, Plus, Search, ArrowUpRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { LoadingState, EmptyState } from '@/components/ui/loading'
import { empresas as empApi } from '@/lib/api'
import { useAuth } from '../context/AuthContext'

export default function Empresas() {
  // Dar de alta empresas es exclusivo de administradores (el backend tambien lo valida)
  const { isMaster } = useAuth()
  const [empresas, setEmpresas] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const navigate = useNavigate()

  useEffect(() => {
    empApi.list().then(setEmpresas).catch(console.error).finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search), 250)
    return () => clearTimeout(timer)
  }, [search])

  const filtered = empresas.filter((e) =>
    `${e.nombre} ${e.rut}`.toLowerCase().includes(debouncedSearch.toLowerCase())
  )

  return (
    <div className="animate-fade-up">
      {/* Header */}
      <div className="flex items-start justify-between mb-8">
        <div>
          <h1 className="text-xl font-medium">Empresas</h1>
          <p className="text-sm text-muted-foreground mt-0.5">{empresas.length} registradas</p>
        </div>
        {isMaster && (
          <Button onClick={() => navigate('/empresas/nueva')} size="sm" className="gap-1.5">
            <Plus size={14} />
            Nueva
          </Button>
        )}
      </div>

      {/* Search */}
      {empresas.length > 0 && (
        <div className="relative mb-6">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Buscar..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            aria-label="Buscar empresa por nombre o RUT"
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
          description={
            search
              ? 'Probá con otro término'
              : isMaster
                ? 'Registrá una empresa para empezar'
                : 'Todavía no te asignaron ninguna empresa. Pedile acceso a un administrador.'
          }
          action={!search && isMaster && (
            <Button onClick={() => navigate('/empresas/nueva')} size="sm" variant="outline">
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
    </div>
  )
}
