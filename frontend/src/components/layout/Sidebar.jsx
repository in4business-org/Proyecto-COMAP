import { NavLink, useLocation, useNavigate, Link } from 'react-router-dom'
import { cn } from '@/lib/utils'
import {
  Building2,
  LayoutDashboard,
  Menu,
  X,
  Plus,
  ChevronRight
} from 'lucide-react'
import { useState, useEffect } from 'react'
import { empresas as empApi, proyectos as projApi } from '@/lib/api'

const navigation = [
  { name: 'Inicio', href: '/', icon: LayoutDashboard }
]

export function Sidebar() {
  const [mobileOpen, setMobileOpen] = useState(false)
  const location = useLocation()
  const navigate = useNavigate()

  const [empresas, setEmpresas] = useState([])
  const [proyectosMap, setProyectosMap] = useState({})
  const [expandedEmpresa, setExpandedEmpresa] = useState(null)

  useEffect(() => {
    empApi.list().then(setEmpresas).catch(console.error)
  }, [])

  // Al montar, chequear la URL actual para auto-expandir la empresa si estamos en una ruta de empresa
  useEffect(() => {
    const match = location.pathname.match(/^\/empresas\/([^/]+)/)
    if (match) {
      const eId = match[1]
      setExpandedEmpresa(eId)
      if (!proyectosMap[eId]) {
        projApi.list(eId).then(projs => {
          setProyectosMap(prev => ({ ...prev, [eId]: projs }))
        }).catch(console.error)
      }
    }
  }, [location.pathname, proyectosMap])

  const toggleEmpresa = async (empresa) => {
    const isExpanding = expandedEmpresa !== empresa.id
    setExpandedEmpresa(isExpanding ? empresa.id : null)

    // Navegar a la página de la empresa
    navigate(`/empresas/${empresa.id}`)
    setMobileOpen(false)

    if (isExpanding && !proyectosMap[empresa.id]) {
      try {
        const projs = await projApi.list(empresa.id)
        setProyectosMap(prev => ({ ...prev, [empresa.id]: projs }))
      } catch (err) {
        console.error(err)
      }
    }
  }

  const isActive = (href) => {
    if (href === '/') return location.pathname === '/'
    return location.pathname === href
  }

  const navContent = (
    <nav className="flex flex-col gap-0.5 px-3">
      {navigation.map((item) => (
        <NavLink
          key={item.href}
          to={item.href}
          onClick={() => setMobileOpen(false)}
          className={cn(
            'flex items-center gap-3 rounded-lg px-3 py-2 text-[13px] font-medium transition-all duration-150',
            isActive(item.href)
              ? 'bg-white/[0.06] text-foreground'
              : 'text-muted-foreground hover:text-foreground hover:bg-white/[0.03]',
          )}
        >
          <item.icon size={16} strokeWidth={1.8} />
          {item.name}
        </NavLink>
      ))}

      <div className="mt-4 flex items-center justify-between px-3 mb-2">
        <span className="text-[10px] font-medium uppercase tracking-[0.08em] text-muted-foreground/60">
          Empresas
        </span>
        <Link
          to="/empresas"
          onClick={() => setMobileOpen(false)}
          className="text-[10px] font-medium text-primary hover:text-primary/80 transition-colors uppercase tracking-wider flex items-center"
        >
          <Plus size={12} className="mr-0.5" />
          Nueva
        </Link>
      </div>

      {empresas.map(emp => {
        const isExpanded = expandedEmpresa === emp.id
        const isEmpActive = location.pathname.startsWith(`/empresas/${emp.id}`)

        return (
          <div key={emp.id} className="mb-0.5">
            <button
              onClick={() => toggleEmpresa(emp)}
              className={cn(
                'w-full flex items-center justify-between rounded-lg px-2 py-2 text-left transition-all duration-150',
                isEmpActive ? 'bg-white/[0.06]' : 'hover:bg-white/[0.03]'
              )}
            >
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="w-[26px] h-[26px] rounded-md bg-white/[0.04] border border-white/10 flex items-center justify-center shrink-0">
                  <span className="text-[11px] font-bold text-primary">{emp.nombre.charAt(0).toUpperCase()}</span>
                </div>
                <div className="flex flex-col min-w-0">
                  <span className={cn('text-[13px] font-medium truncate', isEmpActive ? 'text-foreground' : 'text-muted-foreground')}>{emp.nombre}</span>
                  <span className="text-[10px] font-mono text-muted-foreground/50 tracking-tight">{emp.rut}</span>
                </div>
              </div>
              <ChevronRight
                size={14}
                className={cn("text-muted-foreground/50 transition-transform duration-200 shrink-0", isExpanded && "rotate-90")}
              />
            </button>

            {/* Proyectos anidados */}
            {isExpanded && (
              <div className="mt-1 mb-2 ml-[15px] pl-[15px] border-l border-white/10 flex flex-col gap-0.5">
                {!proyectosMap[emp.id] ? (
                  <span className="text-[11px] text-muted-foreground/50 py-1">Cargando...</span>
                ) : proyectosMap[emp.id].length === 0 ? (
                  <span className="text-[11px] text-muted-foreground/50 py-1">No hay proyectos</span>
                ) : (
                  proyectosMap[emp.id].map(p => {
                    const label = p.expediente || p.fecha_presentacion || p.fecha_creacion || `Proyecto ${p.anio_presentacion}`
                    const isProjActive = location.pathname === `/empresas/${emp.id}/proyectos/${p.id}`
                    return (
                      <NavLink
                        key={p.id}
                        to={`/empresas/${emp.id}/proyectos/${p.id}`}
                        onClick={() => setMobileOpen(false)}
                        className={cn(
                          'flex items-center gap-2 rounded-md px-2 py-1.5 transition-colors',
                          isProjActive
                            ? 'bg-primary/15 text-primary'
                            : 'text-muted-foreground hover:bg-white/[0.03] hover:text-foreground'
                        )}
                      >
                        <div className={cn("w-1 h-1 rounded-full shrink-0", isProjActive ? "bg-primary" : "bg-muted-foreground/40")} />
                        <div className="flex flex-col min-w-0">
                          <span className="text-[12px] truncate leading-tight">{label}</span>
                          <span className="text-[9px] opacity-60 font-mono tracking-tight">{p.anio_presentacion} · {p.duracion_seguimiento} años</span>
                        </div>
                      </NavLink>
                    )
                  })
                )}
              </div>
            )}
          </div>
        )
      })}
    </nav>
  )

  return (
    <>
      <button
        onClick={() => setMobileOpen(true)}
        className="fixed top-4 left-4 z-50 rounded-lg bg-card border border-border p-2 text-foreground lg:hidden cursor-pointer"
      >
        <Menu size={18} />
      </button>

      {mobileOpen && (
        <div className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm lg:hidden" onClick={() => setMobileOpen(false)} />
      )}

      <aside
        className={cn(
          'fixed inset-y-0 left-0 z-50 flex w-60 flex-col border-r border-border bg-[#0c0c0e] transition-transform duration-200 lg:translate-x-0 lg:static lg:z-auto',
          mobileOpen ? 'translate-x-0' : '-translate-x-full',
        )}
      >
        <div className="flex items-center justify-between px-5 h-14 border-b border-border">
          <span className="text-[13px] font-semibold tracking-wide text-foreground/80">COMAP</span>
          <button onClick={() => setMobileOpen(false)} className="lg:hidden text-muted-foreground cursor-pointer">
            <X size={16} />
          </button>
        </div>

        <div className="flex-1 py-3 overflow-y-auto scrollbar-thin scrollbar-thumb-white/10">
          {navContent}
        </div>

        <div className="px-5 py-3 border-t border-border">
          <p className="text-[10px] text-muted-foreground/40 tracking-wide">Decreto 329/025</p>
        </div>
      </aside>
    </>
  )
}
