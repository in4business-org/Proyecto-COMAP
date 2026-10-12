import { useEffect, useState } from 'react'
import { empresas as empApi, proyectos as projApi } from '@/lib/api'

/** Empresa y proyecto de la URL. `proyecto` queda en {} si no se encuentra. */
export function useProyecto(empresaId, proyectoId) {
  const [empresa, setEmpresa] = useState(null)
  const [proyecto, setProyecto] = useState(null)
  const [cargando, setCargando] = useState(true)

  useEffect(() => {
    let cancelado = false
    setCargando(true)
    Promise.all([
      empApi.get(empresaId).catch(() => null),
      projApi.list(empresaId).catch(() => []),
    ]).then(([emp, projs]) => {
      if (cancelado) return
      setEmpresa(emp)
      setProyecto(projs.find((p) => p.id === proyectoId) || {})
    }).finally(() => { if (!cancelado) setCargando(false) })
    return () => { cancelado = true }
  }, [empresaId, proyectoId])

  return { empresa, proyecto, setProyecto, cargando }
}
