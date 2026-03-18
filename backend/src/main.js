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
  origin: ['http://localhost:5173', 'http://localhost:3000'],
  credentials: true,
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ── API Routes ─────────────────────────────────────────────
app.use('/api/empresas', empresaRoutes);
app.use('/api/empresas/:empresaId/proyectos', proyectoRoutes);
app.use('/api', facturaRoutes);
app.use('/api/empresas/:empresaId/proyectos/:proyectoId/checklist', checklistRoutes);
app.use('/api/empresas/:empresaId/proyectos/:proyectoId/simulador', simuladorRoutes);

// ── Health check ───────────────────────────────────────────
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// ── Stats ──────────────────────────────────────────────────
const fs = require('fs');
const { PROYECTOS_DIR } = require('./config/storage.config');

app.get('/api/stats', (_req, res) => {
  let empresasCount = 0;
  let proyectosCount = 0;
  let facturasCount = 0;

  if (fs.existsSync(PROYECTOS_DIR)) {
    const empresas = fs.readdirSync(PROYECTOS_DIR).filter(d =>
      fs.statSync(path.join(PROYECTOS_DIR, d)).isDirectory() &&
      fs.existsSync(path.join(PROYECTOS_DIR, d, 'info.json'))
    );
    empresasCount = empresas.length;

    for (const emp of empresas) {
      const empDir = path.join(PROYECTOS_DIR, emp);
      const proyectos = fs.readdirSync(empDir).filter(d =>
        fs.statSync(path.join(empDir, d)).isDirectory() &&
        fs.existsSync(path.join(empDir, d, 'metadata.json'))
      );
      proyectosCount += proyectos.length;

      // Count invoice items from persisted results
      for (const proj of proyectos) {
        const projDir = path.join(empDir, proj);
        const periodos = fs.readdirSync(projDir).filter(d =>
          fs.statSync(path.join(projDir, d)).isDirectory()
        );
        for (const periodo of periodos) {
          const resPath = path.join(projDir, periodo, 'facturas', '_resultados.json');
          if (fs.existsSync(resPath)) {
            try {
              const data = JSON.parse(fs.readFileSync(resPath, 'utf-8'));
              facturasCount += Array.isArray(data) ? data.length : 0;
            } catch {}
          }
        }
      }
    }
  }

  res.json({ empresas: empresasCount, proyectos: proyectosCount, facturas: facturasCount });
});

// ── Start server ───────────────────────────────────────────
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Backend running at http://localhost:${PORT}`);
});

module.exports = app;
