require('dotenv').config();

const express = require('express');
const cors = require('cors');
const path = require('path');

// Import route modules
const empresaRoutes = require('./modules/empresa/empresa.routes');
const proyectoRoutes = require('./modules/proyecto/proyecto.routes');
const facturaRoutes = require('./modules/factura/factura.routes');
const checklistRoutes = require('./modules/checklist/checklist.routes');
const simuladorRoutes = require('./modules/simulador/simulador.routes');
const cotizacionRoutes = require('./modules/cotizacion/cotizacion.routes');
const adminRoutes = require('./modules/admin/admin.routes');

const app = express();

// ── Middleware ──────────────────────────────────────────────
app.use(cors({
  origin: true,
  credentials: true,
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const { requireAuth, requirePanel } = require('./middleware/auth.middleware');
const {
  cargarAcceso,
  cargarProyecto,
  requireMasterParaEmpresas,
} = require('./middleware/acceso.middleware');
const accesoService = require('./modules/acceso/acceso.service');

// ── Performance timing ────────────────────────────────────
app.use((req, res, next) => {
  const start = performance.now();
  const originalSend = res.send.bind(res);
  let logged = false;

  res.send = function (body) {
    if (!logged) {
      logged = true;
      const ms = (performance.now() - start).toFixed(0);
      const tag = ms > 1000 ? 'SLOW' : ms > 300 ? 'WARN' : 'OK';
      console.log(`[${tag}] ${req.method} ${req.originalUrl} -> ${res.statusCode} (${ms}ms)`);
    }
    return originalSend(body);
  };
  next();
});

// ── API Routes ─────────────────────────────────────────────

// Choke point de permisos: TODA ruta con alcance de empresa cuelga de
// /api/empresas/:empresaId (proyectos, facturas, checklist, simulador), así que
// este middleware las cubre a todas. Deja el acceso resuelto en req.acceso y
// corta con 404 si el usuario no tiene ni lectura sobre esa empresa.
app.use('/api/empresas/:empresaId', requireAuth, cargarAcceso);

// Segundo choke point: el acceso se concede por empresa, pero casi todo se
// consulta por proyectoId. Sin esto, tener acceso a UNA empresa alcanzaria
// para tocar el proyecto de otra pasando su id en la URL.
app.use('/api/empresas/:empresaId/proyectos/:proyectoId', requireAuth, cargarProyecto);

// El alta de empresas es exclusiva de administradores.
app.post('/api/empresas', requireAuth, requireMasterParaEmpresas);

app.use('/api/empresas', requireAuth, empresaRoutes);
app.use('/api/empresas/:empresaId/proyectos', requireAuth, proyectoRoutes);
// Panel de administracion: master y admin de empresa. Que puede hacer cada
// uno se decide ruta por ruta dentro del modulo..
// Va antes del mount general de '/api' para no pasar dos veces por requireAuth.
app.use('/api/admin', requireAuth, requirePanel, adminRoutes);
app.use('/api', requireAuth, facturaRoutes);
app.use('/api/empresas/:empresaId/proyectos/:proyectoId/checklist', requireAuth, checklistRoutes);
app.use('/api/empresas/:empresaId/proyectos/:proyectoId/simulador', requireAuth, simuladorRoutes);
app.use('/api/cotizaciones', requireAuth, cotizacionRoutes);


// ── Usuario actual (identidad + rol) ───────────────────────
app.get('/api/me', requireAuth, async (req, res) => {
  try {
    const esMaster = req.user.role === 'master';
    res.json({
      sub: req.user.sub,
      email: req.user.email,
      username: req.user.username,
      role: req.user.role,
      groups: req.user.groups,
      // Permisos por empresa, para que el front oculte lo que no puede hacer.
      // Un admin no tiene filas: accede a todo por su rol.
      accesos: esMaster ? [] : await accesoService.listarAccesosDeUsuario(req.user.sub),
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ── Dashboard (empresas + proyectos in one query) ─────────
app.get('/api/dashboard', requireAuth, async (req, res) => {
  try {
    // null = administrador, ve todas; si no, sólo las empresas asignadas
    const visibles = await accesoService.getEmpresasVisibles(req.user);
    const empresas = await prisma.empresa.findMany({
      ...(visibles === null ? {} : { where: { id: { in: visibles } } }),
      include: { proyectos: true }
    });
    res.json(empresas.map(e => ({
      ...e,
      proyectos: e.proyectos.map(p => ({
        id: p.id,
        expediente: p.expediente,
        fecha_creacion: p.fecha_creacion,
        fecha_presentacion: p.fecha_presentacion,
        anio_presentacion: p.anio_presentacion,
        duracion_seguimiento: p.duracion_seguimiento,
        cotizacion_ui: p.cotizacion_ui,
        cotizacion_usd: p.cotizacion_usd,
      }))
    })));
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ── Health check ───────────────────────────────────────────
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// ── Stats ──────────────────────────────────────────────────
const prisma = require('./config/prisma');

app.get('/api/stats', requireAuth, async (req, res) => {
  try {
    // Acotado a las empresas visibles: un admin de empresa no deberia poder
    // inferir cuantas empresas o facturas hay en el resto de la plataforma.
    const visibles = await accesoService.getEmpresasVisibles(req.user);
    const scope = visibles === null ? {} : { in: visibles };
    const whereEmpresa = visibles === null ? {} : { where: { id: scope } };
    const whereProyecto = visibles === null ? {} : { where: { empresaId: scope } };

    const empresas = await prisma.empresa.count(whereEmpresa);
    const proyectos = await prisma.proyecto.count(whereProyecto);
    const facturas = await prisma.factura.count({
      where: {
        texto_extraido: true,
        ...(visibles === null ? {} : { proyecto: { empresaId: scope } }),
      },
    });
    res.json({ empresas, proyectos, facturas });
  } catch (e) {
    res.json({ empresas: 0, proyectos: 0, facturas: 0 });
  }
});

// ── Start server ───────────────────────────────────────────
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Backend running at http://localhost:${PORT}`);
});

module.exports = app;
