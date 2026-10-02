const { Router } = require('express');
const adminService = require('./admin.service');
const accesoService = require('../acceso/acceso.service');
const { MODULOS } = require('../../common/constants/permisos');
const { requireMaster } = require('../../middleware/auth.middleware');

const router = Router();

// Este módulo se monta detrás de requireAuth + requirePanel (ver main.js), así
// que acá ya sabemos que req.user es master o admin de empresa.
//
// Lo que es exclusivo del master lleva `requireMaster` en la ruta. Lo que un
// admin de empresa sí puede hacer se recorta por ámbito dentro del servicio:
// sólo ve y toca usuarios de las empresas que le asignaron.

function handle(res, err) {
  const status = err.status || 500;
  if (status === 500) console.error('[ADMIN]', err);
  res.status(status).json({ error: err.message || 'Error interno' });
}

// Quién soy y qué alcance tengo, para que el panel se dibuje acorde
router.get('/contexto', async (req, res) => {
  try {
    const ambito = await accesoService.getEmpresasAdministradas(req.user);
    res.json({
      rol: req.user.role,
      esMaster: req.user.role === 'master',
      // null = todas las empresas
      empresasAdministradas: ambito,
    });
  } catch (err) {
    handle(res, err);
  }
});

// Listar usuarios visibles para quien pregunta
router.get('/usuarios', async (req, res) => {
  try {
    res.json(await adminService.listarUsuarios(req.user));
  } catch (err) {
    handle(res, err);
  }
});

// Crear usuario. Un admin de empresa sólo puede crear usuarios normales y
// asignarles permisos dentro de sus empresas; el servicio lo valida.
router.post('/usuarios', async (req, res) => {
  try {
    const { email, nombre, rol, enviarMail, accesos } = req.body || {};
    const data = await adminService.crearUsuario(
      { email, nombre, rol, enviarMail: enviarMail !== false, accesos },
      req.user
    );
    res.status(201).json(data);
  } catch (err) {
    handle(res, err);
  }
});

// Cambiar rol: sólo master. Es la frontera que impide que un admin de empresa
// se promueva a sí mismo o promueva a otro.
router.patch('/usuarios/:username/rol', requireMaster, async (req, res) => {
  try {
    const usuario = await adminService.cambiarRol(
      req.params.username,
      req.body?.rol,
      req.user
    );
    res.json(usuario);
  } catch (err) {
    handle(res, err);
  }
});

// Habilitar / deshabilitar la cuenta: afecta el acceso a toda la plataforma,
// así que es del master.
router.patch('/usuarios/:username/estado', requireMaster, async (req, res) => {
  try {
    const usuario = await adminService.cambiarEstado(
      req.params.username,
      req.body?.habilitado === true,
      req.user
    );
    res.json(usuario);
  } catch (err) {
    handle(res, err);
  }
});

// Eliminar la cuenta de Cognito: del master. Un admin de empresa saca a alguien
// quitándole el acceso a sus empresas, no borrando la persona.
router.delete('/usuarios/:username', requireMaster, async (req, res) => {
  try {
    res.json(await adminService.eliminarUsuario(req.params.username, req.user));
  } catch (err) {
    handle(res, err);
  }
});

// Reset de contraseña: el servicio deja pasar a un admin de empresa sólo si el
// usuario está enteramente dentro de su ámbito.
router.post('/usuarios/:username/reset-password', async (req, res) => {
  try {
    res.json(await adminService.resetearPassword(req.params.username, req.user));
  } catch (err) {
    handle(res, err);
  }
});

// Catalogo de modulos sobre los que se puede dar escritura
router.get('/modulos', (_req, res) => {
  res.json(MODULOS);
});

// Accesos por empresa de un usuario
router.get('/usuarios/:username/accesos', async (req, res) => {
  try {
    const usuario = await adminService.getUsuario(req.params.username);
    const ambito = await adminService.assertPuedeGestionar(req.user, usuario);
    const accesos = await accesoService.listarAccesosDeUsuario(usuario.sub);
    // Un admin de empresa no ve los permisos del usuario en empresas ajenas
    res.json(ambito === null ? accesos : accesos.filter((a) => ambito.includes(a.empresaId)));
  } catch (err) {
    handle(res, err);
  }
});

// Reemplaza los accesos del usuario. Para un admin de empresa el reemplazo es
// parcial: sólo reescribe sus empresas y deja intacto el resto.
router.put('/usuarios/:username/accesos', async (req, res) => {
  try {
    const usuario = await adminService.getUsuario(req.params.username);
    if (usuario.rol === 'master') {
      return res.status(400).json({
        error: 'Un administrador general ya accede a todas las empresas; no se le asignan permisos.',
      });
    }
    const ambito = await adminService.assertPuedeGestionar(req.user, usuario);

    // A un admin de empresa sólo se le elige QUÉ empresas administra: dentro de
    // ellas tiene control total, así que la granularidad por módulo no aplica.
    // Normalizamos acá para que no quede guardada información engañosa.
    const accesos = Array.isArray(req.body?.accesos)
      ? req.body.accesos.map((a) =>
          usuario.rol === 'admin_empresa' ? { empresaId: a?.empresaId, escritura: [] } : a
        )
      : req.body?.accesos;

    const actualizados = await accesoService.reemplazarAccesos(usuario.sub, accesos, ambito);
    res.json(ambito === null ? actualizados : actualizados.filter((a) => ambito.includes(a.empresaId)));
  } catch (err) {
    handle(res, err);
  }
});

module.exports = router;
