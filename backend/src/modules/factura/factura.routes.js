const { Router } = require('express');
const multer = require('multer');
const fs = require('fs');
const path = require('path');
const facturaService = require('./factura.service');
const excelService = require('./excel.service');
const proyectoService = require('../proyecto/proyecto.service');
const empresaService = require('../empresa/empresa.service');
const { UPLOADS_DIR, OUTPUTS_DIR } = require('../../config/storage.config');
const prisma = require('../../config/prisma');

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 15 * 1024 * 1024 } });
const router = Router({ mergeParams: true });

const SUPPORTED_EXTENSIONS = ['.pdf', '.png', '.jpg', '.jpeg', '.webp'];
function isSupported(filename) {
  return SUPPORTED_EXTENSIONS.includes(path.extname(filename).toLowerCase());
}

/** Save results to database */
async function guardarResultadosDB(proyectoId, periodo, resultados) {
  await prisma.factura.deleteMany({
    where: { proyectoId, periodo }
  });
  
  if (resultados && resultados.length > 0) {
    const dataToInsert = resultados.map(r => ({
      proyectoId,
      periodo,
      archivo: r.archivo || null,
      descripcion: r.descripcion || null,
      numero_factura: r.numero_factura || null,
      proveedor: r.proveedor || null,
      rut: r.rut || null,
      fecha: r.fecha || null,
      monto: r.monto ? parseFloat(r.monto) : null,
      moneda: r.moneda || null,
      cantidad: r.cantidad ? parseInt(r.cantidad) : 1,
      categoria: r.categoria || null,
      rut_receptor: r.rut_receptor || null,
      razon_social_receptor: r.razon_social_receptor || null,
      texto_extraido: Boolean(r.texto_extraido)
    }));
    await prisma.factura.createMany({ data: dataToInsert });
  }
}

/** Read persisted results from db */
async function leerResultadosDB(proyectoId, periodo) {
  return prisma.factura.findMany({
    where: { proyectoId, periodo },
    orderBy: { createdAt: 'asc' }
  });
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

// GET  retrieve persisted results
router.get('/empresas/:empresaId/proyectos/:proyectoId/:periodo/resultados', async (req, res) => {
  try {
    const { proyectoId, periodo } = req.params;
    const data = await leerResultadosDB(proyectoId, periodo);
    res.json(data || []);
  } catch(e) {
    res.status(500).json({ error: e.message });
  }
});

// PUT  update persisted results
router.put('/empresas/:empresaId/proyectos/:proyectoId/:periodo', async (req, res) => {
  try {
    const { proyectoId, periodo } = req.params;
    const { results } = req.body;

    if (!Array.isArray(results)) {
      return res.status(400).json({ error: 'results debe ser un array' });
    }

    await guardarResultadosDB(proyectoId, periodo, results);
    const updated = await leerResultadosDB(proyectoId, periodo);
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
    
    await guardarResultadosDB(proyectoId, periodo, resultados);
    res.json(await leerResultadosDB(proyectoId, periodo));
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: e.message });
  }
});

// POST  export Excel
router.post('/empresas/:empresaId/proyectos/:proyectoId/:periodo/excel', async (req, res) => {
  try {
    const { empresaId, proyectoId, periodo } = req.params;

    let resultados = await leerResultadosDB(proyectoId, periodo);
    if (!resultados || !resultados.length) {
      const carpeta = proyectoService.getRutaFacturas(empresaId, proyectoId, periodo);
      const parsedStats = await facturaService.analizarFacturas(carpeta);
      await guardarResultadosDB(proyectoId, periodo, parsedStats);
      resultados = await leerResultadosDB(proyectoId, periodo);
    }
    if (!resultados.length) return res.status(404).json({ error: 'No hay facturas procesadas' });

    const meta = await proyectoService.getMetadata(empresaId, proyectoId) || {};
    let fechaBalance = null;
    try {
      const info = await empresaService.getById(empresaId);
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

    let resultadosDestino = await leerResultadosDB(proyectoId, periodo) || [];
    const destinoMap = new Map(resultadosDestino.map(r => [r.archivo, r]));

    for (const r of resultadosSimples) {
      destinoMap.set(r.archivo, r);
    }

    const combinedResults = Array.from(destinoMap.values());
    await guardarResultadosDB(proyectoId, periodo, combinedResults);

    try { fs.unlinkSync(SIMPLE_RESULTS_PATH); } catch (e) { }

    res.json({ success: true, asociados: resultadosSimples.length, archivos_copiados: copiados });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

module.exports = router;
