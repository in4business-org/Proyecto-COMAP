import { useEffect, useState } from 'react'
import {
  ShieldCheck,
  UserPlus,
  Search,
  Users,
  KeyRound,
  Trash2,
  Ban,
  CheckCircle2,
  Copy,
  Check,
  AlertCircle,
  Building2,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { LoadingState, EmptyState } from '@/components/ui/loading'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'
import { admin as adminApi, empresas as empApi } from '@/lib/api'
import { AccesosDialog } from '@/components/admin/AccesosDialog'
import { useAuth } from '../context/AuthContext'

const ROL_LABEL = {
  master: 'Administrador general',
  admin_empresa: 'Administrador de empresa',
  user: 'Usuario',
}

const ESTADO_LABEL = {
  CONFIRMED: 'Activo',
  FORCE_CHANGE_PASSWORD: 'Contraseña pendiente',
  RESET_REQUIRED: 'Reset pendiente',
  UNCONFIRMED: 'Sin confirmar',
}

function formatFecha(value) {
  if (!value) return '--'
  return new Date(value).toLocaleDateString('es-UY', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  })
}

/** Muestra una contraseña temporal con botón de copiar. */
function PasswordTemporal({ password }) {
  const [copiado, setCopiado] = useState(false)

  const copiar = async () => {
    try {
      await navigator.clipboard.writeText(password)
      setCopiado(true)
      setTimeout(() => setCopiado(false), 2000)
    } catch {
      /* clipboard bloqueado: el usuario la puede seleccionar a mano */
    }
  }

  return (
    <div className="flex items-center gap-2 rounded-lg border border-border bg-muted/50 px-3 py-2">
      <code className="flex-1 text-sm font-mono select-all break-all">{password}</code>
      <button
        onClick={copiar}
        aria-label="Copiar contraseña temporal"
        className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-accent transition-colors cursor-pointer shrink-0"
      >
        {copiado ? <Check size={14} className="text-success" /> : <Copy size={14} />}
      </button>
    </div>
  )
}

export default function Admin() {
  const { user, isMaster } = useAuth()
  const miSub = user?.sub

  const [usuarios, setUsuarios] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [search, setSearch] = useState('')
  const [busy, setBusy] = useState(null) // username en proceso

  // Alta
  const [createOpen, setCreateOpen] = useState(false)
  const [creating, setCreating] = useState(false)
  const [createError, setCreateError] = useState(null)
  const [form, setForm] = useState({ email: '', nombre: '', rol: 'user', enviarMail: true })
  // Un admin de empresa tiene que asignarle al menos una empresa al crear:
  // si no, el usuario nuevo le quedaria fuera de su propio ambito.
  const [empresasDisponibles, setEmpresasDisponibles] = useState([])
  const [empresasElegidas, setEmpresasElegidas] = useState([])

  // Diálogos secundarios
  const [credenciales, setCredenciales] = useState(null) // { email, password }
  const [aEliminar, setAEliminar] = useState(null)
  const [accesosDe, setAccesosDe] = useState(null)
  const [confirmacion, setConfirmacion] = useState('')
  const [eliminando, setEliminando] = useState(false)

  const load = () => {
    setLoading(true)
    adminApi
      .listUsuarios()
      .then((data) => {
        setUsuarios(data)
        setError(null)
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    load()
  }, [])

  useEffect(() => {
    if (!createOpen || isMaster) return
    // empApi.list() ya viene filtrada por el backend a las empresas del usuario
    empApi.list().then(setEmpresasDisponibles).catch(() => setEmpresasDisponibles([]))
  }, [createOpen, isMaster])

  const filtered = usuarios.filter((u) =>
    `${u.email || ''} ${u.nombre || ''}`.toLowerCase().includes(search.toLowerCase())
  )

  /** Envuelve una acción sobre un usuario: marca busy, recarga y reporta errores. */
  const ejecutar = async (username, fn) => {
    setBusy(username)
    setError(null)
    try {
      return await fn()
    } catch (err) {
      setError(err.message)
      return null
    } finally {
      setBusy(null)
      load()
    }
  }

  const handleCrear = async () => {
    if (!form.email.trim()) return
    setCreating(true)
    setCreateError(null)
    try {
      const { passwordTemporal } = await adminApi.crearUsuario({
        email: form.email.trim(),
        nombre: form.nombre.trim() || undefined,
        rol: isMaster ? form.rol : 'user',
        enviarMail: form.enviarMail,
        accesos: empresasElegidas.map((empresaId) => ({ empresaId, escritura: [] })),
      })
      setCreateOpen(false)
      if (passwordTemporal) {
        setCredenciales({ email: form.email.trim(), password: passwordTemporal })
      }
      setForm({ email: '', nombre: '', rol: 'user', enviarMail: true })
      setEmpresasElegidas([])
      load()
    } catch (err) {
      setCreateError(err.message)
    } finally {
      setCreating(false)
    }
  }

  const handleRol = (u, rol) => ejecutar(u.username, () => adminApi.cambiarRol(u.username, rol))

  const handleEstado = (u) =>
    ejecutar(u.username, () => adminApi.cambiarEstado(u.username, !u.habilitado))

  const handleReset = (u) =>
    ejecutar(u.username, async () => {
      const { passwordTemporal } = await adminApi.resetPassword(u.username)
      setCredenciales({ email: u.email, password: passwordTemporal })
    })

  const handleEliminar = async () => {
    setEliminando(true)
    try {
      await adminApi.eliminarUsuario(aEliminar.username)
      setAEliminar(null)
      setConfirmacion('')
      load()
    } catch (err) {
      setError(err.message)
    } finally {
      setEliminando(false)
    }
  }

  const admins = usuarios.filter((u) => u.rol !== 'user').length

  return (
    <div className="animate-fade-up">
      {/* Header */}
      <div className="flex items-start justify-between mb-8 gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-accent border border-border">
            <ShieldCheck size={18} className="text-primary" strokeWidth={1.8} />
          </div>
          <div>
            <h1 className="text-xl font-medium">
              Administración
              {!isMaster && (
                <span className="ml-2 text-[11px] font-normal text-muted-foreground align-middle">
                  · tus empresas
                </span>
              )}
            </h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              {usuarios.length} usuario{usuarios.length === 1 ? '' : 's'} · {admins} administrador
              {admins === 1 ? '' : 'es'}
            </p>
          </div>
        </div>
        <Button onClick={() => setCreateOpen(true)} size="sm" className="gap-1.5 shrink-0">
          <UserPlus size={14} />
          Nuevo usuario
        </Button>
      </div>

      {error && (
        <div
          role="alert"
          className="mb-6 flex items-start gap-2.5 rounded-lg border border-destructive/30 bg-destructive/10 px-3.5 py-2.5"
        >
          <AlertCircle size={15} className="text-destructive shrink-0 mt-0.5" aria-hidden="true" />
          <p className="text-[13px] text-destructive">{error}</p>
        </div>
      )}

      {/* Search */}
      {usuarios.length > 0 && (
        <div className="relative mb-6">
          <Search
            size={14}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
          />
          <Input
            placeholder="Buscar por email o nombre..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            aria-label="Buscar usuario"
            className="pl-8 max-w-xs h-9 text-sm"
          />
        </div>
      )}

      {/* Tabla */}
      {loading ? (
        <LoadingState message="Cargando usuarios..." />
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={Users}
          title={search ? 'Sin resultados' : 'Sin usuarios'}
          description={
            search ? 'Probá con otro término' : 'Creá el primer usuario de la plataforma'
          }
          action={
            !search && (
              <Button onClick={() => setCreateOpen(true)} size="sm" variant="outline">
                <UserPlus size={14} /> Nuevo usuario
              </Button>
            )
          }
        />
      ) : (
        <div className="border border-border rounded-xl overflow-x-auto">
          <table className="w-full min-w-[640px]">
            <thead>
              <tr className="border-b border-border bg-muted/50">
                <th className="text-left text-[11px] font-medium uppercase tracking-wider text-muted-foreground px-4 py-2.5">
                  Usuario
                </th>
                <th className="text-left text-[11px] font-medium uppercase tracking-wider text-muted-foreground px-4 py-2.5">
                  Rol
                </th>
                <th className="text-left text-[11px] font-medium uppercase tracking-wider text-muted-foreground px-4 py-2.5 hidden md:table-cell">
                  Estado
                </th>
                <th className="text-left text-[11px] font-medium uppercase tracking-wider text-muted-foreground px-4 py-2.5 hidden lg:table-cell">
                  Alta
                </th>
                <th className="w-28"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {filtered.map((u) => {
                const esYo = u.sub && u.sub === miSub
                const enProceso = busy === u.username

                return (
                  <tr
                    key={u.username}
                    className={`bg-card hover:bg-accent/60 transition-colors ${
                      enProceso ? 'opacity-50 pointer-events-none' : ''
                    } ${!u.habilitado ? 'opacity-60' : ''}`}
                  >
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2.5">
                        <div className="w-7 h-7 rounded-md bg-primary/10 flex items-center justify-center shrink-0">
                          <span className="text-[11px] font-bold text-primary">
                            {(u.nombre || u.email || '?').charAt(0).toUpperCase()}
                          </span>
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5">
                            <span className="text-sm font-medium truncate">
                              {u.nombre || u.email}
                            </span>
                            {esYo && (
                              <span className="text-[10px] text-muted-foreground/60 shrink-0">
                                (vos)
                              </span>
                            )}
                          </div>
                          {u.nombre && (
                            <span className="text-[11px] text-muted-foreground truncate block">
                              {u.email}
                            </span>
                          )}
                        </div>
                      </div>
                    </td>

                    <td className="px-4 py-3">
                      {isMaster ? (
                        <select
                          value={u.rol}
                          disabled={esYo}
                          onChange={(e) => handleRol(u, e.target.value)}
                          aria-label={`Rol de ${u.email}`}
                          className="h-8 rounded-md border border-input bg-background px-2 text-[12.5px] cursor-pointer disabled:cursor-not-allowed disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                        >
                          <option value="user">Usuario</option>
                          <option value="admin_empresa">Administrador de empresa</option>
                          <option value="master">Administrador general</option>
                        </select>
                      ) : (
                        // Un admin de empresa ve el rol pero no lo puede cambiar:
                        // esa es la frontera que impide la escalada.
                        <Badge variant={u.rol === 'user' ? 'outline' : 'default'}>
                          {ROL_LABEL[u.rol] || u.rol}
                        </Badge>
                      )}
                    </td>

                    <td className="px-4 py-3 hidden md:table-cell">
                      {!u.habilitado ? (
                        <Badge variant="destructive">Deshabilitado</Badge>
                      ) : u.estado === 'CONFIRMED' ? (
                        <Badge variant="success">Activo</Badge>
                      ) : (
                        <Badge variant="warning">{ESTADO_LABEL[u.estado] || u.estado}</Badge>
                      )}
                    </td>

                    <td className="px-4 py-3 text-[12.5px] text-muted-foreground hidden lg:table-cell">
                      {formatFecha(u.creado)}
                    </td>

                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-0.5">
                        <button
                          onClick={() => setAccesosDe(u)}
                          disabled={u.rol === 'master'}
                          title={
                            u.rol === 'master'
                              ? 'Un administrador general ya ve todas las empresas'
                              : 'Permisos por empresa'
                          }
                          aria-label={`Editar permisos por empresa de ${u.email}`}
                          className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-accent transition-colors cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed"
                        >
                          <Building2 size={14} />
                        </button>
                        <button
                          onClick={() => handleReset(u)}
                          title="Generar contraseña temporal"
                          aria-label={`Generar contraseña temporal para ${u.email}`}
                          className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-accent transition-colors cursor-pointer"
                        >
                          <KeyRound size={14} />
                        </button>
                        {/* Deshabilitar y eliminar afectan el acceso a toda la
                            plataforma, no solo a una empresa: son del master. */}
                        {isMaster && (
                          <>
                            <button
                              onClick={() => handleEstado(u)}
                              disabled={esYo}
                              title={u.habilitado ? 'Deshabilitar acceso' : 'Habilitar acceso'}
                              aria-label={`${u.habilitado ? 'Deshabilitar' : 'Habilitar'} a ${u.email}`}
                              className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-accent transition-colors cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed"
                            >
                              {u.habilitado ? <Ban size={14} /> : <CheckCircle2 size={14} />}
                            </button>
                            <button
                              onClick={() => setAEliminar(u)}
                              disabled={esYo}
                              title="Eliminar usuario"
                              aria-label={`Eliminar a ${u.email}`}
                              className="p-1.5 rounded-md text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed"
                            >
                              <Trash2 size={14} />
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      <p className="mt-4 text-[11.5px] text-muted-foreground/70 leading-relaxed">
        {isMaster ? (
          <>
            Los cambios de rol se aplican cuando el usuario renueva su sesión (hasta 1 hora) o
            vuelve a iniciar sesión. Para que tome efecto ya, deshabilitá y volvé a habilitar la
            cuenta.
          </>
        ) : (
          <>
            Ves y gestionás sólo a los usuarios de las empresas que administrás. Los permisos que
            esas personas tengan en otras empresas no se tocan. Cambiar roles, deshabilitar o
            eliminar cuentas es tarea de un administrador general.
          </>
        )}
      </p>

      {/* ── Alta de usuario ───────────────────────────────── */}
      <Dialog open={createOpen} onClose={() => setCreateOpen(false)}>
        <DialogContent onClose={() => setCreateOpen(false)}>
          <DialogHeader>
            <DialogTitle>Nuevo usuario</DialogTitle>
            <DialogDescription>
              Se crea la cuenta en Cognito con una contraseña temporal. En el primer ingreso el
              usuario define la definitiva.
            </DialogDescription>
          </DialogHeader>

          {createError && (
            <div
              role="alert"
              className="mb-4 flex items-start gap-2.5 rounded-lg border border-destructive/30 bg-destructive/10 px-3.5 py-2.5"
            >
              <AlertCircle size={15} className="text-destructive shrink-0 mt-0.5" aria-hidden="true" />
              <p className="text-[13px] text-destructive">{createError}</p>
            </div>
          )}

          <div className="space-y-4">
            <div className="space-y-1.5">
              <label htmlFor="admin-email" className="text-xs font-medium text-muted-foreground">
                Email
              </label>
              <Input
                id="admin-email"
                type="email"
                placeholder="persona@empresa.com"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
              />
            </div>

            <div className="space-y-1.5">
              <label htmlFor="admin-nombre" className="text-xs font-medium text-muted-foreground">
                Nombre <span className="text-muted-foreground/50">(opcional)</span>
              </label>
              <Input
                id="admin-nombre"
                placeholder="Nombre y apellido"
                value={form.nombre}
                onChange={(e) => setForm({ ...form, nombre: e.target.value })}
              />
            </div>

            {isMaster && (
            <div className="space-y-1.5">
              <label htmlFor="admin-rol" className="text-xs font-medium text-muted-foreground">
                Rol
              </label>
              <select
                id="admin-rol"
                value={form.rol}
                onChange={(e) => setForm({ ...form, rol: e.target.value })}
                className="flex h-10 w-full rounded-lg border border-input bg-background px-3 text-sm cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <option value="user">Usuario — acceso a la plataforma</option>
                <option value="admin_empresa">
                  Administrador de empresa — gestiona usuarios de sus empresas
                </option>
                <option value="master">
                  Administrador general — ve y administra toda la plataforma
                </option>
              </select>
            </div>
            )}

            {!isMaster && (
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground">
                  Empresas <span className="text-muted-foreground/50">(al menos una)</span>
                </label>
                <div className="max-h-40 overflow-y-auto rounded-lg border border-border divide-y divide-border">
                  {empresasDisponibles.length === 0 ? (
                    <p className="px-3 py-3 text-[12px] text-muted-foreground">
                      No administrás ninguna empresa todavía.
                    </p>
                  ) : (
                    empresasDisponibles.map((emp) => (
                      <label
                        key={emp.id}
                        className="flex items-center gap-2.5 px-3 py-2 cursor-pointer hover:bg-accent/40"
                      >
                        <input
                          type="checkbox"
                          checked={empresasElegidas.includes(emp.id)}
                          onChange={() =>
                            setEmpresasElegidas((prev) =>
                              prev.includes(emp.id)
                                ? prev.filter((x) => x !== emp.id)
                                : [...prev, emp.id]
                            )
                          }
                          className="cursor-pointer"
                        />
                        <span className="text-[13px] flex-1 min-w-0 truncate">{emp.nombre}</span>
                        <span className="text-[11px] font-mono text-muted-foreground/50">{emp.rut}</span>
                      </label>
                    ))
                  )}
                </div>
                <p className="text-[11.5px] text-muted-foreground/70">
                  Entra con acceso de sólo lectura. Después afinás los permisos con el botón de
                  empresas de su fila.
                </p>
              </div>
            )}

            <label className="flex items-start gap-2.5 cursor-pointer">
              <input
                type="checkbox"
                checked={form.enviarMail}
                onChange={(e) => setForm({ ...form, enviarMail: e.target.checked })}
                className="mt-0.5 cursor-pointer"
              />
              <span className="text-[12.5px] text-muted-foreground leading-snug">
                Enviarle un mail con la invitación y la contraseña temporal. Si lo desmarcás, la
                contraseña se muestra acá para que se la pases por otro medio.
              </span>
            </label>
          </div>

          <DialogFooter>
            <Button variant="ghost" onClick={() => setCreateOpen(false)} size="sm">
              Cancelar
            </Button>
            <Button
              onClick={handleCrear}
              disabled={
                creating || !form.email.trim() || (!isMaster && empresasElegidas.length === 0)
              }
              size="sm"
            >
              {creating ? 'Creando...' : 'Crear usuario'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Contraseña temporal ───────────────────────────── */}
      <Dialog open={!!credenciales} onClose={() => setCredenciales(null)}>
        <DialogContent onClose={() => setCredenciales(null)}>
          <DialogHeader>
            <DialogTitle>Contraseña temporal</DialogTitle>
            <DialogDescription>
              Pasásela a {credenciales?.email} por un canal seguro. No se puede volver a ver: si la
              perdés, generá una nueva.
            </DialogDescription>
          </DialogHeader>
          {credenciales && <PasswordTemporal password={credenciales.password} />}
          <DialogFooter>
            <Button onClick={() => setCredenciales(null)} size="sm">
              Listo
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Permisos por empresa ──────────────────────────── */}
      {accesosDe && (
        <AccesosDialog
          usuario={accesosDe}
          onClose={() => setAccesosDe(null)}
          onGuardado={load}
        />
      )}

      {/* ── Confirmación de borrado ───────────────────────── */}
      <Dialog
        open={!!aEliminar}
        onClose={() => {
          setAEliminar(null)
          setConfirmacion('')
        }}
      >
        <DialogContent
          onClose={() => {
            setAEliminar(null)
            setConfirmacion('')
          }}
        >
          <DialogHeader>
            <DialogTitle>Eliminar usuario</DialogTitle>
            <DialogDescription>
              Se borra la cuenta de Cognito de forma permanente y no se puede deshacer. Si sólo
              querés sacarle el acceso, deshabilitala en lugar de borrarla.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-1.5">
            <label htmlFor="admin-confirmar" className="text-xs font-medium text-muted-foreground">
              Escribí <span className="font-mono text-foreground">{aEliminar?.email}</span> para
              confirmar
            </label>
            <Input
              id="admin-confirmar"
              value={confirmacion}
              onChange={(e) => setConfirmacion(e.target.value)}
              autoComplete="off"
            />
          </div>

          <DialogFooter>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setAEliminar(null)
                setConfirmacion('')
              }}
            >
              Cancelar
            </Button>
            <Button
              variant="destructive"
              size="sm"
              disabled={eliminando || confirmacion.trim() !== aEliminar?.email}
              onClick={handleEliminar}
            >
              {eliminando ? 'Eliminando...' : 'Eliminar definitivamente'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
