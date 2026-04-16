import { NavLink, useLocation, useNavigate, Link } from 'react-router-dom'
import { cn } from '@/lib/utils'
import {
  LayoutDashboard,
  Menu,
  X,
  Plus,
  ChevronRight,
  Sun,
  Moon,
  Settings,
  Users,
  PanelLeftClose,
  PanelLeftOpen,
  Inbox,
  MessageCircle,
} from 'lucide-react'
import { useState, useEffect } from 'react'
import { empresas as empApi, proyectos as projApi } from '@/lib/api'
import { useTheme } from '../../context/ThemeContext'
import { useAuth } from '../../context/AuthContext'

const settingsNav = [
  { name: 'Configuración', href: '/settings/user', icon: Settings },
  { name: 'Organización', href: '/settings/organization', icon: Users },
]

// Module-level cache: persists across re-mounts (every page navigation re-mounts Layout)
let empresasCache = null
let empresasCacheTime = 0
const CACHE_TTL = 5 * 60 * 1000 // 5 minutes

export function clearEmpresasCache() {
  empresasCache = null
  empresasCacheTime = 0
}

export function Sidebar() {
  const [mobileOpen, setMobileOpen] = useState(false)
  const [collapsed, setCollapsed] = useState(() => {
    return localStorage.getItem('sidebar-collapsed') === 'true'
  })
  const location = useLocation()
  const navigate = useNavigate()
  const { theme, toggleTheme } = useTheme()
  const { user } = useAuth()

  const [empresas, setEmpresas] = useState([])
  const [proyectosMap, setProyectosMap] = useState({})
  const [expandedEmpresa, setExpandedEmpresa] = useState(null)

  useEffect(() => {
    const now = Date.now()
    if (empresasCache && (now - empresasCacheTime) < CACHE_TTL) {
      setEmpresas(empresasCache)
      return
    }
    empApi.list()
      .then(data => {
        empresasCache = data
        empresasCacheTime = Date.now()
        setEmpresas(data)
      })
      .catch(console.error)
  }, [])

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

  const toggleCollapsed = () => {
    setCollapsed(prev => {
      const next = !prev
      localStorage.setItem('sidebar-collapsed', String(next))
      return next
    })
  }

  const toggleEmpresa = async (empresa) => {
    if (collapsed) {
      setCollapsed(false)
      localStorage.setItem('sidebar-collapsed', 'false')
    }
    const isExpanding = expandedEmpresa !== empresa.id
    setExpandedEmpresa(isExpanding ? empresa.id : null)
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
    return location.pathname.startsWith(href)
  }

  const displayName = user?.user_metadata?.full_name
    || user?.user_metadata?.name
    || user?.email?.split('@')[0]
    || ''

  const navItemClass = (active) => cn(
    'flex items-center rounded-lg py-2 text-[13px] font-medium transition-all duration-150',
    collapsed ? 'justify-center px-0' : 'gap-3 px-3',
    active
      ? 'bg-accent text-foreground'
      : 'text-muted-foreground hover:text-foreground hover:bg-accent/50',
  )

  return (
    <>
      {/* Mobile hamburger */}
      <button
        onClick={() => setMobileOpen(true)}
        aria-label="Abrir menú de navegación"
        className="fixed top-4 left-4 z-50 rounded-lg bg-card border border-border p-2 text-foreground lg:hidden cursor-pointer"
      >
        <Menu size={18} aria-hidden="true" />
      </button>

      {/* Mobile overlay */}
      {mobileOpen && (
        <div
          aria-hidden="true"
          className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm lg:hidden"
          onClick={() => setMobileOpen(false)}
        />
      )}

      <aside
        className={cn(
          'fixed inset-y-0 left-0 z-50 flex flex-col border-r border-border bg-card',
          'h-screen overflow-hidden',
          'transition-[width] duration-200 ease-in-out',
          'lg:static lg:z-auto lg:translate-x-0',
          collapsed ? 'lg:w-[60px]' : 'lg:w-[240px]',
          'w-[240px]',
          mobileOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0',
        )}
      >
        {/* Header */}
        <div className={cn(
          'flex items-center border-b border-border shrink-0 h-14 gap-2',
          collapsed ? 'justify-center px-2' : 'justify-between px-4',
        )}>
          {!collapsed && (
            <span className="text-[13px] font-semibold tracking-wide text-foreground/80 truncate">
              COMAP
            </span>
          )}
          <button
            onClick={toggleCollapsed}
            aria-label={collapsed ? 'Expandir panel lateral' : 'Colapsar panel lateral'}
            className="hidden lg:flex p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-accent transition-colors cursor-pointer shrink-0"
          >
            {collapsed ? <PanelLeftOpen size={15} aria-hidden="true" /> : <PanelLeftClose size={15} aria-hidden="true" />}
          </button>
          <button
            onClick={() => setMobileOpen(false)}
            aria-label="Cerrar menú de navegación"
            className="lg:hidden p-1.5 text-muted-foreground hover:text-foreground cursor-pointer"
          >
            <X size={16} aria-hidden="true" />
          </button>
        </div>

        {/* Scrollable nav content */}
        <div className="flex-1 overflow-y-auto overflow-x-hidden py-3 min-h-0">
          <nav className={cn('flex flex-col gap-0.5', collapsed ? 'px-2' : 'px-3')}>

            {/* Inicio + Inbox */}
            {collapsed ? (
              <>
                <NavLink
                  to="/"
                  onClick={() => setMobileOpen(false)}
                  title="Inicio"
                  className={navItemClass(isActive('/'))}
                >
                  <LayoutDashboard size={16} strokeWidth={1.8} className="shrink-0" />
                </NavLink>
                <NavLink
                  to="/inbox"
                  onClick={() => setMobileOpen(false)}
                  title="Bandeja de entrada"
                  className={navItemClass(isActive('/inbox'))}
                >
                  <Inbox size={16} strokeWidth={1.8} className="shrink-0" />
                </NavLink>
                <NavLink
                  to="/agente"
                  onClick={() => setMobileOpen(false)}
                  title="Asistente COMAP"
                  className={navItemClass(isActive('/agente'))}
                >
                  <MessageCircle size={16} strokeWidth={1.8} className="shrink-0" />
                </NavLink>
              </>
            ) : (
              <>
                <div className="flex items-center gap-1">
                  <NavLink
                    to="/"
                    onClick={() => setMobileOpen(false)}
                    className={cn(navItemClass(isActive('/')), 'flex-1')}
                  >
                    <LayoutDashboard size={16} strokeWidth={1.8} className="shrink-0" />
                    Inicio
                  </NavLink>
                  <NavLink
                    to="/inbox"
                    title="Bandeja de entrada"
                    onClick={() => setMobileOpen(false)}
                    className={cn(
                      'py-2 px-2 rounded-lg transition-all duration-150 shrink-0',
                      isActive('/inbox')
                        ? 'bg-accent text-foreground'
                        : 'text-muted-foreground hover:text-foreground hover:bg-accent/50',
                    )}
                  >
                    <Inbox size={16} strokeWidth={1.8} />
                  </NavLink>
                </div>
                <NavLink
                  to="/agente"
                  onClick={() => setMobileOpen(false)}
                  className={navItemClass(isActive('/agente'))}
                >
                  <MessageCircle size={16} strokeWidth={1.8} className="shrink-0" />
                  Asistente
                </NavLink>
              </>
            )}

            {/* Empresas header */}
            <div className={cn(
              'mt-4 mb-2',
              collapsed ? 'flex justify-center' : 'flex items-center justify-between px-3',
            )}>
              {collapsed ? (
                <div className="w-5 h-px bg-border" />
              ) : (
                <>
                  <span className="text-[10px] font-medium uppercase tracking-[0.08em] text-muted-foreground/60">
                    Empresas
                  </span>
                  <Link
                    to="/empresas"
                    onClick={() => setMobileOpen(false)}
                    className="text-[10px] font-medium text-primary hover:text-primary/80 transition-colors uppercase tracking-wider flex items-center gap-0.5"
                  >
                    <Plus size={11} />
                    Nueva
                  </Link>
                </>
              )}
            </div>

            {/* Company list */}
            {empresas.map(emp => {
              const isExpanded = expandedEmpresa === emp.id
              const isEmpActive = location.pathname.startsWith(`/empresas/${emp.id}`)

              return (
                <div key={emp.id} className="mb-0.5">
                  <button
                    onClick={() => toggleEmpresa(emp)}
                    title={collapsed ? `${emp.nombre} · ${emp.rut}` : undefined}
                    className={cn(
                      'w-full flex items-center rounded-lg py-1.5 text-left transition-all duration-150',
                      collapsed ? 'justify-center px-0' : 'justify-between px-2 gap-2',
                      isEmpActive ? 'bg-accent' : 'hover:bg-accent/50',
                    )}
                  >
                    <div className={cn('flex items-center min-w-0', !collapsed && 'gap-2.5 flex-1')}>
                      <div className={cn(
                        'rounded-md flex items-center justify-center shrink-0 border w-7 h-7',
                        isEmpActive ? 'bg-primary/10 border-primary/20' : 'bg-accent border-border',
                      )}>
                        <span className={cn(
                          'text-[11px] font-bold',
                          isEmpActive ? 'text-primary' : 'text-primary/70',
                        )}>
                          {emp.nombre.charAt(0).toUpperCase()}
                        </span>
                      </div>

                      {!collapsed && (
                        <div className="flex flex-col min-w-0 flex-1">
                          <span className={cn(
                            'text-[12.5px] font-medium truncate leading-tight',
                            isEmpActive ? 'text-foreground' : 'text-muted-foreground',
                          )}>
                            {emp.nombre}
                          </span>
                          <span className="text-[10px] font-mono text-muted-foreground/40 tracking-tight truncate">
                            {emp.rut}
                          </span>
                        </div>
                      )}
                    </div>

                    {!collapsed && (
                      <ChevronRight
                        size={13}
                        className={cn(
                          'text-muted-foreground/40 transition-transform duration-200 shrink-0',
                          isExpanded && 'rotate-90',
                        )}
                      />
                    )}
                  </button>

                  {/* Projects */}
                  {!collapsed && isExpanded && (
                    <div className="mt-1 mb-1.5 ml-[17px] pl-3 border-l border-border/70 flex flex-col gap-0.5">
                      {!proyectosMap[emp.id] ? (
                        <span className="text-[11px] text-muted-foreground/40 py-1 px-1">Cargando...</span>
                      ) : proyectosMap[emp.id].length === 0 ? (
                        <span className="text-[11px] text-muted-foreground/40 py-1 px-1">Sin proyectos</span>
                      ) : (
                        proyectosMap[emp.id].map(p => {
                          const label = p.expediente
                            || p.fecha_presentacion
                            || p.fecha_creacion
                            || `Proyecto ${p.anio_presentacion}`
                          const isProjActive = location.pathname === `/empresas/${emp.id}/proyectos/${p.id}`
                          return (
                            <NavLink
                              key={p.id}
                              to={`/empresas/${emp.id}/proyectos/${p.id}`}
                              onClick={() => setMobileOpen(false)}
                              className={cn(
                                'flex items-center gap-2 rounded-md px-2 py-1.5 transition-colors group',
                                isProjActive
                                  ? 'bg-primary/10 text-primary'
                                  : 'text-muted-foreground hover:bg-accent/60 hover:text-foreground',
                              )}
                            >
                              <div className={cn(
                                'w-1.5 h-1.5 rounded-full shrink-0 transition-colors',
                                isProjActive ? 'bg-primary' : 'bg-muted-foreground/25 group-hover:bg-muted-foreground/50',
                              )} />
                              <div className="flex flex-col min-w-0">
                                <span className="text-[12px] truncate leading-tight font-medium">{label}</span>
                                <span className="text-[9.5px] opacity-50 font-mono tracking-tight">
                                  {p.anio_presentacion} · {p.duracion_seguimiento} años
                                </span>
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
        </div>

        {/* Footer */}
        <div className={cn(
          'border-t border-border shrink-0',
          collapsed ? 'px-2 py-2' : 'px-3 py-2',
        )}>
          <nav className="flex flex-col gap-0.5 mb-2">
            {settingsNav.map((item) => (
              <NavLink
                key={item.href}
                to={item.href}
                title={collapsed ? item.name : undefined}
                className={navItemClass(isActive(item.href))}
              >
                <item.icon size={16} strokeWidth={1.8} className="shrink-0" />
                {!collapsed && <span>{item.name}</span>}
              </NavLink>
            ))}
          </nav>

          <div className="border-t border-border/50 mb-2" />

          {/* User name + theme toggle */}
          <div className={cn(
            'flex items-center',
            collapsed ? 'justify-center' : 'justify-between gap-2',
          )}>
            {!collapsed && displayName && (
              <span className="text-[11px] text-muted-foreground/50 truncate leading-tight">
                {displayName}
              </span>
            )}
            <button
              onClick={toggleTheme}
              aria-label={theme === 'dark' ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro'}
              className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-accent transition-colors cursor-pointer shrink-0"
            >
              {theme === 'dark' ? <Sun size={14} aria-hidden="true" /> : <Moon size={14} aria-hidden="true" />}
            </button>
          </div>
        </div>
      </aside>
    </>
  )
}
