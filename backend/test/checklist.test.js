// Las respuestas de "Antes de empezar" sólo marcan como no aplica ítems que ya
// existen en el checklist; el checklist en sí no cambia.
const assert = require('assert');
const { CHECKLIST_PRESENTACION } = require('../src/common/constants/checklist-items');
const { PREGUNTAS_CHECKLIST, normalizarRespuestas, aplicarRespuestas } = require('../src/common/constants/checklist-preguntas');

let fallos = 0;
function chequear(desc, fn) {
  try { fn(); console.log('OK  ' + desc); }
  catch (e) { console.log('FAIL ' + desc + ' -> ' + e.message); fallos++; }
}

const ids = new Set(CHECKLIST_PRESENTACION.map((i) => i.id));
const base = CHECKLIST_PRESENTACION.map((i) => ({ ...i, estado: 'pendiente', archivo: null }));
const todoNo = { mipyme: false, importacion: false, obra_civil: false, agro_cannabis: false, impacto_ambiental: false };

chequear('cada pregunta apunta a ítems que existen', () => {
  for (const p of PREGUNTAS_CHECKLIST) for (const id of p.items) assert(ids.has(id), `${p.id} -> ${id}`);
});
chequear('son 5 preguntas', () => assert.strictEqual(PREGUNTAS_CHECKLIST.length, 5));
chequear('sin respuestas no cambia nada', () => {
  const r = aplicarRespuestas(base, {});
  assert(r.every((i) => i.estado === 'pendiente' && i.no_aplica_por === null));
  assert.strictEqual(r.length, base.length);
});
chequear('"no" a obra civil marca 3.3 y 3.4 como no aplica', () => {
  const r = aplicarRespuestas(base, { obra_civil: false });
  assert.deepStrictEqual(r.filter((i) => i.estado === 'no_aplica').map((i) => i.id), ['3.3', '3.4']);
  assert.strictEqual(r.find((i) => i.id === '3.3').no_aplica_por, 'obra_civil');
});
chequear('"sí" no marca nada', () => {
  const r = aplicarRespuestas(base, { obra_civil: true, mipyme: true });
  assert(r.every((i) => i.estado === 'pendiente'));
});
chequear('un ítem ya completado se respeta aunque la respuesta sea "no"', () => {
  const items = base.map((i) => (i.id === '2.1' ? { ...i, estado: 'completado', archivo: 'x.pdf' } : i));
  assert.strictEqual(aplicarRespuestas(items, { mipyme: false }).find((i) => i.id === '2.1').estado, 'completado');
});
chequear('los ítems, textos y orden del checklist no cambian', () => {
  const r = aplicarRespuestas(base, todoNo);
  assert.deepStrictEqual(
    r.map((i) => [i.id, i.descripcion, i.seccion, i.nota, i.acepta_archivo]),
    base.map((i) => [i.id, i.descripcion, i.seccion, i.nota, i.acepta_archivo])
  );
});
chequear('normalizarRespuestas descarta claves y valores raros', () => {
  assert.deepStrictEqual(normalizarRespuestas({ mipyme: false, x: true, obra_civil: 'no', agro_cannabis: null }), { mipyme: false });
  assert.deepStrictEqual(normalizarRespuestas(null), {});
});

console.log(fallos === 0 ? '\nTODOS LOS TESTS DE CHECKLIST PASARON' : `\n${fallos} FALLARON`);
process.exit(fallos === 0 ? 0 : 1);
