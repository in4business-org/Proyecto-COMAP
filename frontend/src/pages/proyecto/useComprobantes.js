import { useEffect, useState, useCallback } from 'react'
import { facturas as factApi } from '@/lib/api'

/**
 * Comprobantes de un proyecto, por período. Se cargan todos los períodos en un
 * solo pedido y se guardan en caché, así cambiar de pestaña no vuelve a cargar.
 *
 * - `comprobantes`: los del período activo, con cambios locales sin guardar
 * - `setComprobantes`: cambio local (p. ej. mover una tarjeta del plan)
 * - `aplicar(lista)`: lo que devolvió el backend tras guardar; actualiza la caché
 */
export function useComprobantes(empresaId, proyectoId, periodos, periodoActivo) {
  const [porPeriodo, setPorPeriodo] = useState({})
  const [comprobantes, setComprobantes] = useState(null)
  const [cargando, setCargando] = useState(true)

  useEffect(() => {
    setCargando(true)
    factApi.getAllResults(empresaId, proyectoId)
      .then((agrupados) => {
        const cache = {}
        for (const p of periodos) cache[p] = agrupados[p] || []
        setPorPeriodo(cache)
      })
      .catch((err) => { console.error(err); setComprobantes([]) })
      .finally(() => setCargando(false))
  }, [empresaId, proyectoId, periodos])

  useEffect(() => {
    if (porPeriodo[periodoActivo] !== undefined) setComprobantes(porPeriodo[periodoActivo])
  }, [periodoActivo, porPeriodo])

  const aplicar = useCallback((lista) => {
    setComprobantes(lista)
    setPorPeriodo(prev => ({ ...prev, [periodoActivo]: lista }))
  }, [periodoActivo])

  return { comprobantes, setComprobantes, cargando, aplicar }
}
