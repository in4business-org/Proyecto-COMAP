const {
  ListUsersCommand,
  ListUsersInGroupCommand,
  AdminCreateUserCommand,
  AdminDeleteUserCommand,
  AdminDisableUserCommand,
  AdminEnableUserCommand,
  AdminGetUserCommand,
  AdminAddUserToGroupCommand,
  AdminRemoveUserFromGroupCommand,
  AdminSetUserPasswordCommand,
} = require('@aws-sdk/client-cognito-identity-provider');

const {
  cognito,
  USER_POOL_ID,
  GROUP_MASTER,
  GROUP_ADMIN_EMPRESA,
  GROUP_USER,
  ROLES,
  groupForRole,
} = require('../../config/cognito.config');
const crypto = require('crypto');
const accesoService = require('../acceso/acceso.service');

// ── Helpers ────────────────────────────────────────────────

function attr(attributes, name) {
  return (attributes || []).find((a) => a.Name === name)?.Value || null;
}

/**
 * @param {object} u usuario de Cognito
 * @param {Map<string,string>} rolPorUsername username -> rol
 */
function mapUser(u, rolPorUsername) {
  const attributes = u.Attributes || u.UserAttributes || [];
  return {
    username: u.Username,
    sub: attr(attributes, 'sub'),
    email: attr(attributes, 'email'),
    nombre: attr(attributes, 'name'),
    habilitado: u.Enabled !== false,
    // CONFIRMED | FORCE_CHANGE_PASSWORD | RESET_REQUIRED | ...
    estado: u.UserStatus,
    rol: rolPorUsername.get(u.Username) || 'user',
    creado: u.UserCreateDate,
    actualizado: u.UserLastModifiedDate,
  };
}

/** Usernames de un grupo (paginado). */
async function usernamesDeGrupo(GroupName) {
  const usernames = [];
  let NextToken;
  do {
    const res = await cognito.send(
      new ListUsersInGroupCommand({ UserPoolId: USER_POOL_ID, GroupName, Limit: 60, NextToken })
    );
    for (const u of res.Users || []) usernames.push(u.Username);
    NextToken = res.NextToken;
  } while (NextToken);
  return usernames;
}

/**
 * Mapa username -> rol, con dos llamadas en total (no una por usuario).
 * `master` pisa a `admin_empresa` si alguien estuviera en ambos grupos.
 */
async function getRolPorUsername() {
  const [masters, adminsEmpresa] = await Promise.all([
    usernamesDeGrupo(GROUP_MASTER),
    usernamesDeGrupo(GROUP_ADMIN_EMPRESA).catch(() => []),
  ]);
  const mapa = new Map();
  for (const u of adminsEmpresa) mapa.set(u, 'admin_empresa');
  for (const u of masters) mapa.set(u, 'master');
  return mapa;
}

/**
 * Contraseña temporal que cumple la política por defecto de Cognito
 * (8+ caracteres, mayúscula, minúscula, número y símbolo).
 */
function generarPasswordTemporal() {
  const mayus = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
  const minus = 'abcdefghijkmnopqrstuvwxyz';
  const nums = '23456789';
  const simb = '!@#$%*?-_';
  const todos = mayus + minus + nums + simb;
  // crypto.randomInt y no Math.random: estas contrasenas son credenciales y
  // el PRNG de V8 no es criptografico (su estado se reconstruye observando
  // suficientes salidas, que un admin obtiene creando usuarios).
  const pick = (set) => set[crypto.randomInt(set.length)];

  const chars = [pick(mayus), pick(minus), pick(nums), pick(simb)];
  while (chars.length < 14) chars.push(pick(todos));
  // Fisher-Yates para que los obligatorios no queden siempre al principio
  for (let i = chars.length - 1; i > 0; i--) {
    const j = crypto.randomInt(i + 1);
    [chars[i], chars[j]] = [chars[j], chars[i]];
  }
  return chars.join('');
}

function httpError(status, message) {
  const err = new Error(message);
  err.status = status;
  return err;
}

/**
 * Evita que un admin se dispare en el pie (quitarse el rol, deshabilitarse
 * o borrarse a sí mismo y dejar la app sin administradores accesibles).
 * Compara por `sub`, que es estable sin importar cómo esté configurado el
 * username del User Pool.
 */
async function assertNoEsUnoMismo(username, actor, accion) {
  const target = await getUsuario(username);
  if (target.sub && actor?.sub && target.sub === actor.sub) {
    throw httpError(400, `No podés ${accion} tu propia cuenta.`);
  }
  return target;
}

async function getUsuario(username) {
  let res;
  try {
    res = await cognito.send(
      new AdminGetUserCommand({ UserPoolId: USER_POOL_ID, Username: username })
    );
  } catch (err) {
    // Que no exista y que exista pero este fuera de alcance tienen que ser
    // indistinguibles: si no, un admin de empresa puede sondear que cuentas
    // existen en empresas que no administra.
    if (err.name === 'UserNotFoundException') throw httpError(404, 'Usuario no encontrado');
    throw err;
  }
  return mapUser(res, await getRolPorUsername());
}

// ── Alcance de un admin de empresa ─────────────────────────

/**
 * Verifica que `actor` pueda administrar a `target` y devuelve el ámbito.
 *
 * Un master administra a cualquiera (ámbito null = todas las empresas).
 * Un admin de empresa sólo puede tocar usuarios con rol `user` que tengan
 * acceso a alguna de SUS empresas; nunca a un master ni a otro admin de
 * empresa, que es lo que cierra la vía de escalada.
 *
 * @returns {Promise<string[]|null>} ámbito de empresas del actor
 */
async function assertPuedeGestionar(actor, target) {
  const ambito = await accesoService.getEmpresasAdministradas(actor);
  if (ambito === null) return null; // master

  if (target.rol !== 'user') {
    throw httpError(403, 'Sólo un administrador general puede gestionar a otros administradores.');
  }
  const accesos = await accesoService.listarAccesosDeUsuario(target.sub);
  const comparte = accesos.some((a) => ambito.includes(a.empresaId));
  if (!comparte) {
    // Mismo criterio que con las empresas: 404 para no confirmar que existe
    throw httpError(404, 'Usuario no encontrado');
  }
  return ambito;
}

// ── Operaciones ────────────────────────────────────────────

/**
 * Lista los usuarios que el actor puede ver.
 * El master ve todo el User Pool. Un admin de empresa ve sólo a quienes tienen
 * acceso a alguna de sus empresas, y nunca a los masters.
 */
async function listarUsuarios(actor) {
  const rolPorUsername = await getRolPorUsername();

  const usuarios = [];
  let PaginationToken;
  do {
    const res = await cognito.send(
      new ListUsersCommand({ UserPoolId: USER_POOL_ID, Limit: 60, PaginationToken })
    );
    for (const u of res.Users || []) usuarios.push(mapUser(u, rolPorUsername));
    PaginationToken = res.PaginationToken;
  } while (PaginationToken);

  const ambito = await accesoService.getEmpresasAdministradas(actor);
  let visibles = usuarios;
  if (ambito !== null) {
    const subsEnAmbito = await accesoService.getSubsConAccesoA(ambito);
    visibles = usuarios.filter(
      (u) => u.rol !== 'master' && u.sub && subsEnAmbito.has(u.sub)
    );
  }

  return visibles.sort((a, b) => (a.email || '').localeCompare(b.email || ''));
}

/**
 * Crea un usuario en Cognito y lo asigna a su grupo.
 * Cognito le manda un mail con la contraseña temporal; en el primer login
 * la pantalla de Login pide la contraseña definitiva
 * (CONFIRM_SIGN_IN_WITH_NEW_PASSWORD_REQUIRED).
 *
 * Un admin de empresa sólo puede crear usuarios normales, y los permisos que
 * les asigne quedan acotados a sus empresas.
 */
async function crearUsuario({ email, nombre, rol = 'user', enviarMail = true, accesos }, actor) {
  if (!email) throw httpError(400, 'El email es obligatorio');
  if (!ROLES.includes(rol)) throw httpError(400, `Rol inválido: ${rol}`);

  const ambito = await accesoService.getEmpresasAdministradas(actor);
  if (ambito !== null) {
    if (rol !== 'user') {
      throw httpError(403, 'Sólo un administrador general puede crear administradores.');
    }
    // Sin empresas asignadas el usuario quedaría fuera del ámbito de quien lo
    // crea, que después no podría ni verlo. Mejor fallar acá que dejarlo huérfano.
    if (!Array.isArray(accesos) || accesos.length === 0) {
      throw httpError(400, 'Asignale al menos una empresa al usuario que estás creando.');
    }
  }

  const emailNormalizado = String(email).trim().toLowerCase();
  const passwordTemporal = generarPasswordTemporal();

  let creado;
  try {
    const res = await cognito.send(
      new AdminCreateUserCommand({
        UserPoolId: USER_POOL_ID,
        Username: emailNormalizado,
        TemporaryPassword: passwordTemporal,
        UserAttributes: [
          { Name: 'email', Value: emailNormalizado },
          { Name: 'email_verified', Value: 'true' },
          ...(nombre ? [{ Name: 'name', Value: nombre }] : []),
        ],
        DesiredDeliveryMediums: ['EMAIL'],
        // SUPPRESS = no mandar mail (el admin le pasa la contraseña a mano)
        ...(enviarMail ? {} : { MessageAction: 'SUPPRESS' }),
      })
    );
    creado = res.User;
  } catch (err) {
    if (err.name === 'UsernameExistsException') {
      throw httpError(409, 'Ya existe un usuario con ese email');
    }
    if (err.name === 'InvalidParameterException') {
      throw httpError(400, err.message);
    }
    throw err;
  }

  await asignarGrupo(creado.Username, rol);

  // Permisos iniciales. Para un admin de empresa es lo que lo hace visible en
  // su propio listado: sin accesos, el usuario recién creado le desaparecería.
  const sub = attr(creado.Attributes || [], 'sub');
  if (Array.isArray(accesos) && accesos.length > 0 && sub) {
    await accesoService.reemplazarAccesos(sub, accesos, ambito);
  }

  const mapa = new Map([[creado.Username, rol]]);
  return {
    usuario: mapUser(creado, mapa),
    // Sólo se devuelve para que el admin pueda pasarla por otro canal
    // cuando eligió no mandar el mail. Nunca se persiste.
    passwordTemporal: enviarMail ? null : passwordTemporal,
  };
}

/** Pone al usuario en el grupo de su rol y lo saca de los otros dos. */
async function asignarGrupo(username, rol) {
  const destino = groupForRole(rol);
  const aQuitar = [GROUP_MASTER, GROUP_ADMIN_EMPRESA, GROUP_USER].filter((g) => g !== destino);

  // Primero quitamos y después agregamos: si la segunda parte falla, el usuario
  // queda sin grupo (= usuario normal) en vez de conservar permisos de más.
  // Sacar a alguien de un grupo al que no pertenece es idempotente en Cognito.
  for (const grupo of aQuitar) {
    await cognito.send(
      new AdminRemoveUserFromGroupCommand({
        UserPoolId: USER_POOL_ID,
        Username: username,
        GroupName: grupo,
      })
    );
  }
  await cognito.send(
    new AdminAddUserToGroupCommand({
      UserPoolId: USER_POOL_ID,
      Username: username,
      GroupName: destino,
    })
  );
}

/** Cambiar roles es exclusivo del master (lo valida también la ruta). */
async function cambiarRol(username, rol, actor) {
  if (!ROLES.includes(rol)) throw httpError(400, `Rol inválido: ${rol}`);
  await assertNoEsUnoMismo(username, actor, 'cambiar el rol de');
  await asignarGrupo(username, rol);
  return getUsuario(username);
}

async function cambiarEstado(username, habilitado, actor) {
  if (!habilitado) await assertNoEsUnoMismo(username, actor, 'deshabilitar');

  await cognito.send(
    habilitado
      ? new AdminEnableUserCommand({ UserPoolId: USER_POOL_ID, Username: username })
      : new AdminDisableUserCommand({ UserPoolId: USER_POOL_ID, Username: username })
  );
  return getUsuario(username);
}

/**
 * Fija una contraseña temporal nueva. El usuario queda en
 * FORCE_CHANGE_PASSWORD y define la definitiva en el próximo login.
 *
 * Un admin de empresa sólo puede resetear a usuarios que estén completamente
 * dentro de su ámbito: si la persona además pertenece a otra empresa, el reset
 * le cortaría el acceso a algo que este admin no administra.
 */
async function resetearPassword(username, actor) {
  const target = await getUsuario(username);
  const ambito = await assertPuedeGestionar(actor, target);

  if (ambito !== null) {
    const accesos = await accesoService.listarAccesosDeUsuario(target.sub);
    const afuera = accesos.filter((a) => !ambito.includes(a.empresaId));
    if (afuera.length > 0) {
      throw httpError(
        403,
        'Este usuario también pertenece a empresas que no administrás. Pedile el reset a un administrador general.'
      );
    }
  }

  const passwordTemporal = generarPasswordTemporal();
  await cognito.send(
    new AdminSetUserPasswordCommand({
      UserPoolId: USER_POOL_ID,
      Username: username,
      Password: passwordTemporal,
      Permanent: false,
    })
  );
  return { passwordTemporal };
}

async function eliminarUsuario(username, actor) {
  const target = await assertNoEsUnoMismo(username, actor, 'eliminar');
  await cognito.send(
    new AdminDeleteUserCommand({ UserPoolId: USER_POOL_ID, Username: username })
  );
  // Los permisos por empresa viven en Postgres: si no los borramos quedan
  // huerfanos y revivirian si Cognito reasignara el mismo sub.
  await accesoService.borrarAccesosDeUsuario(target.sub);
  return { ok: true };
}

module.exports = {
  listarUsuarios,
  getUsuario,
  crearUsuario,
  cambiarRol,
  cambiarEstado,
  resetearPassword,
  eliminarUsuario,
  assertPuedeGestionar,
};
