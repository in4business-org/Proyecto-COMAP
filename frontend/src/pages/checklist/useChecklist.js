import { useCallback, useEffect, useState } from 'react'
import { checklist as checkApi } from '@/lib/api'

/**
 * Checklist de presentación de un proyecto y las respuestas de "Antes de
 * empezar". Los cambios se muestran al instante y se vuelven atrás si el
 * servidor falla.
 */
export function useChecklist(empresaId, proyectoId) {
  const [items, setItems] = useState(null)
  const [perfil, setPerfil] = useState({ preguntas: [], respuestas: {} })
  const [subiendo, setSubiendo] = useState(null)
  const [error, setError] = useState(null)

  const cargar = useCallback(async () => {
    if (!proyectoId) return
    try {
      const [its, perf] = await Promise.all([
        checkApi.get(empresaId, proyectoId),
        checkApi.getPerfil(empresaId, proyectoId).catch(() => ({ preguntas: [], respuestas: {} })),
      ])
      setItems(its)
      setPerfil(perf)
    } catch (err) {
      setError(err.message)
      setItems([])
    }
  }, [empresaId, proyectoId])

  useEffect(() => { setItems(null); cargar() }, [cargar])

  const cambiarLocal = (id, cambios) => setItems((prev) => prev.map((i) => (i.id === id ? { ...i, ...cambios } : i)))

  /** Cambia el estado de un ítem: 'completado' | 'pendiente' | 'no_aplica' */
  const marcar = async (item, estado) => {
    setError(null)
    cambiarLocal(item.id, { estado, no_aplica_por: null })
    try {
      await checkApi.updateItem(empresaId, proyectoId, item.id, estado, item.nota_usuario || '')
    } catch (err) {
      setError(`No se pudo guardar: ${err.message}`)
      cargar()
    }
  }

  const subir = async (item, file) => {
    setError(null)
    setSubiendo(item.id)
    try {
      const r = await checkApi.uploadFile(empresaId, proyectoId, item.id, file)
      cambiarLocal(item.id, { estado: 'completado', archivo: r?.archivo || file.name, no_aplica_por: null })
    } catch (err) {
      setError(`No se pudo subir "${file.name}": ${err.message}`)
    } finally {
      setSubiendo(null)
    }
  }

  const bajar = async (item) => {
    setError(null)
    try {
      const blob = await checkApi.downloadFile(empresaId, proyectoId, item.id)
      const a = document.createElement('a')
      a.href = URL.createObjectURL(blob)
      a.download = item.archivo.split('/').pop()
      a.click()
    } catch (err) {
      setError(`No se pudo bajar el archivo: ${err.message}`)
    }
  }

  /** Guarda las respuestas y vuelve a pedir el checklist (cambia qué aplica) */
  const responder = async (respuestas) => {
    setError(null)
    const antes = perfil.respuestas
    setPerfil((p) => ({ ...p, respuestas }))
    try {
      await checkApi.setPerfil(empresaId, proyectoId, respuestas)
      setItems(await checkApi.get(empresaId, proyectoId))
    } catch (err) {
      setPerfil((p) => ({ ...p, respuestas: antes }))
      setError(`No se pudo guardar la respuesta: ${err.message}`)
    }
  }

  return { items, perfil, subiendo, error, setError, marcar, subir, bajar, responder }
}

/** Totales del checklist para tarjetas y encabezados */
export function resumenChecklist(items) {
  const aplican = (items || []).filter((i) => i.estado !== 'no_aplica')
  const listos = aplican.filter((i) => i.estado === 'completado').length
  return {
    aplican: aplican.length,
    listos,
    pendientes: aplican.length - listos,
    noAplican: (items || []).length - aplican.length,
    siguiente: aplican.find((i) => i.estado === 'pendiente') || null,
    completo: aplican.length > 0 && listos === aplican.length,
  }
}
