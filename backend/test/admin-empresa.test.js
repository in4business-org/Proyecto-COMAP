// Tests del nivel "admin de empresa": que pueda gestionar dentro de sus
// empresas y que no tenga ninguna via para escalar fuera de ellas.
// Mockea Cognito y Prisma: no toca AWS ni la base.
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
if (!process.env.COGNITO_USER_POOL_ID) process.env.COGNITO_USER_POOL_ID = 'us-east-1_TEST';
if (!process.env.COGNITO_CLIENT_ID) process.env.COGNITO_CLIENT_ID = 'testclient';

const assert = require('assert');
const path = require('path');
const Module = require('module');

const BE = path.join(__dirname, '..');

// ── Estado simulado ─────────────────────────────────────────
// e1 y e2 las administra el admin de empresa; e3 es ajena.
const EMPRESAS = [{ id: 'e1' }, { id: 'e2' }, { id: 'e3' }];
let FILAS = [];

const prismaStub = {
  usuarioEmpresa: {
    findUnique: async ({ where }) => {
      const { usuarioSub, empresaId } = where.usuarioSub_empresaId;
      return FILAS.find((f) => f.usuarioSub === usuarioSub && f.empresaId === empresaId) || null;
    },
    findMany: async ({ where }) => {
      let out = FILAS;
      if (where?.usuarioSub) out = out.filter((f) => f.usuarioSub === where.usuarioSub);
      if (where?.empresaId?.in) out = out.filter((f) => where.empresaId.in.includes(f.empresaId));
      return out.map((f) => ({ ...f }));
    },
    deleteMany: async ({ where }) => {
      const antes = FILAS.length;
      FILAS = FILAS.filter((f) => {
        const mismoUser = f.usuarioSub === where.usuarioSub;
        const enLista = where.empresaId?.in ? where.empresaId.in.includes(f.empresaId) : true;
        return !(mismoUser && enLista);
      });
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
  $transaction: async (ops) => { const out = []; for (const op of ops) out.push(await op); return out; },
};

// ── Cognito simulado ────────────────────────────────────────
const GRUPOS = { admins: ['u-master'], admins_empresa: ['u-adminemp'], usuarios: ['u-ana', 'u-beto', 'u-ajeno'] };
const POOL = {
  'u-master':   { sub: 'sub-master',   email: 'master@x.com' },
  'u-adminemp': { sub: 'sub-adminemp', email: 'adminemp@x.com' },
  'u-ana':      { sub: 'sub-ana',      email: 'ana@x.com' },
  'u-beto':     { sub: 'sub-beto',     email: 'beto@x.com' },
  'u-ajeno':    { sub: 'sub-ajeno',    email: 'ajeno@x.com' },
};
const creados = [];

function cognitoUser(username) {
  const u = POOL[username];
  return {
    Username: username,
    Enabled: true,
    UserStatus: 'CONFIRMED',
    UserCreateDate: new Date(),
    Attributes: [{ Name: 'sub', Value: u.sub }, { Name: 'email', Value: u.email }],
  };
}

const origLoad = Module._load;
Module._load = function (request) {
  if (request.endsWith('config/prisma')) return prismaStub;
  return origLoad.apply(this, arguments);
};

const cfg = require(path.join(BE, 'src/config/cognito.config'));
cfg.cognito.send = async (cmd) => {
  const name = cmd.constructor.name;
  const i = cmd.input;
  switch (name) {
    case 'ListUsersInGroupCommand':
      return { Users: (GRUPOS[i.GroupName] || []).map(cognitoUser) };
    case 'ListUsersCommand':
      return { Users: Object.keys(POOL).map(cognitoUser) };
    case 'AdminGetUserCommand': {
      const u = POOL[i.Username];
      if (!u) { const e = new Error('no existe'); e.name = 'UserNotFoundException'; throw e; }
      const c = cognitoUser(i.Username);
      return { ...c, UserAttributes: c.Attributes };
    }
    case 'AdminCreateUserCommand': {
      const username = 'u-' + i.Username;
      POOL[username] = { sub: 'sub-' + i.Username, email: i.Username };
      GRUPOS.usuarios.push(username);
      creados.push(i.Username);
      return { User: cognitoUser(username) };
    }
    case 'AdminAddUserToGroupCommand':
    case 'AdminRemoveUserFromGroupCommand':
    case 'AdminSetUserPasswordCommand':
    case 'AdminDeleteUserCommand':
      return {};
    default:
      throw new Error('comando no stubbeado: ' + name);
  }
};

const admin = require(path.join(BE, 'src/modules/admin/admin.service'));
const acceso = require(path.join(BE, 'src/modules/acceso/acceso.service'));
const { requireMaster, requirePanel } = require(path.join(BE, 'src/middleware/auth.middleware'));

const MASTER = { sub: 'sub-master', role: 'master' };
const ADMIN_EMP = { sub: 'sub-adminemp', role: 'admin_empresa' };
const USER = { sub: 'sub-ana', role: 'user' };

function mw(guard, user) {
  let status, nexted = false;
  const res = { status(s) { status = s; return this; }, json() { return this; } };
  guard({ method: 'GET', user }, res, () => { nexted = true; });
  return { status, nexted };
}

function reset() {
  FILAS = [
    // el admin de empresa administra e1 y e2
    { usuarioSub: 'sub-adminemp', empresaId: 'e1', escritura: [] },
    { usuarioSub: 'sub-adminemp', empresaId: 'e2', escritura: [] },
    // ana esta dentro de su ambito
    { usuarioSub: 'sub-ana', empresaId: 'e1', escritura: ['checklist'] },
    // beto esta a caballo: e1 (de el) y e3 (ajena)
    { usuarioSub: 'sub-beto', empresaId: 'e1', escritura: [] },
    { usuarioSub: 'sub-beto', empresaId: 'e3', escritura: ['facturas'] },
    // ajeno esta solo en e3
    { usuarioSub: 'sub-ajeno', empresaId: 'e3', escritura: [] },
  ];
}

(async () => {
  reset();

  // ── 1. Guards ──────────────────────────────────────────
  assert.equal(mw(requireMaster, MASTER).nexted, true);
  assert.equal(mw(requireMaster, ADMIN_EMP).status, 403, 'admin de empresa no es master');
  assert.equal(mw(requireMaster, USER).status, 403);
  assert.equal(mw(requirePanel, MASTER).nexted, true);
  assert.equal(mw(requirePanel, ADMIN_EMP).nexted, true, 'admin de empresa entra al panel');
  assert.equal(mw(requirePanel, USER).status, 403, 'usuario normal no entra al panel');
  console.log('OK guards: requireMaster vs requirePanel');

  // ── 2. Ambito ──────────────────────────────────────────
  assert.equal(await acceso.getEmpresasAdministradas(MASTER), null, 'master administra todo');
  assert.deepEqual((await acceso.getEmpresasAdministradas(ADMIN_EMP)).sort(), ['e1', 'e2']);
  assert.deepEqual(await acceso.getEmpresasAdministradas(USER), [], 'usuario normal no administra');
  console.log('OK ambito de administracion por rol');

  // ── 3. Listado recortado ───────────────────────────────
  const todos = await admin.listarUsuarios(MASTER);
  assert.equal(todos.length, 5, 'master ve todo el pool');

  const visibles = await admin.listarUsuarios(ADMIN_EMP);
  const emails = visibles.map((u) => u.email).sort();
  assert.ok(emails.includes('ana@x.com'), 've a ana (e1)');
  assert.ok(emails.includes('beto@x.com'), 've a beto (e1)');
  assert.ok(!emails.includes('ajeno@x.com'), 'NO ve a quien solo esta en e3');
  assert.ok(!emails.includes('master@x.com'), 'NUNCA ve a un master');
  console.log('OK listado recortado al ambito (' + emails.join(', ') + ')');

  // ── 4. El master sigue viendo los roles bien ───────────
  assert.equal(todos.find((u) => u.email === 'master@x.com').rol, 'master');
  assert.equal(todos.find((u) => u.email === 'adminemp@x.com').rol, 'admin_empresa');
  assert.equal(todos.find((u) => u.email === 'ana@x.com').rol, 'user');
  console.log('OK los tres roles se resuelven desde los grupos');

  // ── 5. No puede escalar creando administradores ────────
  for (const rol of ['master', 'admin_empresa']) {
    await assert.rejects(
      () => admin.crearUsuario({ email: `nuevo-${rol}@x.com`, rol, accesos: [{ empresaId: 'e1' }] }, ADMIN_EMP),
      (e) => e.status === 403, `no deberia poder crear un ${rol}`);
  }
  console.log('OK no puede crear administradores');

  // ── 6. Crear sin empresas falla (quedaria huerfano) ────
  await assert.rejects(
    () => admin.crearUsuario({ email: 'huerfano@x.com' }, ADMIN_EMP),
    (e) => e.status === 400);
  console.log('OK exige asignar al menos una empresa al crear');

  // ── 7. No puede asignar empresas fuera de su ambito ────
  await assert.rejects(
    () => admin.crearUsuario({ email: 'colado@x.com', accesos: [{ empresaId: 'e3' }] }, ADMIN_EMP),
    (e) => e.status === 403);
  console.log('OK no puede asignar una empresa ajena al crear');

  // ── 8. Crear bien ──────────────────────────────────────
  const { usuario } = await admin.crearUsuario(
    { email: 'nuevo@x.com', accesos: [{ empresaId: 'e1', escritura: ['facturas'] }] }, ADMIN_EMP);
  assert.equal(usuario.rol, 'user');
  const accesosNuevo = await acceso.listarAccesosDeUsuario('sub-nuevo@x.com');
  assert.deepEqual(accesosNuevo, [{ empresaId: 'e1', escritura: ['facturas'] }]);
  console.log('OK crea usuario normal con permisos dentro de su ambito');

  // ── 9. No puede gestionar usuarios fuera del ambito ────
  const ajeno = await admin.getUsuario('u-ajeno');
  await assert.rejects(() => admin.assertPuedeGestionar(ADMIN_EMP, ajeno), (e) => e.status === 404,
    'un usuario de otra empresa deberia ser invisible (404)');
  const master = await admin.getUsuario('u-master');
  await assert.rejects(() => admin.assertPuedeGestionar(ADMIN_EMP, master), (e) => e.status === 403,
    'no deberia poder gestionar a un master');
  const otroAdmin = await admin.getUsuario('u-adminemp');
  await assert.rejects(() => admin.assertPuedeGestionar(ADMIN_EMP, otroAdmin), (e) => e.status === 403,
    'no deberia poder gestionar a otro admin de empresa');
  console.log('OK no gestiona usuarios fuera del ambito ni a otros admins');

  // ── 10. Reemplazo PARCIAL: respeta empresas ajenas ─────
  reset();
  const ambito = ['e1', 'e2'];
  await acceso.reemplazarAccesos('sub-beto', [{ empresaId: 'e2', escritura: ['checklist'] }], ambito);
  const deBeto = await acceso.listarAccesosDeUsuario('sub-beto');
  const porEmp = Object.fromEntries(deBeto.map((a) => [a.empresaId, a.escritura]));
  assert.ok(!porEmp.e1, 'e1 se fue porque estaba en el ambito y no vino en la lista');
  assert.deepEqual(porEmp.e2, ['checklist'], 'e2 se escribio');
  assert.deepEqual(porEmp.e3, ['facturas'], 'e3 quedo INTACTA: no la administra');
  console.log('OK reemplazo parcial deja intactas las empresas ajenas');

  // ── 11. Rechaza empresas fuera del ambito ──────────────
  await assert.rejects(
    () => acceso.reemplazarAccesos('sub-ana', [{ empresaId: 'e3' }], ambito),
    (e) => e.status === 403);
  console.log('OK rechaza asignar empresas fuera del ambito');

  // ── 12. El master reemplaza todo ───────────────────────
  reset();
  await acceso.reemplazarAccesos('sub-beto', [{ empresaId: 'e3', escritura: [] }], null);
  assert.deepEqual((await acceso.listarAccesosDeUsuario('sub-beto')).map((a) => a.empresaId), ['e3'],
    'el master si puede barrer todo');
  console.log('OK el master hace reemplazo total');

  // ── 13. Reset de password a caballo entre empresas ─────
  reset();
  await assert.rejects(
    () => admin.resetearPassword('u-beto', ADMIN_EMP),
    (e) => e.status === 403,
    'beto tambien esta en e3: no deberia poder resetearlo');
  const r = await admin.resetearPassword('u-ana', ADMIN_EMP);
  assert.ok(r.passwordTemporal, 'ana esta enteramente en su ambito');
  const rm = await admin.resetearPassword('u-beto', MASTER);
  assert.ok(rm.passwordTemporal, 'el master puede siempre');
  console.log('OK reset de password acotado al ambito');

  // ── 14. Control total sobre las empresas que administra ──
  reset();
  const { MODULO_IDS } = require(path.join(BE, 'src/common/constants/permisos'));

  // Sus filas tienen escritura: [] y aun asi debe poder escribir todo
  const enE1 = await acceso.getAcceso(ADMIN_EMP, 'e1');
  assert.equal(enE1.lectura, true);
  assert.deepEqual(enE1.escritura, MODULO_IDS,
    'un admin de empresa debe tener escritura total en las empresas que administra');

  // Pero solo en las suyas
  const enE3 = await acceso.getAcceso(ADMIN_EMP, 'e3');
  assert.equal(enE3.lectura, false, 'no administra e3: no deberia ni verla');
  console.log('OK admin de empresa: control total en las suyas, nada en las ajenas');

  // ── 15. Un usuario normal NO hereda eso ────────────────
  const anaEnE1 = await acceso.getAcceso({ sub: 'sub-ana', role: 'user' }, 'e1');
  assert.deepEqual(anaEnE1.escritura, ['checklist'],
    'a un usuario normal le sigue rigiendo su lista de modulos');
  const soloLectura = await acceso.getAcceso({ sub: 'sub-ajeno', role: 'user' }, 'e3');
  assert.deepEqual(soloLectura.escritura, [], 'escritura vacia sigue siendo solo lectura');
  console.log('OK el detalle por modulo sigue rigiendo para usuarios normales');

  // ── 16. Si lo degradan, vuelve a regir lo guardado ─────
  const degradado = await acceso.getAcceso({ sub: 'sub-adminemp', role: 'user' }, 'e1');
  assert.deepEqual(degradado.escritura, [],
    'degradado a usuario normal cae a lo que haya guardado (vacio = solo lectura)');
  console.log('OK al degradarlo pierde el control total (falla cerrada)');

  // ── 17. El master no pierde nada ───────────────────────
  reset();
  const anaMaster = await admin.getUsuario('u-ana');
  assert.equal(await admin.assertPuedeGestionar(MASTER, anaMaster), null);
  console.log('OK el master gestiona a cualquiera');

  console.log('\nTODOS LOS TESTS DE ADMIN DE EMPRESA PASARON');
})().catch((e) => { console.error('\nFALLO:', e.message); process.exit(1); });
