/**
 * Módulos sobre los que se puede dar permiso de escritura dentro de una empresa.
 * El orden es el que usa el panel de administración para mostrarlos.
 */
const MODULOS = [
  { id: 'empresa', nombre: 'Datos de la empresa' },
  { id: 'proyectos', nombre: 'Proyectos' },
  { id: 'facturas', nombre: 'Facturas' },
  { id: 'checklist', nombre: 'Checklist' },
  { id: 'simulador', nombre: 'Simulador' },
];

const MODULO_IDS = MODULOS.map((m) => m.id);

/**
 * Normaliza una lista de módulos de escritura: descarta lo desconocido,
 * deduplica y respeta el orden canónico de MODULOS.
 * @param {unknown} escritura
 * @returns {string[]}
 */
function normalizarEscritura(escritura) {
  if (!Array.isArray(escritura)) return [];
  const pedidos = new Set(escritura.filter((m) => typeof m === 'string'));
  return MODULO_IDS.filter((id) => pedidos.has(id));
}

/**
 * Acceso de un administrador: lectura y escritura sobre todo.
 * No se guarda en la base, se arma al vuelo.
 */
function accesoTotal() {
  return { lectura: true, escritura: [...MODULO_IDS], esAdmin: true };
}

/** Acceso de alguien sin ninguna fila para esa empresa: no ve nada. */
function sinAcceso() {
  return { lectura: false, escritura: [], esAdmin: false };
}

/**
 * @param {{ lectura: boolean, escritura: string[] }} acceso
 * @param {string} modulo
 * @returns {boolean} si puede escribir ese módulo
 */
function puedeEscribir(acceso, modulo) {
  return Boolean(acceso?.lectura) && (acceso.escritura || []).includes(modulo);
}

module.exports = {
  MODULOS,
  MODULO_IDS,
  normalizarEscritura,
  accesoTotal,
  sinAcceso,
  puedeEscribir,
};
