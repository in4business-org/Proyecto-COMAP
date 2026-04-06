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

const app = express();

// ── Middleware ──────────────────────────────────────────────
app.use(cors({
  origin: true,
  credentials: true,
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const requireAuth = require('./middleware/auth.middleware');

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
app.use('/api/empresas', requireAuth, empresaRoutes);
app.use('/api/empresas/:empresaId/proyectos', requireAuth, proyectoRoutes);
app.use('/api', requireAuth, facturaRoutes);
app.use('/api/empresas/:empresaId/proyectos/:proyectoId/checklist', requireAuth, checklistRoutes);
app.use('/api/empresas/:empresaId/proyectos/:proyectoId/simulador', requireAuth, simuladorRoutes);
app.use('/api/cotizaciones', requireAuth, cotizacionRoutes);

// ── Dashboard (empresas + proyectos in one query) ─────────
app.get('/api/dashboard', requireAuth, async (_req, res) => {
  try {
    const empresas = await prisma.empresa.findMany({
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

app.get('/api/stats', async (_req, res) => {
  try {
    const empresas = await prisma.empresa.count();
    const proyectos = await prisma.proyecto.count();
    const facturas = await prisma.factura.count({ where: { texto_extraido: true }});
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
