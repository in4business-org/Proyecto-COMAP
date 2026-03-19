const { Router } = require('express');
const multer = require('multer');
const fs = require('fs');
const path = require('path');
const facturaService = require('./factura.service');
const excelService = require('./excel.service');
const proyectoService = require('../proyecto/proyecto.service');
const empresaService = require('../empresa/empresa.service');
const { UPLOADS_DIR, OUTPUTS_DIR } = require('../../config/storage.config');

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 15 * 1024 * 1024 } });
const router = Router({ mergeParams: true });

const SUPPORTED_EXTENSIONS = ['.pdf', '.png', '.jpg', '.jpeg', '.webp'];
function isSupported(filename) {
  return SUPPORTED_EXTENSIONS.includes(path.extname(filename).toLowerCase());
}

/** Path to the persisted results JSON for a project+periodo */
function resultadosPath(empresaId, proyectoId, periodo) {
  const carpeta = proyectoService.getRutaFacturas(empresaId, proyectoId, periodo);
  return path.join(carpeta, '_resultados.json');
}

/** Read persisted results, or null if none */
function leerResultados(empresaId, proyectoId, periodo) {
  const ruta = resultadosPath(empresaId, proyectoId, periodo);
  if (!fs.existsSync(ruta)) return null;
  try { return JSON.parse(fs.readFileSync(ruta, 'utf-8')); }
  catch { return null; }
}

/** Save results to disk */
function guardarResultados(empresaId, proyectoId, periodo, resultados) {
  const ruta = resultadosPath(empresaId, proyectoId, periodo);
  fs.mkdirSync(path.dirname(ruta), { recursive: true });
  fs.writeFileSync(ruta, JSON.stringify(resultados, null, 2), 'utf-8');
}

// ── Project-scoped invoice endpoints ─────────────────────

// POST  upload files
router.post('/empresas/:empresaId/proyectos/:proyectoId/:periodo/upload', upload.array('files'), (req, res) => {
  const { empresaId, proyectoId, periodo } = req.params;
  const carpeta = proyectoService.getRutaFacturas(empresaId, proyectoId, periodo);
  fs.mkdirSync(carpeta, { recursive: true });
  const subidos = [];
  for (const file of (req.files || [])) {
    if (isSupported(file.originalname)) {
      fs.writeFileSync(path.join(carpeta, file.originalname), file.buffer);
      subidos.push(file.originalname);
    }
  }
  res.json({ subidos, total: subidos.length });
});

// GET  retrieve persisted results (no re-analysis)
router.get('/empresas/:empresaId/proyectos/:proyectoId/:periodo/resultados', (req, res) => {
  const { empresaId, proyectoId, periodo } = req.params;
  const data = leerResultados(empresaId, proyectoId, periodo);
  res.json(data || []);
});

// PUT  update persisted results
router.put('/empresas/:empresaId/proyectos/:proyectoId/:periodo', (req, res) => {
  try {
    const { empresaId, proyectoId, periodo } = req.params;
    const { results } = req.body;

    if (!Array.isArray(results)) {
      return res.status(400).json({ error: 'results debe ser un array' });
    }

    guardarResultados(empresaId, proyectoId, periodo, results);
    const updated = leerResultados(empresaId, proyectoId, periodo) || [];

    res.json(updated);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: e.message });
  }
});

// GET  analyze invoices + persist results
router.get('/empresas/:empresaId/proyectos/:proyectoId/:periodo/analizar', async (req, res) => {
  try {
    const { empresaId, proyectoId, periodo } = req.params;
    const carpeta = proyectoService.getRutaFacturas(empresaId, proyectoId, periodo);
    const resultados = await facturaService.analizarFacturas(carpeta);
    // Persist
    guardarResultados(empresaId, proyectoId, periodo, resultados);
    res.json(resultados);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: e.message });
  }
});

// POST  export Excel (use saved results if available, otherwise analyze)
router.post('/empresas/:empresaId/proyectos/:proyectoId/:periodo/excel', async (req, res) => {
  try {
    const { empresaId, proyectoId, periodo } = req.params;

    // Use cached results first, fall back to re-analysis
    let resultados = leerResultados(empresaId, proyectoId, periodo);
    if (!resultados || !resultados.length) {
      const carpeta = proyectoService.getRutaFacturas(empresaId, proyectoId, periodo);
      resultados = await facturaService.analizarFacturas(carpeta);
      guardarResultados(empresaId, proyectoId, periodo, resultados);
    }
    if (!resultados.length) return res.status(404).json({ error: 'No hay facturas procesadas' });

    const meta = proyectoService.getMetadata(empresaId, proyectoId) || {};
    let fechaBalance = null;
    try {
      const info = empresaService.getById(empresaId);
      fechaBalance = info ? info.fecha_balance : null;
    } catch { }

    const timestamp = new Date().toISOString().replace(/[-:T]/g, '').substring(0, 15);
    const nombre = `cuadro_inversiones_${empresaId}_${periodo}_${timestamp}.xlsx`;
    const ruta = path.join(OUTPUTS_DIR, nombre);
    fs.mkdirSync(OUTPUTS_DIR, { recursive: true });

    await excelService.generarExcelComap(resultados, ruta, {
      cotizacion_usd: meta.cotizacion_usd,
      cotizacion_ui: meta.cotizacion_ui,
      fecha_presentacion: meta.fecha_presentacion,
      fecha_balance: fechaBalance,
    });

    res.set({
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename=${nombre}`,
    });
    res.send(fs.readFileSync(ruta));
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: e.message });
  }
});

// ── Simple mode endpoints ────────────────────────────────

const SIMPLE_RESULTS_PATH = path.join(UPLOADS_DIR, '_resultados.json');

router.post('/simple/upload', upload.array('files'), (req, res) => {
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
  const subidos = [];
  for (const file of (req.files || [])) {
    if (isSupported(file.originalname)) {
      fs.writeFileSync(path.join(UPLOADS_DIR, file.originalname), file.buffer);
      subidos.push(file.originalname);
    }
  }
  res.json({ subidos, total: subidos.length });
});

router.get('/simple/resultados', (_req, res) => {
  if (fs.existsSync(SIMPLE_RESULTS_PATH)) {
    try { return res.json(JSON.parse(fs.readFileSync(SIMPLE_RESULTS_PATH, 'utf-8'))); }
    catch { }
  }
  res.json([]);
});

router.get('/simple/analizar', async (_req, res) => {
  try {
    const resultados = await facturaService.analizarFacturas(UPLOADS_DIR);
    fs.mkdirSync(UPLOADS_DIR, { recursive: true });
    fs.writeFileSync(SIMPLE_RESULTS_PATH, JSON.stringify(resultados, null, 2), 'utf-8');
    res.json(resultados);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.get('/simple/excel', async (_req, res) => {
  try {
    let resultados = [];
    if (fs.existsSync(SIMPLE_RESULTS_PATH)) {
      try { resultados = JSON.parse(fs.readFileSync(SIMPLE_RESULTS_PATH, 'utf-8')); } catch { }
    }
    if (!resultados.length) {
      resultados = await facturaService.analizarFacturas(UPLOADS_DIR);
    }
    if (!resultados.length) return res.status(404).json({ error: 'No hay facturas procesadas' });
    const ruta = path.join(OUTPUTS_DIR, 'facturas_extraidas.xlsx');
    fs.mkdirSync(OUTPUTS_DIR, { recursive: true });
    await excelService.generarExcelSimple(resultados, ruta);
    res.set({
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': 'attachment; filename=facturas_extraidas.xlsx',
    });
    res.send(fs.readFileSync(ruta));
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.post('/simple/asociar', async (req, res) => {
  try {
    const { empresaId, proyectoId, periodo } = req.body;
    if (!empresaId || !proyectoId || !periodo) return res.status(400).json({ error: 'Faltan datos' });

    let resultadosSimples = [];
    if (fs.existsSync(SIMPLE_RESULTS_PATH)) {
      try { resultadosSimples = JSON.parse(fs.readFileSync(SIMPLE_RESULTS_PATH, 'utf-8')); } catch { }
    }

    if (!resultadosSimples.length) {
      return res.status(400).json({ error: 'No hay facturas procesadas para asociar' });
    }

    const carpetaDestino = proyectoService.getRutaFacturas(empresaId, proyectoId, periodo);
    fs.mkdirSync(carpetaDestino, { recursive: true });

    // Copiar archivos físicos
    let copiados = 0;
    for (const r of resultadosSimples) {
      if (r.archivo) {
        const srcPath = path.join(UPLOADS_DIR, r.archivo);
        const destPath = path.join(carpetaDestino, r.archivo);
        if (fs.existsSync(srcPath)) {
          fs.copyFileSync(srcPath, destPath);
          copiados++;
        }
      }
    }

    // Unir resultados lógicos (append y reemplazar duplicados de archivo)
    let resultadosDestino = leerResultados(empresaId, proyectoId, periodo) || [];
    const destinoMap = new Map(resultadosDestino.map(r => [r.archivo, r]));

    for (const r of resultadosSimples) {
      destinoMap.set(r.archivo, r);
    }

    resultadosDestino = Array.from(destinoMap.values());
    guardarResultados(empresaId, proyectoId, periodo, resultadosDestino);

    // Limpiar el modo simple para que quede vacío después de asociar
    try { fs.unlinkSync(SIMPLE_RESULTS_PATH); } catch (e) { }

    res.json({ success: true, asociados: resultadosSimples.length, archivos_copiados: copiados });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

module.exports = router;
