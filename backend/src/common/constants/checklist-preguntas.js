/**
 * Preguntas de "Antes de empezar" del checklist.
 *
 * No cambian el checklist (CHECKLIST_PRESENTACION es el que es): sólo indican
 * qué ítems condicionales NO corresponden cuando la respuesta es "no". Esos
 * ítems se muestran como "no aplica"; si la respuesta es "sí" o no se
 * respondió, quedan como estaban.
 */
const PREGUNTAS_CHECKLIST = [
  {
    id: 'mipyme',
    texto: '¿Es MIPYME y pide el beneficio adicional?',
    items: ['2.1'],
  },
  {
    id: 'importacion',
    texto: '¿Importa bienes con exoneración?',
    items: ['2.2'],
  },
  {
    id: 'obra_civil',
    texto: '¿La inversión incluye obra civil?',
    items: ['3.3', '3.4'],
  },
  {
    id: 'agro_cannabis',
    texto: '¿Es agropecuaria o trabaja con cannabis?',
    items: ['2.4', '2.5', '3.2'],
  },
  {
    id: 'impacto_ambiental',
    texto: '¿Necesita estudio de impacto ambiental?',
    items: ['2.3'],
  },
];

const PREGUNTA_IDS = PREGUNTAS_CHECKLIST.map((p) => p.id);

/**
 * Deja sólo respuestas válidas: claves conocidas y valores true/false.
 * null o ausente = sin responder.
 */
function normalizarRespuestas(respuestas) {
  if (!respuestas || typeof respuestas !== 'object') return {};
  const limpias = {};
  for (const id of PREGUNTA_IDS) {
    if (typeof respuestas[id] === 'boolean') limpias[id] = respuestas[id];
  }
  return limpias;
}

/**
 * Aplica las respuestas a los ítems del checklist ya armados.
 * Un ítem pasa a 'no_aplica' (con `no_aplica_por`) si alguna pregunta que lo
 * menciona se respondió "no" y el ítem no está completado: lo que ya se
 * cargó se respeta.
 */
function aplicarRespuestas(items, respuestas) {
  const r = normalizarRespuestas(respuestas);
  return items.map((item) => {
    const pregunta = PREGUNTAS_CHECKLIST.find((p) => p.items.includes(item.id) && r[p.id] === false);
    if (!pregunta || item.estado === 'completado') return { ...item, no_aplica_por: null };
    return { ...item, estado: 'no_aplica', no_aplica_por: pregunta.id };
  });
}

module.exports = { PREGUNTAS_CHECKLIST, normalizarRespuestas, aplicarRespuestas };
