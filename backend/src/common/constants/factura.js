/**
 * Valores válidos de los campos de un comprobante. Son la única fuente: los
 * usan el esquema y el prompt de la lectura con IA, y el frontend tiene una
 * copia en src/lib/constantes.js (mantenerlas iguales).
 */
const CATEGORIAS = [
  'Maquinaria',
  'Equipos',
  'Instalaciones',
  'Vehiculos',
  'MEIV/Imprevistos',
  'Materiales',
  'Mano de Obra Directa',
  'Mano de Obra Indirecta',
  'Leyes Sociales',
  'Honorarios',
  'OC/Imprevistos',
];

const TIPOS_COMPROBANTE = ['Factura', 'Presupuesto'];

module.exports = { CATEGORIAS, TIPOS_COMPROBANTE };
