// Tests de la capa de permisos por empresa. No toca la base: mockea Prisma.
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
if (!process.env.COGNITO_USER_POOL_ID) process.env.COGNITO_USER_POOL_ID = 'us-east-1_TEST';
if (!process.env.COGNITO_CLIENT_ID) process.env.COGNITO_CLIENT_ID = 'testclient';

const assert = require('assert');
const Module = require('module');

// ── Stub de Prisma, inyectado antes de que lo carguen los servicios ──
let FILAS = [];
let EMPRESAS = [{ id: 'e1' }, { id: 'e2' }, { id: 'e3' }];

const prismaStub = {
  usuarioEmpresa: {
    findUnique: async ({ where }) => {
      const { usuarioSub, empresaId } = where.usuarioSub_empresaId;
      return FILAS.find((f) => f.usuarioSub === usuarioSub && f.empresaId === empresaId) || null;
    },
    findMany: async ({ where }) => FILAS.filter((f) => f.usuarioSub === where.usuarioSub),
    deleteMany: async ({ where }) => {
      const antes = FILAS.length;
      FILAS = FILAS.filter((f) => f.usuarioSub !== where.usuarioSub);
      return { count: antes - FILAS.length };
    },
    create: async ({ data }) => { FILAS.push({ ...data }); return data; },
  },
  empresa: {
    findMany: async (args) => {
      const ids = args?.where?.id?.in;
      return ids ? EMPRESAS.filter((e) => ids.includes(e.id)) : EMPRESAS;
    },
  },
  // La transaccion del stub ejecuta las promesas ya creadas, en orden
  $transaction: async (ops) => { const out = []; for (const op of ops) out.push(await op); return out; },
};

const origLoad = Module._load;
Module._load = function (request, parent, isMain) {
  if (request.endsWith('config/prisma')) return prismaStub;
  return origLoad.apply(this, arguments);
};

const path = require('path');
const BE = path.join(__dirname, '..');
const acceso = require(path.join(BE, 'src/modules/acceso/acceso.service'));
const { requireEscritura, cargarAcceso } = require(path.join(BE, 'src/middleware/acceso.middleware'));
const { normalizarEscritura, MODULO_IDS } = require(path.join(BE, 'src/common/constants/permisos'));

const MASTER = { sub: 'sub-master', role: 'master' };
const USER = { sub: 'sub-user', role: 'user' };
const ADMIN_EMP = { sub: 'sub-adminemp', role: 'admin_empresa' };
const OTRO = { sub: 'sub-otro', role: 'user' };

function correrMw(mw, req) {
  return new Promise((resolve) => {
    let status, body, nexted = false;
    const res = { status(s) { status = s; return this; }, json(b) { body = b; resolve({ status, body, nexted }); return this; } };
    const r = mw(req, res, () => { nexted = true; resolve({ status, body, nexted }); });
    if (r && typeof r.then === 'function') r.catch(() => resolve({ status, body, nexted }));
  });
}

(async () => {
  // ── 1. normalizarEscritura ─────────────────────────────
  assert.deepEqual(normalizarEscritura(['facturas', 'inventado', 'empresa']), ['empresa', 'facturas'],
    'descarta desconocidos y respeta orden canonico');
  assert.deepEqual(normalizarEscritura(['checklist', 'checklist']), ['checklist'], 'deduplica');
  assert.deepEqual(normalizarEscritura(null), []);
  assert.deepEqual(normalizarEscritura('facturas'), [], 'string suelto no es lista');
  console.log('OK normalizarEscritura');

  // ── 2. master ve todo sin filas en la base ──────────────
  FILAS = [];
  const aMaster = await acceso.getAcceso(MASTER, 'e1');
  assert.equal(aMaster.lectura, true);
  assert.deepEqual(aMaster.escritura, MODULO_IDS, 'master escribe todos los modulos');
  assert.equal(await acceso.getEmpresasVisibles(MASTER), null, 'null = ve todas');
  console.log('OK master accede a todo por rol');

  // ── 3. usuario sin asignaciones no ve nada ─────────────
  assert.deepEqual(await acceso.getEmpresasVisibles(USER), [], 'deny-by-default');
  assert.equal((await acceso.getAcceso(USER, 'e1')).lectura, false);
  console.log('OK usuario nuevo arranca sin ninguna empresa');

  // ── 4. asignar accesos ─────────────────────────────────
  await acceso.reemplazarAccesos(USER.sub, [
    { empresaId: 'e1', escritura: ['checklist'] },
    { empresaId: 'e2' },
  ]);
  assert.deepEqual((await acceso.getEmpresasVisibles(USER)).sort(), ['e1', 'e2']);
  const a1 = await acceso.getAcceso(USER, 'e1');
  assert.deepEqual(a1.escritura, ['checklist']);
  const a2 = await acceso.getAcceso(USER, 'e2');
  assert.deepEqual(a2.escritura, [], 'sin escritura = solo lectura');
  assert.equal((await acceso.getAcceso(USER, 'e3')).lectura, false, 'e3 no asignada');
  console.log('OK asignar accesos (lectura y escritura granular)');

  // ── 5. reemplazar es reemplazo total, no merge ─────────
  await acceso.reemplazarAccesos(USER.sub, [{ empresaId: 'e3', escritura: ['facturas'] }]);
  assert.deepEqual(await acceso.getEmpresasVisibles(USER), ['e3'], 'las anteriores se van');
  console.log('OK reemplazarAccesos reemplaza el set completo');

  // ── 6. no se puede asignar una empresa inexistente ─────
  await assert.rejects(
    () => acceso.reemplazarAccesos(USER.sub, [{ empresaId: 'no-existe' }]),
    (e) => e.status === 400);
  assert.deepEqual(await acceso.getEmpresasVisibles(USER), ['e3'], 'el fallo no destruyo lo anterior');
  console.log('OK empresa inexistente -> 400 y no pisa lo existente');

  // ── 7. los accesos son por usuario ─────────────────────
  assert.deepEqual(await acceso.getEmpresasVisibles(OTRO), [], 'otro usuario no hereda nada');
  console.log('OK aislamiento entre usuarios');

  // ── 8. cargarAcceso: 404 si no tiene lectura ───────────
  await acceso.reemplazarAccesos(USER.sub, [{ empresaId: 'e1', escritura: ['checklist'] }]);
  let r = await correrMw(cargarAcceso, { method: 'GET', params: { empresaId: 'e2' }, user: USER });
  assert.equal(r.status, 404, 'empresa no asignada -> 404, no 403');
  r = await correrMw(cargarAcceso, { method: 'GET', params: { empresaId: 'e1' }, user: USER });
  assert.equal(r.nexted, true, 'empresa asignada pasa');
  console.log('OK cargarAcceso corta con 404 las empresas ajenas');

  // ── 9. requireEscritura por modulo y metodo ────────────
  const accesoChecklist = { lectura: true, escritura: ['checklist'] };
  const g = requireEscritura('checklist');
  assert.equal((await correrMw(g, { method: 'GET', path: '/', acceso: accesoChecklist })).nexted, true, 'GET siempre pasa');
  assert.equal((await correrMw(g, { method: 'PATCH', path: '/x', acceso: accesoChecklist })).nexted, true, 'PATCH con permiso pasa');
  const gFact = requireEscritura('facturas');
  assert.equal((await correrMw(gFact, { method: 'POST', path: '/x', acceso: accesoChecklist })).status, 403,
    'escribir facturas con permiso solo de checklist -> 403');
  assert.equal((await correrMw(gFact, { method: 'GET', path: '/x', acceso: accesoChecklist })).nexted, true,
    'leer facturas sin escritura si pasa');
  console.log('OK requireEscritura distingue modulo y metodo');

  // ── 10. (la excepcion del Excel se verifica en el test de rutas:
  //        esa ruta directamente no lleva guard) ───────────────

  // ── 11. solo-lectura no puede escribir nada ────────────
  const soloLectura = { lectura: true, escritura: [] };
  for (const modulo of MODULO_IDS) {
    const guard = requireEscritura(modulo);
    assert.equal((await correrMw(guard, { method: 'POST', path: '/x', acceso: soloLectura })).status, 403,
      `solo-lectura no deberia escribir ${modulo}`);
  }
  console.log('OK usuario de solo lectura bloqueado en los 5 modulos');

  // ── 12. escritura total ────────────────────────────────
  const total = { lectura: true, escritura: [...MODULO_IDS] };
  for (const modulo of MODULO_IDS) {
    const guard = requireEscritura(modulo);
    assert.equal((await correrMw(guard, { method: 'POST', path: '/x', acceso: total })).nexted, true,
      `escritura total deberia poder ${modulo}`);
  }
  console.log('OK escritura total habilita los 5 modulos');

  // ── 13. borrar accesos al eliminar el usuario ──────────
  await acceso.borrarAccesosDeUsuario(USER.sub);
  assert.deepEqual(await acceso.getEmpresasVisibles(USER), []);
  console.log('OK borrarAccesosDeUsuario limpia todo');

  console.log('\nTODOS LOS TESTS DE PERMISOS PASARON');
})().catch((e) => { console.error('\nFALLO:', e.message); process.exit(1); });
