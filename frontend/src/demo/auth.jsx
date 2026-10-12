import { createContext, useCallback, useContext, useState } from 'react'
import { FlaskConical, ChevronDown } from 'lucide-react'
import { reiniciarDemo } from './api'

// Sesión simulada del modo demo. Reemplaza a context/AuthContext sólo con
// `npm run demo` (ver vite.config.js). El rol se elige en el cartel de abajo.

const ROLES_DEMO = {
  master: { label: 'Administrador general', nombre: 'Gestora Demo' },
  admin_empresa: { label: 'Administrador de empresa', nombre: 'Admin de Empresa Ejemplo' },
  carga: { label: 'Usuario que carga (comprobantes y checklist)', nombre: 'Persona de la empresa' },
  lectura: { label: 'Usuario de sólo lectura', nombre: 'Contador externo' },
}

function leerRol() {
  try {
    const rol = localStorage.getItem('demo-rol')
    return ROLES_DEMO[rol] ? rol : 'master'
  } catch {
    return 'master'
  }
}

const AuthContext = createContext({})

function CartelDemo({ rol }) {
  const [abierto, setAbierto] = useState(() => window.innerWidth >= 640)
  const cambiarRol = (nuevo) => {
    try { localStorage.setItem('demo-rol', nuevo) } catch { /* sin storage: queda el de siempre */ }
    location.reload()
  }
  if (!abierto) {
    return (
      <button
        type="button"
        onClick={() => setAbierto(true)}
        className="fixed bottom-3 right-3 z-70 flex items-center gap-1.5 rounded-full border border-warning/50 bg-card px-3 py-1.5 text-[12px] font-semibold text-warning shadow-lg cursor-pointer"
      >
        <FlaskConical size={14} aria-hidden="true" /> Demo · {ROLES_DEMO[rol].label}
      </button>
    )
  }
  return (
    <div className="fixed bottom-3 right-3 z-70 flex max-w-[calc(100vw-1.5rem)] flex-wrap items-center gap-2 rounded-xl border border-warning/50 bg-card px-3 py-2 text-[12px] shadow-lg">
      <span className="flex items-center gap-1.5 font-semibold text-warning">
        <FlaskConical size={14} aria-hidden="true" /> Modo demo
      </span>
      <span className="text-muted-foreground">Datos de ejemplo, nada se guarda en serio.</span>
      <label className="flex items-center gap-1.5">
        <span className="text-muted-foreground">Entrar como</span>
        <select
          value={rol}
          onChange={(e) => cambiarRol(e.target.value)}
          className="h-7 rounded-md border border-input bg-background px-1.5 text-[12px] cursor-pointer"
        >
          {Object.entries(ROLES_DEMO).map(([id, r]) => <option key={id} value={id}>{r.label}</option>)}
        </select>
      </label>
      <button
        type="button"
        onClick={() => { reiniciarDemo(); location.reload() }}
        className="rounded-md px-1.5 py-0.5 text-primary underline underline-offset-2 cursor-pointer"
      >
        Reiniciar datos
      </button>
      <button type="button" onClick={() => setAbierto(false)} aria-label="Achicar el cartel" className="rounded-md p-1 text-muted-foreground hover:bg-accent cursor-pointer">
        <ChevronDown size={14} />
      </button>
    </div>
  )
}

export const AuthProvider = ({ children }) => {
  const rol = leerRol()
  const isMaster = rol === 'master'
  const isAdminEmpresa = rol === 'admin_empresa'

  const puedeEscribir = useCallback((empresaId, modulo) => {
    if (isMaster || isAdminEmpresa) return true
    if (rol === 'carga') return ['facturas', 'checklist', 'simulador'].includes(modulo)
    return false
  }, [rol, isMaster, isAdminEmpresa])

  const value = {
    session: { token: 'demo' },
    user: { name: ROLES_DEMO[rol].nombre, email: 'demo@gestora.uy', sub: 'sub-demo' },
    loading: false,
    logout: async () => {},
    groups: [],
    isAdmin: isMaster || isAdminEmpresa,
    isMaster,
    isAdminEmpresa,
    role: isMaster ? 'master' : isAdminEmpresa ? 'admin_empresa' : 'user',
    accesos: [],
    puedeEscribir,
  }

  return (
    <AuthContext.Provider value={value}>
      {children}
      <CartelDemo rol={rol} />
    </AuthContext.Provider>
  )
}

export const useAuth = () => useContext(AuthContext)
