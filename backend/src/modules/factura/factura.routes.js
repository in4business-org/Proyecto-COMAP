const { Router } = require('express');
const multer = require('multer');
const fs = require('fs');
const path = require('path');
const os = require('os');
const facturaService = require('./factura.service');
const excelService = require('./excel.service');
const proyectoService = require('../proyecto/proyecto.service');
const empresaService = require('../empresa/empresa.service');
const supabaseService = require('../../config/supabase.config');
const prisma = require('../../config/prisma');
const cotizacionService = require('../cotizacion/cotizacion.service');
const { formatearFecha } = require('../../common/utils/normalize');

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 15 * 1024 * 1024 } });
const router = Router({ mergeParams: true });
const TMP_DIR = os.tmpdir();

const SUPPORTED_EXTENSIONS = ['.pdf', '.png', '.jpg', '.jpeg', '.webp'];
function isSupported(filename) {
  return SUPPORTED_EXTENSIONS.includes(path.extname(filename).toLowerCase());
}

function getMimeType(filename) {
  const ext = path.extname(filename).toLowerCase();
  const mimeMap = {
    '.pdf': 'application/pdf', '.png': 'image/png', '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg', '.webp': 'image/webp',
  };
  return mimeMap[ext] || 'application/pdf';
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
router.post('/empresas/:empresaId/proyectos/:proyectoId/:periodo/upload', upload.array('files'), async (req, res) => {
  try {
    const { empresaId, proyectoId, periodo } = req.params;
    const folderPath = `proyectos/${empresaId}/${proyectoId}/${periodo}`;
    const subidos = [];
    for (const file of (req.files || [])) {
      if (isSupported(file.originalname)) {
        await supabaseService.uploadFile(`${folderPath}/${file.originalname}`, file.buffer, file.mimetype);
        subidos.push(file.originalname);
      }
    }
    res.json({ subidos, total: subidos.length });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: error.message });
  }
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
    const folderPath = `proyectos/${empresaId}/${proyectoId}/${periodo}`;
    
    const fileList = await supabaseService.listFiles(folderPath);
    if (!fileList || !fileList.length) return res.json(await leerResultadosDB(proyectoId, periodo));

    const archivosData = [];
    for (const f of fileList) {
        if (!isSupported(f.name)) continue;
        const buffer = await supabaseService.downloadFile(`${folderPath}/${f.name}`);
        archivosData.push({ buffer, mimeType: getMimeType(f.name), filename: f.name });
    }
    
    const resultados = await facturaService.analizarMultipleArchivos(archivosData);
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
      const folderPath = `proyectos/${empresaId}/${proyectoId}/${periodo}`;
      const fileList = await supabaseService.listFiles(folderPath);
      const archivosData = [];
      for (const f of (fileList || [])) {
          if (!isSupported(f.name)) continue;
          const buffer = await supabaseService.downloadFile(`${folderPath}/${f.name}`);
          archivosData.push({ buffer, mimeType: getMimeType(f.name), filename: f.name });
      }
      const parsedStats = await facturaService.analizarMultipleArchivos(archivosData);
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
    const ruta = path.join(TMP_DIR, nombre);

    let cotizacion_usd = meta.cotizacion_usd;
    let cotizacion_ui = meta.cotizacion_ui;
    if (!cotizacion_usd || !cotizacion_ui) {
      try {
        const cot = await cotizacionService.getCotizacionMesAnterior();
        if (!cotizacion_usd) cotizacion_usd = cot.valor_usd;
        if (!cotizacion_ui) cotizacion_ui = cot.valor_ui;
      } catch { }
    }

    await excelService.generarExcelComap(resultados, ruta, {
      cotizacion_usd,
      cotizacion_ui,
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

// GET  download import template
router.get('/empresas/:empresaId/proyectos/:proyectoId/:periodo/template-importar', async (_req, res) => {
  try {
    const ExcelJS = require('exceljs');
    const workbook = new ExcelJS.Workbook();
    const ws = workbook.addWorksheet('Facturas');

    ws.columns = [
      { header: 'descripcion', key: 'descripcion', width: 35 },
      { header: 'numero_factura', key: 'numero_factura', width: 15 },
      { header: 'proveedor', key: 'proveedor', width: 25 },
      { header: 'rut', key: 'rut', width: 14 },
      { header: 'fecha', key: 'fecha', width: 16 },
      { header: 'monto', key: 'monto', width: 14 },
      { header: 'moneda ($ o USD)', key: 'moneda', width: 16 },
      { header: 'cantidad', key: 'cantidad', width: 10 },
      { header: 'categoria', key: 'categoria', width: 28 },
    ];
    ws.getColumn(5).numFmt = 'DD/MM/YYYY';
    ws.getRow(1).font = { bold: true };

    const buffer = await workbook.xlsx.writeBuffer();
    res.set({
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': 'attachment; filename=template_facturas.xlsx',
    });
    res.send(buffer);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// POST  import facturas from Excel
router.post('/empresas/:empresaId/proyectos/:proyectoId/:periodo/importar', upload.single('file'), async (req, res) => {
  try {
    const { proyectoId, periodo } = req.params;
    if (!req.file?.buffer) return res.status(400).json({ error: 'No se recibió archivo' });

    const ExcelJS = require('exceljs');
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(req.file.buffer);

    const ws = workbook.worksheets[0];
    const nuevas = [];

    ws.eachRow((row, rowNumber) => {
      if (rowNumber === 1) return;
      const descripcion = row.getCell(1).text?.trim() || null;
      const numero_factura = row.getCell(2).text?.trim() || null;
      const proveedor = row.getCell(3).text?.trim() || null;
      const rut = row.getCell(4).text?.trim() || null;
      const fechaRaw = row.getCell(5).value;
      const fecha = fechaRaw instanceof Date
        ? formatearFecha(fechaRaw)
        : (typeof fechaRaw === 'string' ? fechaRaw.trim() || null : null);
      const montoRaw = row.getCell(6).value;
      const monto = montoRaw != null && montoRaw !== '' ? parseFloat(montoRaw) : null;
      const moneda = row.getCell(7).text?.trim() || null;
      const cantidadRaw = row.getCell(8).value;
      const cantidad = cantidadRaw != null && cantidadRaw !== '' ? parseInt(cantidadRaw) : 1;
      const categoria = row.getCell(9).text?.trim() || null;

      if (!descripcion && !numero_factura && !proveedor && !monto) return;

      nuevas.push({
        descripcion, numero_factura, proveedor, rut, fecha,
        monto, moneda, cantidad, categoria, texto_extraido: false,
      });
    });

    const existentes = await leerResultadosDB(proyectoId, periodo);
    await guardarResultadosDB(proyectoId, periodo, [...existentes, ...nuevas]);
    const updated = await leerResultadosDB(proyectoId, periodo);
    res.json(updated);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: e.message });
  }
});

// ── Simple mode endpoints ────────────────────────────────

const SIMPLE_RESULTS_KEY = 'simple_uploads/_resultados.json';

router.post('/simple/upload', upload.array('files'), async (req, res) => {
  try {
    const subidos = [];
    for (const file of (req.files || [])) {
      if (isSupported(file.originalname)) {
        await supabaseService.uploadFile(`simple_uploads/${file.originalname}`, file.buffer, file.mimetype);
        subidos.push(file.originalname);
      }
    }
    res.json({ subidos, total: subidos.length });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/simple/resultados', async (_req, res) => {
  try {
    const buffer = await supabaseService.downloadFile(SIMPLE_RESULTS_KEY);
    return res.json(JSON.parse(buffer.toString('utf-8')));
  } catch {
    res.json([]);
  }
});

router.get('/simple/analizar', async (_req, res) => {
  try {
    const fileList = await supabaseService.listFiles('simple_uploads');
    const archivosData = [];
    for (const f of (fileList || [])) {
      if (f.name === '_resultados.json' || !isSupported(f.name)) continue;
      const buffer = await supabaseService.downloadFile(`simple_uploads/${f.name}`);
      archivosData.push({ buffer, mimeType: getMimeType(f.name), filename: f.name });
    }
    
    const resultados = await facturaService.analizarMultipleArchivos(archivosData);
    await supabaseService.uploadFile(SIMPLE_RESULTS_KEY, Buffer.from(JSON.stringify(resultados, null, 2)), 'application/json');
    res.json(resultados);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.get('/simple/excel', async (_req, res) => {
  try {
    let resultados = [];
    try {
      const buffer = await supabaseService.downloadFile(SIMPLE_RESULTS_KEY);
      resultados = JSON.parse(buffer.toString('utf-8'));
    } catch { }
    
    if (!resultados.length) {
       // fallback inline analyze
       const fileList = await supabaseService.listFiles('simple_uploads');
       const archivosData = [];
       for (const f of (fileList || [])) {
          if (f.name === '_resultados.json' || !isSupported(f.name)) continue;
          const buffer = await supabaseService.downloadFile(`simple_uploads/${f.name}`);
          archivosData.push({ buffer, mimeType: getMimeType(f.name), filename: f.name });
       }
       resultados = await facturaService.analizarMultipleArchivos(archivosData);
    }
    if (!resultados.length) return res.status(404).json({ error: 'No hay facturas procesadas' });
    
    const ruta = path.join(TMP_DIR, 'facturas_extraidas.xlsx');
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
    try {
      const buffer = await supabaseService.downloadFile(SIMPLE_RESULTS_KEY);
      resultadosSimples = JSON.parse(buffer.toString('utf-8'));
    } catch { }

    if (!resultadosSimples.length) {
      return res.status(400).json({ error: 'No hay facturas procesadas para asociar' });
    }

    const folderPath = `proyectos/${empresaId}/${proyectoId}/${periodo}`;
    let copiados = 0;
    
    for (const r of resultadosSimples) {
      if (r.archivo) {
         try {
           const srcBuf = await supabaseService.downloadFile(`simple_uploads/${r.archivo}`);
           await supabaseService.uploadFile(`${folderPath}/${r.archivo}`, srcBuf, getMimeType(r.archivo));
           copiados++;
         } catch { } // ignore missing files
      }
    }

    let resultadosDestino = await leerResultadosDB(proyectoId, periodo) || [];
    const destinoMap = new Map(resultadosDestino.map(r => [r.archivo, r]));

    for (const r of resultadosSimples) {
      destinoMap.set(r.archivo, r);
    }

    const combinedResults = Array.from(destinoMap.values());
    await guardarResultadosDB(proyectoId, periodo, combinedResults);

    try { await supabaseService.deleteFile(SIMPLE_RESULTS_KEY); } catch (e) { }

    res.json({ success: true, asociados: resultadosSimples.length, archivos_copiados: copiados });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

module.exports = router;
