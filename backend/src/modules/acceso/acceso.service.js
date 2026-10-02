const prisma = require('../../config/prisma');
const {
  MODULO_IDS,
  normalizarEscritura,
  accesoTotal,
  sinAcceso,
} = require('../../common/constants/permisos');

/**
 * Resuelve qué puede hacer un usuario sobre una empresa concreta.
 * Los administradores no tienen filas en UsuarioEmpresa: acceden por su rol.
 *
 * @param {{ sub: string, role: string }} user
 * @param {string} empresaId
 * @returns {Promise<{ lectura: boolean, escritura: string[], esAdmin: boolean }>}
 */
async function getAcceso(user, empresaId) {
  if (user?.role === 'master') return accesoTotal();
  if (!user?.sub || !empresaId) return sinAcceso();

  const fila = await prisma.usuarioEmpresa.findUnique({
    where: { usuarioSub_empresaId: { usuarioSub: user.sub, empresaId } },
    select: { escritura: true },
  });
  if (!fila) return sinAcceso();

  // Un admin de empresa tiene control total sobre las empresas que administra.
  // No tendría sentido que reparta permisos de escritura que él mismo no tiene,
  // así que la columna `escritura` se ignora para este rol: la fila sólo define
  // QUÉ empresas administra. Si más adelante lo degradan a usuario normal,
  // vuelve a regir lo que haya guardado ahí (vacío = sólo lectura).
  if (user.role === 'admin_empresa') {
    return { lectura: true, escritura: [...MODULO_IDS], esAdmin: false };
  }

  return { lectura: true, escritura: fila.escritura || [], esAdmin: false };
}

/**
 * IDs de las empresas que el usuario puede ver.
 * Devuelve null para administradores, que ven todas (el caller no filtra).
 *
 * @param {{ sub: string, role: string }} user
 * @returns {Promise<string[]|null>}
 */
async function getEmpresasVisibles(user) {
  if (user?.role === 'master') return null;
  if (!user?.sub) return [];

  const filas = await prisma.usuarioEmpresa.findMany({
    where: { usuarioSub: user.sub },
    select: { empresaId: true },
  });
  return filas.map((f) => f.empresaId);
}

/** Todos los accesos de un usuario, para mostrarlos en el panel. */
async function listarAccesosDeUsuario(usuarioSub) {
  const filas = await prisma.usuarioEmpresa.findMany({
    where: { usuarioSub },
    select: { empresaId: true, escritura: true },
  });
  return filas.map((f) => ({ empresaId: f.empresaId, escritura: f.escritura || [] }));
}

/**
 * Empresas sobre las que el usuario puede ADMINISTRAR a otros usuarios.
 * - master: null (todas)
 * - admin_empresa: las empresas que le asignaron
 * - usuario normal: [] (no administra nada)
 *
 * @param {{ sub: string, role: string }} user
 * @returns {Promise<string[]|null>}
 */
async function getEmpresasAdministradas(user) {
  if (user?.role === 'master') return null;
  if (user?.role !== 'admin_empresa') return [];
  return getEmpresasVisibles(user);
}

/** `sub` de los usuarios que tienen acceso a alguna de esas empresas. */
async function getSubsConAccesoA(empresaIds) {
  if (!Array.isArray(empresaIds) || empresaIds.length === 0) return new Set();
  const filas = await prisma.usuarioEmpresa.findMany({
    where: { empresaId: { in: empresaIds } },
    select: { usuarioSub: true },
  });
  return new Set(filas.map((f) => f.usuarioSub));
}

/**
 * Reemplaza los accesos de un usuario.
 *
 * `ambito` acota qué empresas puede tocar quien edita:
 * - `null` (master): reemplazo total.
 * - lista de ids (admin de empresa): sólo se reescriben esas empresas. Lo que
 *   el usuario tenga en empresas fuera del ámbito queda intacto — un admin de
 *   empresa no puede quitarle ni darle acceso a empresas que no administra.
 *
 * Todo va en una transacción para no dejar permisos a medio aplicar.
 *
 * @param {string} usuarioSub
 * @param {Array<{ empresaId: string, escritura?: string[] }>} accesos
 * @param {string[]|null} [ambito]
 */
async function reemplazarAccesos(usuarioSub, accesos, ambito = null) {
  if (!Array.isArray(accesos)) {
    const err = new Error('Se esperaba una lista de accesos');
    err.status = 400;
    throw err;
  }

  // Deduplicamos por empresa quedándonos con la última aparición
  const porEmpresa = new Map();
  for (const a of accesos) {
    if (!a?.empresaId) continue;
    porEmpresa.set(a.empresaId, normalizarEscritura(a.escritura));
  }

  if (ambito !== null) {
    const permitidas = new Set(ambito);
    const fuera = [...porEmpresa.keys()].filter((id) => !permitidas.has(id));
    if (fuera.length > 0) {
      const err = new Error(
        `No administrás estas empresas: ${fuera.join(', ')}`
      );
      err.status = 403;
      throw err;
    }
  }

  const ids = [...porEmpresa.keys()];
  if (ids.length > 0) {
    const existentes = await prisma.empresa.findMany({
      where: { id: { in: ids } },
      select: { id: true },
    });
    if (existentes.length !== ids.length) {
      const encontradas = new Set(existentes.map((e) => e.id));
      const faltantes = ids.filter((id) => !encontradas.has(id));
      const err = new Error(`Empresas inexistentes: ${faltantes.join(', ')}`);
      err.status = 400;
      throw err;
    }
  }

  // Master borra todo y reescribe; admin de empresa sólo borra lo suyo.
  const borrado =
    ambito === null
      ? prisma.usuarioEmpresa.deleteMany({ where: { usuarioSub } })
      : prisma.usuarioEmpresa.deleteMany({
          where: { usuarioSub, empresaId: { in: ambito } },
        });

  await prisma.$transaction([
    borrado,
    ...[...porEmpresa.entries()].map(([empresaId, escritura]) =>
      prisma.usuarioEmpresa.create({ data: { usuarioSub, empresaId, escritura } })
    ),
  ]);

  return listarAccesosDeUsuario(usuarioSub);
}

/** Borra los accesos de un usuario (al eliminarlo de Cognito). */
async function borrarAccesosDeUsuario(usuarioSub) {
  if (!usuarioSub) return;
  await prisma.usuarioEmpresa.deleteMany({ where: { usuarioSub } });
}

module.exports = {
  getAcceso,
  getEmpresasVisibles,
  getEmpresasAdministradas,
  getSubsConAccesoA,
  listarAccesosDeUsuario,
  reemplazarAccesos,
  borrarAccesosDeUsuario,
};
