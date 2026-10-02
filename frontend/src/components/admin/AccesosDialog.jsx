import { useEffect, useMemo, useState } from 'react'
import { Search, AlertCircle, Building2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Spinner } from '@/components/ui/loading'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'
import { admin as adminApi, empresas as empApi } from '@/lib/api'

/**
 * Edita los permisos de un usuario sobre cada empresa.
 *
 * El estado es un Map empresaId -> string[] de módulos con escritura.
 * Que la empresa esté en el Map significa lectura; el array dice qué además
 * puede modificar. Se guarda con un PUT que reemplaza el set completo.
 */
export function AccesosDialog({ usuario, onClose, onGuardado }) {
  // A un admin de empresa sólo se le elige QUÉ empresas administra: adentro
  // tiene control total, así que el detalle por módulo no se muestra.
  const esAdminEmpresa = usuario?.rol === 'admin_empresa'
  const [empresas, setEmpresas] = useState([])
  const [modulos, setModulos] = useState([])
  const [seleccion, setSeleccion] = useState(new Map())
  const [cargando, setCargando] = useState(true)
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState(null)
  const [search, setSearch] = useState('')

  useEffect(() => {
    if (!usuario) return
    let cancelado = false

    setCargando(true)
    setError(null)
    Promise.all([
      empApi.list(),
      adminApi.listModulos(),
      adminApi.getAccesos(usuario.username),
    ])
      .then(([emps, mods, accesos]) => {
        if (cancelado) return
        setEmpresas(emps)
        setModulos(mods)
        setSeleccion(new Map(accesos.map((a) => [a.empresaId, a.escritura || []])))
      })
      .catch((err) => !cancelado && setError(err.message))
      .finally(() => !cancelado && setCargando(false))

    return () => { cancelado = true }
  }, [usuario])

  const moduloIds = useMemo(() => modulos.map((m) => m.id), [modulos])

  const filtradas = empresas.filter((e) =>
    `${e.nombre} ${e.rut}`.toLowerCase().includes(search.toLowerCase())
  )

  const toggleEmpresa = (empresaId) => {
    setSeleccion((prev) => {
      const next = new Map(prev)
      if (next.has(empresaId)) next.delete(empresaId)
      else next.set(empresaId, [])
      return next
    })
  }

  const toggleModulo = (empresaId, moduloId) => {
    setSeleccion((prev) => {
      const next = new Map(prev)
      const actual = next.get(empresaId) || []
      next.set(
        empresaId,
        actual.includes(moduloId)
          ? actual.filter((m) => m !== moduloId)
          : [...actual, moduloId]
      )
      return next
    })
  }

  const setTodoLectura = (empresaId) => {
    setSeleccion((prev) => new Map(prev).set(empresaId, []))
  }

  const setTodoEscritura = (empresaId) => {
    setSeleccion((prev) => new Map(prev).set(empresaId, [...moduloIds]))
  }

  const guardar = async () => {
    setGuardando(true)
    setError(null)
    try {
      const accesos = [...seleccion.entries()].map(([empresaId, escritura]) => ({
        empresaId,
        escritura: esAdminEmpresa ? [] : escritura,
      }))
      await adminApi.setAccesos(usuario.username, accesos)
      onGuardado?.()
      onClose()
    } catch (err) {
      setError(err.message)
    } finally {
      setGuardando(false)
    }
  }

  return (
    <Dialog open={!!usuario} onClose={onClose}>
      <DialogContent onClose={onClose} className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>
            {esAdminEmpresa ? 'Empresas que administra' : 'Permisos'} de{' '}
            {usuario?.nombre || usuario?.email}
          </DialogTitle>
          <DialogDescription>
            {esAdminEmpresa
              ? 'Elegí qué empresas administra. Dentro de cada una tiene control total sobre los datos y gestiona a sus usuarios.'
              : 'Marcá las empresas que puede ver. Dentro de cada una, elegí qué módulos puede modificar; sin ninguno marcado queda en sólo lectura.'}
          </DialogDescription>
        </DialogHeader>

        {error && (
          <div
            role="alert"
            className="mb-4 flex items-start gap-2.5 rounded-lg border border-destructive/30 bg-destructive/10 px-3.5 py-2.5"
          >
            <AlertCircle size={15} className="text-destructive shrink-0 mt-0.5" aria-hidden="true" />
            <p className="text-[13px] text-destructive">{error}</p>
          </div>
        )}

        {cargando ? (
          <div className="flex items-center justify-center py-12">
            <Spinner size={24} />
          </div>
        ) : empresas.length === 0 ? (
          <p className="py-10 text-center text-sm text-muted-foreground">
            Todavía no hay empresas cargadas.
          </p>
        ) : (
          <>
            <div className="relative mb-3">
              <Search
                size={14}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
              />
              <Input
                placeholder="Buscar empresa..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                aria-label="Buscar empresa"
                className="pl-8 h-9 text-sm"
              />
            </div>

            <div className="max-h-[42vh] overflow-y-auto rounded-lg border border-border divide-y divide-border">
              {filtradas.length === 0 ? (
                <p className="py-8 text-center text-[13px] text-muted-foreground">Sin resultados</p>
              ) : (
                filtradas.map((emp) => {
                  const activa = seleccion.has(emp.id)
                  const escritura = seleccion.get(emp.id) || []
                  const esTotal = moduloIds.length > 0 && escritura.length === moduloIds.length

                  return (
                    <div key={emp.id} className={activa ? 'bg-accent/30' : ''}>
                      <label className="flex items-center gap-2.5 px-3 py-2.5 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={activa}
                          onChange={() => toggleEmpresa(emp.id)}
                          className="cursor-pointer"
                        />
                        <Building2 size={13} className="text-muted-foreground shrink-0" />
                        <span className="text-[13px] font-medium flex-1 min-w-0 truncate">
                          {emp.nombre}
                        </span>
                        <span className="text-[11px] font-mono text-muted-foreground/50 shrink-0">
                          {emp.rut}
                        </span>
                      </label>

                      {activa && !esAdminEmpresa && (
                        <div className="px-3 pb-3 pl-9">
                          <div className="flex items-center gap-1.5 mb-2">
                            <button
                              type="button"
                              onClick={() => setTodoLectura(emp.id)}
                              className={`rounded-md border px-2 py-0.5 text-[11px] font-medium transition-colors cursor-pointer ${
                                escritura.length === 0
                                  ? 'border-primary/30 bg-primary/10 text-primary'
                                  : 'border-border text-muted-foreground hover:bg-accent'
                              }`}
                            >
                              Sólo lectura
                            </button>
                            <button
                              type="button"
                              onClick={() => setTodoEscritura(emp.id)}
                              className={`rounded-md border px-2 py-0.5 text-[11px] font-medium transition-colors cursor-pointer ${
                                esTotal
                                  ? 'border-primary/30 bg-primary/10 text-primary'
                                  : 'border-border text-muted-foreground hover:bg-accent'
                              }`}
                            >
                              Escritura total
                            </button>
                          </div>

                          <div className="flex flex-wrap gap-x-4 gap-y-1.5">
                            {modulos.map((m) => (
                              <label
                                key={m.id}
                                className="flex items-center gap-1.5 cursor-pointer text-[12px] text-muted-foreground"
                              >
                                <input
                                  type="checkbox"
                                  checked={escritura.includes(m.id)}
                                  onChange={() => toggleModulo(emp.id, m.id)}
                                  className="cursor-pointer"
                                />
                                Escribir {m.nombre.toLowerCase()}
                              </label>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )
                })
              )}
            </div>

            <p className="mt-2.5 text-[11.5px] text-muted-foreground/70">
              {seleccion.size === 0
                ? esAdminEmpresa
                  ? 'Sin empresas: no va a poder administrar nada.'
                  : 'Sin empresas asignadas: no va a ver nada en la plataforma.'
                : `${seleccion.size} empresa${seleccion.size === 1 ? '' : 's'} ${
                    esAdminEmpresa ? 'bajo su administración' : 'asignada' + (seleccion.size === 1 ? '' : 's')
                  }.`}
            </p>
          </>
        )}

        <DialogFooter>
          <Button variant="ghost" onClick={onClose} size="sm">
            Cancelar
          </Button>
          <Button onClick={guardar} disabled={cargando || guardando} size="sm">
            {guardando ? 'Guardando...' : 'Guardar permisos'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
