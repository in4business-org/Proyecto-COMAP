// Test de integracion: levanta la app real de main.js con Cognito y Prisma
// mockeados, y pega a las URLs de verdad para verificar el choke point.
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
process.env.PORT = '3097';

const assert = require('assert');
const Module = require('module');
const path = require('path');

// ── Usuario que "devuelve" el auth en cada request ──────────
let USUARIO_ACTUAL = null;

// ── Datos ───────────────────────────────────────────────────
const EMPRESAS = [{ id: 'e1', nombre: 'Uno', rut: '1' }, { id: 'e2', nombre: 'Dos', rut: '2' }];
// sub-user ve e1 (solo lectura) y nada de e2
let FILAS = [{ usuarioSub: 'sub-user', empresaId: 'e1', escritura: [] }];

const prismaStub = {
  usuarioEmpresa: {
    findUnique: async ({ where }) => {
      const { usuarioSub, empresaId } = where.usuarioSub_empresaId;
      return FILAS.find((f) => f.usuarioSub === usuarioSub && f.empresaId === empresaId) || null;
    },
    findMany: async ({ where }) => FILAS.filter((f) => f.usuarioSub === where.usuarioSub),
    deleteMany: async () => ({ count: 0 }),
    create: async ({ data }) => data,
  },
  empresa: {
    findMany: async (args) => {
      const ids = args?.where?.id?.in;
      const base = ids ? EMPRESAS.filter((e) => ids.includes(e.id)) : EMPRESAS;
      return base.map((e) => ({ ...e, proyectos: [] }));
    },
    findUnique: async ({ where }) => EMPRESAS.find((e) => e.id === where.id) || null,
    upsert: async () => ({}),
    update: async () => ({}),
    count: async () => EMPRESAS.length,
  },
  proyecto: {
    findMany: async () => [],
    count: async () => 0,
    create: async () => ({ id: 'p1' }),
    update: async () => ({}),
    // p1 pertenece a e1 y p2 a e2: asi podemos probar el cruce
    findFirst: async ({ where }) => {
      const duenio = { p1: 'e1', p2: 'e2' };
      return duenio[where.id] === where.empresaId ? { id: where.id } : null;
    },
  },
  factura: { count: async () => 0, findMany: async () => [] },
  checklistItem: { findMany: async () => [], upsert: async () => ({}) },
  $transaction: async (ops) => ops,
};

// Auth falso: inyecta USUARIO_ACTUAL sin validar ningun JWT
function requireAuthFake(req, res, next) {
  if (!USUARIO_ACTUAL) return res.status(401).json({ error: 'sin usuario' });
  req.user = USUARIO_ACTUAL;
  next();
}
function requireMasterFake(req, res, next) {
  if (req.user?.role !== 'master') return res.status(403).json({ error: 'solo master' });
  next();
}
function requirePanelFake(req, res, next) {
  if (!['master','admin_empresa'].includes(req.user?.role)) return res.status(403).json({ error: 'solo panel' });
  next();
}
const authStub = requireAuthFake;
authStub.requireAuth = requireAuthFake;
authStub.requireMaster = requireMasterFake;
authStub.requirePanel = requirePanelFake;

// S3 simulado: que listFiles devuelva algo hace que /analizar pase el early
// return y llegue a la parte que reescribe la tabla.
const s3Stub = {
  listFiles: async () => [{ name: 'factura.pdf' }],
  downloadFile: async () => Buffer.from('x'),
  uploadFile: async () => ({ key: 'k' }),
  deleteFile: async () => ({ key: 'k' }),
  getSignedUrl: async () => 'https://example.invalid/x',
};

const origLoad = Module._load;
Module._load = function (request) {
  if (request.endsWith('config/prisma')) return prismaStub;
  if (request.endsWith('middleware/auth.middleware')) return authStub;
  if (request.endsWith('config/s3.config')) return s3Stub;
  return origLoad.apply(this, arguments);
};

process.chdir(path.join(__dirname, '..'));
require(path.join(__dirname, '..', 'src', 'main.js'));

const BASE = 'http://127.0.0.1:3097';
const MASTER = { sub: 'sub-master', role: 'master', email: 'a@x.com' };
const USER = { sub: 'sub-user', role: 'user', email: 'u@x.com' };

async function pedir(metodo, url, usuario) {
  USUARIO_ACTUAL = usuario;
  const res = await fetch(BASE + url, { method: metodo });
  let body = null;
  try { body = await res.json(); } catch { /* respuesta no-JSON */ }
  return { status: res.status, body };
}

let fallos = 0;
function chequear(desc, ok, detalle) {
  if (ok) { console.log('OK  ' + desc); }
  else { console.log('FAIL ' + desc + (detalle ? ' -> ' + detalle : '')); fallos++; }
}

(async () => {
  // esperar a que levante
  for (let i = 0; i < 50; i++) {
    try { await fetch(BASE + '/api/health'); break; } catch { await new Promise((r) => setTimeout(r, 100)); }
  }

  // ── Visibilidad del listado ───────────────────────────
  let r = await pedir('GET', '/api/empresas', USER);
  chequear('GET /api/empresas devuelve solo las asignadas',
    r.status === 200 && r.body.length === 1 && r.body[0].id === 'e1', JSON.stringify(r));

  r = await pedir('GET', '/api/empresas', MASTER);
  chequear('GET /api/empresas como master devuelve todas',
    r.status === 200 && r.body.length === 2, JSON.stringify(r));

  r = await pedir('GET', '/api/dashboard', USER);
  chequear('GET /api/dashboard filtra por empresa asignada',
    r.status === 200 && r.body.length === 1 && r.body[0].id === 'e1', JSON.stringify(r));

  // ── Empresa ajena: 404 en todas las rutas anidadas ────
  for (const [metodo, url] of [
    ['GET', '/api/empresas/e2'],
    ['GET', '/api/empresas/e2/proyectos'],
    ['POST', '/api/empresas/e2/proyectos'],
    ['GET', '/api/empresas/e2/proyectos/p2/checklist'],
    ['GET', '/api/empresas/e2/proyectos/p2/simulador/resultados'],
    ['GET', '/api/empresas/e2/proyectos/p2/all-resultados'],
    ['POST', '/api/empresas/e2/proyectos/p2/2024/upload'],
  ]) {
    r = await pedir(metodo, url, USER);
    chequear(`${metodo} ${url} sobre empresa ajena -> 404`, r.status === 404, `status ${r.status}`);
  }

  // ── Empresa propia, solo lectura: GET pasa ────────────
  for (const url of [
    '/api/empresas/e1',
    '/api/empresas/e1/proyectos',
    '/api/empresas/e1/proyectos/p1/checklist',
  ]) {
    r = await pedir('GET', url, USER);
    chequear(`GET ${url} con lectura no da 403/404`,
      r.status !== 403 && r.status !== 404, `status ${r.status}`);
  }

  // ── Empresa propia, solo lectura: escrituras 403 ──────
  for (const [metodo, url, mod] of [
    ['PUT', '/api/empresas/e1', 'empresa'],
    ['POST', '/api/empresas/e1/proyectos', 'proyectos'],
    ['PATCH', '/api/empresas/e1/proyectos/p1/expediente', 'proyectos'],
    ['PATCH', '/api/empresas/e1/proyectos/p1/checklist/i1', 'checklist'],
    ['POST', '/api/empresas/e1/proyectos/p1/simulador/subir', 'simulador'],
    ['POST', '/api/empresas/e1/proyectos/p1/2024/upload', 'facturas'],
    ['PUT', '/api/empresas/e1/proyectos/p1/2024', 'facturas'],
  ]) {
    r = await pedir(metodo, url, USER);
    chequear(`${metodo} ${url} sin escritura (${mod}) -> 403`, r.status === 403, `status ${r.status}`);
  }

  // ── Escritura granular: solo checklist ────────────────
  FILAS = [{ usuarioSub: 'sub-user', empresaId: 'e1', escritura: ['checklist'] }];

  r = await pedir('PATCH', '/api/empresas/e1/proyectos/p1/checklist/i1', USER);
  chequear('con escritura de checklist, PATCH checklist pasa el guard',
    r.status !== 403, `status ${r.status}`);

  for (const [metodo, url] of [
    ['POST', '/api/empresas/e1/proyectos/p1/2024/upload'],
    ['POST', '/api/empresas/e1/proyectos', ],
    ['PUT', '/api/empresas/e1'],
    ['POST', '/api/empresas/e1/proyectos/p1/simulador/subir'],
  ]) {
    r = await pedir(metodo, url, USER);
    chequear(`con escritura solo de checklist, ${metodo} ${url} -> 403`, r.status === 403, `status ${r.status}`);
  }

  // ── Exportar Excel es POST pero cuenta como lectura ───
  r = await pedir('POST', '/api/empresas/e1/proyectos/p1/2024/excel', USER);
  chequear('POST .../excel no requiere escritura', r.status !== 403, `status ${r.status}`);

  // ── Alta de empresas: solo admin ──────────────────────
  r = await pedir('POST', '/api/empresas', USER);
  chequear('POST /api/empresas como usuario normal -> 403', r.status === 403, `status ${r.status}`);

  r = await pedir('POST', '/api/empresas', MASTER);
  chequear('POST /api/empresas como master no da 403', r.status !== 403, `status ${r.status}`);

  // ── Admin pasa por todo ───────────────────────────────
  for (const [metodo, url] of [
    ['PUT', '/api/empresas/e2'],
    ['POST', '/api/empresas/e2/proyectos'],
    ['PATCH', '/api/empresas/e2/proyectos/p2/checklist/i1'],
  ]) {
    r = await pedir(metodo, url, MASTER);
    chequear(`master: ${metodo} ${url} no da 403/404`,
      r.status !== 403 && r.status !== 404, `status ${r.status}`);
  }

  // ── Un proyecto de OTRA empresa no se alcanza aunque tengas
  //    acceso a la empresa de la URL (IDOR de proyectoId) ────
  FILAS = [{ usuarioSub: 'sub-user', empresaId: 'e1', escritura: ['facturas', 'proyectos', 'checklist'] }];

  for (const [metodo, url] of [
    ['PUT', '/api/empresas/e1/proyectos/p2/presentacion'],
    ['GET', '/api/empresas/e1/proyectos/p2/all-resultados'],
    ['PATCH', '/api/empresas/e1/proyectos/p2/metadata'],
    ['PATCH', '/api/empresas/e1/proyectos/p2/checklist/i1'],
    ['GET', '/api/empresas/e1/proyectos/p2/checklist'],
    ['GET', '/api/empresas/e1/proyectos/p2/presentacion/analizar'],
    ['POST', '/api/empresas/e1/proyectos/p2/presentacion/excel'],
  ]) {
    r = await pedir(metodo, url, USER);
    chequear(`${metodo} ${url} (proyecto de otra empresa) -> 404`, r.status === 404, `status ${r.status}`);
  }

  // El proyecto propio sigue funcionando igual que antes
  r = await pedir('GET', '/api/empresas/e1/proyectos/p1/all-resultados', USER);
  chequear('GET el proyecto propio no se rompio', r.status !== 404 && r.status !== 403, `status ${r.status}`);

  // Y el master tampoco puede cruzar empresas por error
  r = await pedir('PUT', '/api/empresas/e1/proyectos/p2/presentacion', MASTER);
  chequear('master: proyecto de otra empresa -> 404', r.status === 404, `status ${r.status}`);

  // ── /analizar reescribe la tabla: exige escritura ──────
  FILAS = [{ usuarioSub: 'sub-user', empresaId: 'e1', escritura: [] }];
  r = await pedir('GET', '/api/empresas/e1/proyectos/p1/presentacion/analizar', USER);
  chequear('GET /analizar con solo lectura -> 403 (reescribe la tabla)', r.status === 403, `status ${r.status}`);

  FILAS = [{ usuarioSub: 'sub-user', empresaId: 'e1', escritura: ['facturas'] }];
  r = await pedir('GET', '/api/empresas/e1/proyectos/p1/presentacion/analizar', USER);
  chequear('GET /analizar con escritura no da 403', r.status !== 403, `status ${r.status}`);

  // ── /excel sigue abierto a lectura (no debe romperse) ──
  FILAS = [{ usuarioSub: 'sub-user', empresaId: 'e1', escritura: [] }];
  r = await pedir('POST', '/api/empresas/e1/proyectos/p1/presentacion/excel', USER);
  chequear('POST /excel con solo lectura sigue permitido', r.status !== 403, `status ${r.status}`);

  // ── /api/admin sigue siendo solo admin ────────────────
  r = await pedir('GET', '/api/admin/modulos', USER);
  chequear('GET /api/admin/modulos como usuario normal -> 403', r.status === 403, `status ${r.status}`);
  r = await pedir('GET', '/api/admin/modulos', MASTER);
  chequear('GET /api/admin/modulos como master -> 200',
    r.status === 200 && Array.isArray(r.body) && r.body.length === 5, JSON.stringify(r));

  console.log(fallos === 0 ? '\nTODOS LOS TESTS DE RUTAS PASARON' : `\n${fallos} FALLARON`);
  process.exit(fallos === 0 ? 0 : 1);
})();
