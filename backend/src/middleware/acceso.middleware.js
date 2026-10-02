const prisma = require('../config/prisma');
const accesoService = require('../modules/acceso/acceso.service');
const { puedeEscribir } = require('../common/constants/permisos');

const METODOS_LECTURA = new Set(['GET', 'HEAD', 'OPTIONS']);

/**
 * Resuelve el acceso del usuario a `req.params.empresaId` y lo deja en
 * `req.acceso`. Corta con 404 si no tiene ni lectura.
 *
 * Devolvemos 404 y no 403 a propósito: a un usuario sin acceso la empresa no
 * debería ni existir, y un 403 le confirmaría que ese id es válido.
 *
 * Se monta una sola vez sobre '/api/empresas/:empresaId', que es el prefijo de
 * TODAS las rutas con alcance de empresa (proyectos, facturas, checklist y
 * simulador cuelgan de ahí), así que no hay forma de saltearlo.
 */
const cargarAcceso = async (req, res, next) => {
  if (req.method === 'OPTIONS') return next();

  try {
    const { empresaId } = req.params;
    if (!empresaId) return next();

    req.acceso = await accesoService.getAcceso(req.user, empresaId);
    if (!req.acceso.lectura) {
      return res.status(404).json({ error: 'Empresa no encontrada' });
    }
    next();
  } catch (error) {
    console.error('Error resolviendo acceso a la empresa:', error);
    res.status(500).json({ error: 'Error interno al verificar permisos' });
  }
};

/**
 * Verifica que `:proyectoId` pertenezca realmente a `:empresaId`.
 *
 * Sin esto, `cargarAcceso` sólo valida la empresa de la URL mientras que todas
 * las consultas se hacen por `proyectoId`: el `empresaId` quedaría siendo un
 * simple ticket de permiso y alcanzaría con tener acceso a CUALQUIER empresa
 * para leer o escribir el proyecto de otra.
 *
 * Para un usuario legítimo esto no cambia nada: el proyecto que pide siempre
 * cuelga de la empresa que pide. Devolvemos 404, igual que cargarAcceso, para
 * no confirmar que ese id exista en otro lado.
 */
const cargarProyecto = async (req, res, next) => {
  if (req.method === 'OPTIONS') return next();

  try {
    const { empresaId, proyectoId } = req.params;
    if (!empresaId || !proyectoId) return next();

    const proyecto = await prisma.proyecto.findFirst({
      where: { id: proyectoId, empresaId },
      select: { id: true },
    });
    if (!proyecto) {
      return res.status(404).json({ error: 'Proyecto no encontrado' });
    }
    next();
  } catch (error) {
    console.error('Error verificando el proyecto:', error);
    res.status(500).json({ error: 'Error interno al verificar el proyecto' });
  }
};

/**
 * Misma verificación que `cargarProyecto`, para los handlers donde el
 * `empresaId`/`proyectoId` llegan por body y no por la URL.
 * @returns {Promise<boolean>}
 */
async function proyectoPerteneceAEmpresa(proyectoId, empresaId) {
  if (!proyectoId || !empresaId) return false;
  const proyecto = await prisma.proyecto.findFirst({
    where: { id: proyectoId, empresaId },
    select: { id: true },
  });
  return Boolean(proyecto);
}

/**
 * Exige permiso de escritura sobre `modulo`.
 *
 * Va como middleware DE RUTA (`router.post(path, requireEscritura('x'), handler)`),
 * nunca con `router.use`: `use` matchea por prefijo, y como todas las rutas
 * cuelgan de /empresas/:empresaId/proyectos/..., un guard montado así se
 * dispararía también sobre las rutas de los otros módulos. Declararlo ruta por
 * ruta es más verboso pero no se filtra.
 *
 * Las rutas de sólo lectura directamente no lo llevan (incluido el POST de
 * exportar a Excel, que no modifica nada).
 *
 * @param {string} modulo
 */
function requireEscritura(modulo) {
  return (req, res, next) => {
    if (METODOS_LECTURA.has(req.method)) return next();

    if (!puedeEscribir(req.acceso, modulo)) {
      return res.status(403).json({
        error: `No tenés permiso de escritura sobre "${modulo}" en esta empresa`,
      });
    }
    next();
  };
}

/**
 * Dar de alta empresas es exclusivo del master: un admin de empresa gestiona
 * usuarios dentro de las empresas que le dieron, no crea empresas nuevas.
 */
const requireMasterParaEmpresas = (req, res, next) => {
  if (req.method === 'OPTIONS') return next();
  if (req.user?.role !== 'master') {
    return res.status(403).json({
      error: 'Sólo un administrador general puede dar de alta empresas',
    });
  }
  next();
};

module.exports = {
  cargarAcceso,
  cargarProyecto,
  proyectoPerteneceAEmpresa,
  requireEscritura,
  requireMasterParaEmpresas,
};
