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

const app = express();

// ── Middleware ──────────────────────────────────────────────
app.use(cors({
  origin: true,
  credentials: true,
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const requireAuth = require('./middleware/auth.middleware');

// ── API Routes ─────────────────────────────────────────────
app.use('/api/empresas', requireAuth, empresaRoutes);
app.use('/api/empresas/:empresaId/proyectos', requireAuth, proyectoRoutes);
app.use('/api', requireAuth, facturaRoutes);
app.use('/api/empresas/:empresaId/proyectos/:proyectoId/checklist', requireAuth, checklistRoutes);
app.use('/api/empresas/:empresaId/proyectos/:proyectoId/simulador', requireAuth, simuladorRoutes);

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
