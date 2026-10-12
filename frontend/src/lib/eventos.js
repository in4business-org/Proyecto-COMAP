// Avisos entre pantallas que no comparten estado (p. ej. la página de empresa
// y el menú lateral). Sin librerías: un CustomEvent en window.

const NOMBRE = 'gpc:cambio'

/** Avisar que cambió algo: avisarCambio('proyectos', empresaId) */
export function avisarCambio(tipo, id) {
  window.dispatchEvent(new CustomEvent(NOMBRE, { detail: { tipo, id } }))
}

/** Escuchar cambios; devuelve la función para dejar de escuchar */
export function escucharCambios(fn) {
  const handler = (e) => fn(e.detail)
  window.addEventListener(NOMBRE, handler)
  return () => window.removeEventListener(NOMBRE, handler)
}
