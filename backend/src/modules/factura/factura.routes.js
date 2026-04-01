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

/**
 * Calcula fecha_ejecucion por defecto:
 * - Factura: misma fecha del comprobante (ya ejecutada, antes de presentación)
 * - Presupuesto / null: fecha_presentacion + 1 día (año de presentación)
 */
function calcularFechaEjecucion(tipoComprobante, fechaFactura, fechaPresentacion) {
  if (tipoComprobante === 'Factura') return fechaFactura || null;
  if (fechaPresentacion) {
    const d = new Date(fechaPresentacion);
    d.setDate(d.getDate() + 1);
    return d.toISOString().split('T')[0];
  }
  return null;
}

/** Save results to database (upsert by id to preserve updatedAt per-row) */
async function guardarResultadosDB(proyectoId, periodo, resultados) {
  const incoming = resultados || [];
  const incomingIds = incoming.map(r => r.id).filter(Boolean);

  // Delete rows that were removed (had an id before, not present now)
  await prisma.$transaction(async (tx) => {
    // Remove rows not in incoming list
    await tx.factura.deleteMany({
      where: {
        proyectoId,
        periodo,
        ...(incomingIds.length > 0 ? { id: { notIn: incomingIds } } : {}),
      }
    });

    await Promise.all(incoming.map(r => {
      const data = {
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
        tipo_comprobante: r.tipo_comprobante || null,
        fecha_ejecucion: r.fecha_ejecucion || null,
        texto_extraido: Boolean(r.texto_extraido),
      };
      if (r.id) {
        return tx.factura.upsert({
          where: { id: r.id },
          update: data,
          create: { id: r.id, ...data },
        });
      }
      return tx.factura.create({ data });
    }));
  });
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
    const supported = (req.files || []).filter(f => isSupported(f.originalname));
    const subidos = await Promise.all(
      supported.map(f =>
        supabaseService.uploadFile(`${folderPath}/${f.originalname}`, f.buffer, f.mimetype)
          .then(() => f.originalname)
      )
    );
    res.json({ subidos, total: subidos.length });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: error.message });
  }
});

// POST  upload + process files (appends to existing results)
router.post('/empresas/:empresaId/proyectos/:proyectoId/:periodo/subir-y-procesar', upload.array('files'), async (req, res) => {
  try {
    const { empresaId, proyectoId, periodo } = req.params;
    const folderPath = `proyectos/${empresaId}/${proyectoId}/${periodo}`;

    const supported = (req.files || []).filter(f => isSupported(f.originalname));
    await Promise.all(
      supported.map(f =>
        supabaseService.uploadFile(`${folderPath}/${f.originalname}`, f.buffer, f.mimetype)
      )
    );
    const archivosData = supported.map(f => ({
      buffer: f.buffer,
      mimeType: getMimeType(f.originalname),
      filename: f.originalname,
    }));

    if (!archivosData.length) {
      return res.json(await leerResultadosDB(proyectoId, periodo));
    }

    const [nuevos, meta = {}] = await Promise.all([
      facturaService.analizarMultipleArchivos(archivosData),
      proyectoService.getMetadata(empresaId, proyectoId),
    ]);

    if (nuevos.length > 0) {
      await prisma.factura.createMany({
        data: nuevos.map(r => ({
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
          tipo_comprobante: r.tipo_comprobante || null,
          fecha_ejecucion: calcularFechaEjecucion(r.tipo_comprobante, r.fecha, meta.fecha_presentacion),
          texto_extraido: Boolean(r.texto_extraido),
        })),
      });
    }

    res.json(await leerResultadosDB(proyectoId, periodo));
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: e.message });
  }
});

// POST  reprocess specific files (returns new data without saving)
router.post('/empresas/:empresaId/proyectos/:proyectoId/:periodo/reprocesar', async (req, res) => {
  try {
    const { empresaId, proyectoId, periodo } = req.params;
    const { archivos } = req.body;

    if (!Array.isArray(archivos) || !archivos.length) {
      return res.status(400).json({ error: 'archivos debe ser un array no vacío' });
    }

    const folderPath = `proyectos/${empresaId}/${proyectoId}/${periodo}`;
    const downloadResults = await Promise.allSettled(
      archivos.map(filename =>
        supabaseService.downloadFile(`${folderPath}/${filename}`)
          .then(buffer => ({ buffer, mimeType: getMimeType(filename), filename }))
      )
    );
    downloadResults
      .filter(r => r.status === 'rejected')
      .forEach(r => console.warn('No se pudo descargar archivo:', r.reason?.message));
    const archivosData = downloadResults
      .filter(r => r.status === 'fulfilled')
      .map(r => r.value);

    if (!archivosData.length) {
      return res.status(404).json({ error: 'No se pudieron descargar los archivos indicados' });
    }

    const resultados = await facturaService.analizarMultipleArchivos(archivosData);
    res.json(resultados);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: e.message });
  }
});

// GET  retrieve persisted results for one periodo
router.get('/empresas/:empresaId/proyectos/:proyectoId/:periodo/resultados', async (req, res) => {
  try {
    const { proyectoId, periodo } = req.params;
    const data = await leerResultadosDB(proyectoId, periodo);
    res.json(data || []);
  } catch(e) {
    res.status(500).json({ error: e.message });
  }
});

// GET  retrieve persisted results for ALL periodos in one query
router.get('/empresas/:empresaId/proyectos/:proyectoId/all-resultados', async (req, res) => {
  try {
    const { proyectoId } = req.params;
    const rows = await prisma.factura.findMany({
      where: { proyectoId },
      orderBy: { createdAt: 'asc' },
    });
    // Group by periodo
    const grouped = {};
    for (const row of rows) {
      if (!grouped[row.periodo]) grouped[row.periodo] = [];
      grouped[row.periodo].push(row);
    }
    res.json(grouped);
  } catch (e) {
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

    const archivosData = await Promise.all(
      fileList
        .filter(f => isSupported(f.name))
        .map(f =>
          supabaseService.downloadFile(`${folderPath}/${f.name}`)
            .then(buffer => ({ buffer, mimeType: getMimeType(f.name), filename: f.name }))
        )
    );

    const [resultados, meta = {}] = await Promise.all([
      facturaService.analizarMultipleArchivos(archivosData),
      proyectoService.getMetadata(empresaId, proyectoId),
    ]);
    const resultadosConFecha = resultados.map(r => ({
      ...r,
      fecha_ejecucion: calcularFechaEjecucion(r.tipo_comprobante, r.fecha, meta.fecha_presentacion),
    }));
    await guardarResultadosDB(proyectoId, periodo, resultadosConFecha);
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
      const archivosData = await Promise.all(
        (fileList || [])
          .filter(f => isSupported(f.name))
          .map(f =>
            supabaseService.downloadFile(`${folderPath}/${f.name}`)
              .then(buffer => ({ buffer, mimeType: getMimeType(f.name), filename: f.name }))
          )
      );
      const parsedStats = await facturaService.analizarMultipleArchivos(archivosData);
      await guardarResultadosDB(proyectoId, periodo, parsedStats);
      resultados = await leerResultadosDB(proyectoId, periodo);
    }
    if (!resultados.length) return res.status(404).json({ error: 'No hay facturas procesadas' });

    const [meta = {}, empresaInfo] = await Promise.all([
      proyectoService.getMetadata(empresaId, proyectoId),
      empresaService.getById(empresaId).catch(() => null),
    ]);
    const fechaBalance = empresaInfo?.fecha_balance || null;

    const timestamp = new Date().toISOString().replace(/[-:T]/g, '').substring(0, 15);
    const nombre = `cuadro_inversiones_${empresaId}_${periodo}_${timestamp}.xlsx`;
    const ruta = path.join(TMP_DIR, nombre);

    let cotizacion_usd = meta.cotizacion_usd;
    let cotizacion_ui = meta.cotizacion_ui;
    let fecha_cotizacion = meta.fecha_cotizacion || null;
    if (!cotizacion_usd || !cotizacion_ui) {
      try {
        const cot = await cotizacionService.getCotizacionMesAnterior();
        if (!cotizacion_usd) cotizacion_usd = cot.valor_usd;
        if (!cotizacion_ui) cotizacion_ui = cot.valor_ui;
        if (!fecha_cotizacion) fecha_cotizacion = cot.fecha;
      } catch { }
    }

    await excelService.generarExcelComap(resultados, ruta, {
      cotizacion_usd,
      cotizacion_ui,
      fecha_cotizacion,
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
      { header: 'moneda (UYU o USD)', key: 'moneda', width: 16 },
      { header: 'cantidad', key: 'cantidad', width: 10 },
      { header: 'categoria', key: 'categoria', width: 28 },
      { header: 'tipo_comprobante (Factura o Presupuesto)', key: 'tipo_comprobante', width: 32 },
      { header: 'fecha_ejecucion (opcional, YYYY-MM-DD)', key: 'fecha_ejecucion', width: 30 },
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
    const { empresaId, proyectoId, periodo } = req.params;
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
      const tipo_comprobante = row.getCell(10).text?.trim() || null;
      const fechaEjecucionRaw = row.getCell(11).value;
      const fecha_ejecucion_excel = fechaEjecucionRaw instanceof Date
        ? formatearFecha(fechaEjecucionRaw)
        : (typeof fechaEjecucionRaw === 'string' ? fechaEjecucionRaw.trim() || null : null);

      if (!descripcion && !numero_factura && !proveedor && !monto) return;

      nuevas.push({
        descripcion, numero_factura, proveedor, rut, fecha,
        monto, moneda, cantidad, categoria, tipo_comprobante,
        fecha_ejecucion: fecha_ejecucion_excel,
        texto_extraido: false,
      });
    });

    const meta = await proyectoService.getMetadata(empresaId, proyectoId) || {};
    const nuevasConFecha = nuevas.map(r => ({
      ...r,
      fecha_ejecucion: r.fecha_ejecucion || calcularFechaEjecucion(r.tipo_comprobante, r.fecha, meta.fecha_presentacion),
    }));

    const existentes = await leerResultadosDB(proyectoId, periodo);
    await guardarResultadosDB(proyectoId, periodo, [...existentes, ...nuevasConFecha]);
    const updated = await leerResultadosDB(proyectoId, periodo);
    res.json(updated);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: e.message });
  }
});

// PATCH  update execution year of a single factura
router.patch('/empresas/:empresaId/proyectos/:proyectoId/facturas/:facturaId/fecha-ejecucion', async (req, res) => {
  try {
    const { proyectoId, facturaId } = req.params;
    const { anio } = req.body;

    const anioInt = parseInt(anio);
    if (!anio || isNaN(anioInt) || anioInt < 2000 || anioInt > 2100) {
      return res.status(400).json({ error: 'anio debe ser un año válido' });
    }

    const factura = await prisma.factura.findFirst({ where: { id: facturaId, proyectoId } });
    if (!factura) return res.status(404).json({ error: 'Factura no encontrada' });

    // Conserva mes y día existentes, solo cambia el año
    let nuevaFechaEjecucion;
    if (factura.fecha_ejecucion) {
      const partes = factura.fecha_ejecucion.split('-');
      nuevaFechaEjecucion = `${anioInt}-${partes[1] || '01'}-${partes[2] || '01'}`;
    } else {
      nuevaFechaEjecucion = `${anioInt}-01-01`;
    }

    const updated = await prisma.factura.update({
      where: { id: facturaId },
      data: { fecha_ejecucion: nuevaFechaEjecucion },
    });
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
    const supported = (req.files || []).filter(f => isSupported(f.originalname));
    const subidos = await Promise.all(
      supported.map(f =>
        supabaseService.uploadFile(`simple_uploads/${f.originalname}`, f.buffer, f.mimetype)
          .then(() => f.originalname)
      )
    );
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
    const archivosData = await Promise.all(
      (fileList || [])
        .filter(f => f.name !== '_resultados.json' && isSupported(f.name))
        .map(f =>
          supabaseService.downloadFile(`simple_uploads/${f.name}`)
            .then(buffer => ({ buffer, mimeType: getMimeType(f.name), filename: f.name }))
        )
    );

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
       const archivosData = await Promise.all(
         (fileList || [])
           .filter(f => f.name !== '_resultados.json' && isSupported(f.name))
           .map(f =>
             supabaseService.downloadFile(`simple_uploads/${f.name}`)
               .then(buffer => ({ buffer, mimeType: getMimeType(f.name), filename: f.name }))
           )
       );
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
    const copyResults = await Promise.allSettled(
      resultadosSimples
        .filter(r => r.archivo)
        .map(r =>
          supabaseService.downloadFile(`simple_uploads/${r.archivo}`)
            .then(srcBuf =>
              supabaseService.uploadFile(`${folderPath}/${r.archivo}`, srcBuf, getMimeType(r.archivo))
            )
        )
    );
    const copiados = copyResults.filter(r => r.status === 'fulfilled').length;

    const [meta = {}, resultadosDestino = []] = await Promise.all([
      proyectoService.getMetadata(empresaId, proyectoId),
      leerResultadosDB(proyectoId, periodo),
    ]);
    const simplesConFecha = resultadosSimples.map(r => ({
      ...r,
      fecha_ejecucion: r.fecha_ejecucion || calcularFechaEjecucion(r.tipo_comprobante, r.fecha, meta.fecha_presentacion),
    }));
    const destinoMap = new Map(resultadosDestino.map(r => [r.archivo, r]));

    for (const r of simplesConFecha) {
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
