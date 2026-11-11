const { Router } = require('express');
const multer = require('multer');
const fs = require('fs');
const path = require('path');
const os = require('os');
const facturaService = require('./factura.service');
const excelService = require('./excel.service');
const proyectoService = require('../proyecto/proyecto.service');
const empresaService = require('../empresa/empresa.service');
const storageService = require('../../config/s3.config');
const prisma = require('../../config/prisma');
const cotizacionService = require('../cotizacion/cotizacion.service');
const {
  formatearFecha,
  toFechaDDMMYYYY,
  normalizarTipoComprobante,
} = require('../../common/utils/normalize');

const { requireEscritura } = require('../../middleware/acceso.middleware');
const { puedeEscribir } = require('../../common/constants/permisos');

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

/** Monto como número; 0 es un monto válido (antes se guardaba como null) */
function aMonto(val) {
  if (val == null || val === '') return null;
  const n = parseFloat(val);
  return Number.isNaN(n) ? null : n;
}

/**
 * Convierte un comprobante (de la IA, del Excel o editado en pantalla) a las
 * columnas de Factura. Si falta fecha de ejecución se usa la del comprobante.
 */
function aFilaFactura(r) {
  return {
    archivo: r.archivo || null,
    descripcion: r.descripcion || null,
    numero_factura: r.numero_factura || null,
    proveedor: r.proveedor || null,
    rut: r.rut || null,
    fecha: toFechaDDMMYYYY(r.fecha),
    monto: aMonto(r.monto),
    moneda: r.moneda || null,
    cantidad: r.cantidad ? parseInt(r.cantidad) : 1,
    categoria: r.categoria || null,
    rut_receptor: r.rut_receptor || null,
    razon_social_receptor: r.razon_social_receptor || null,
    tipo_comprobante: normalizarTipoComprobante(r.tipo_comprobante),
    fecha_ejecucion: toFechaDDMMYYYY(r.fecha_ejecucion) || toFechaDDMMYYYY(r.fecha),
    texto_extraido: Boolean(r.texto_extraido),
  };
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
      const data = { proyectoId, periodo, ...aFilaFactura(r) };
      if (r.id) {
        return tx.factura.upsert({
          where: { id: r.id },
          update: data,
          create: { id: r.id, ...data },
        });
      }
      return tx.factura.create({ data });
    }));
  }, { timeout: 30000 });
}

/** Read persisted results from db */
async function leerResultadosDB(proyectoId, periodo) {
  return prisma.factura.findMany({
    where: { proyectoId, periodo },
    orderBy: { createdAt: 'asc' }
  });
}

// ── Project-scoped invoice endpoints ─────────────────────

// POST  upload + process files (appends to existing results)
router.post('/empresas/:empresaId/proyectos/:proyectoId/:periodo/subir-y-procesar', requireEscritura('facturas'), upload.array('files'), async (req, res) => {
  try {
    const { empresaId, proyectoId, periodo } = req.params;
    const folderPath = `proyectos/${empresaId}/${proyectoId}/${periodo}`;

    const supported = (req.files || []).filter(f => isSupported(f.originalname));
    await Promise.all(
      supported.map(f =>
        storageService.uploadFile(`${folderPath}/${f.originalname}`, f.buffer, f.mimetype)
      )
    );
    const archivosData = supported.map(f => ({
      buffer: f.buffer,
      mimeType: getMimeType(f.originalname),
      filename: f.originalname,
    }));

    if (!archivosData.length) {
      return res.json({ comprobantes: await leerResultadosDB(proyectoId, periodo), errores: [] });
    }

    const empresa = await empresaService.getById(empresaId).catch(() => null);
    const { comprobantes, errores } = await facturaService.analizarMultipleArchivos(archivosData, { empresa });

    // Un archivo que no se pudo leer igual queda como comprobante, vacío y con
    // su archivo, para reprocesarlo o completarlo a mano sin volver a subirlo
    const sinLeer = errores.map(e => ({ archivo: e.archivo, texto_extraido: false }));
    const nuevos = [...comprobantes, ...sinLeer];
    if (nuevos.length > 0) {
      await prisma.factura.createMany({
        data: nuevos.map(r => ({ proyectoId, periodo, ...aFilaFactura(r) })),
      });
    }

    res.json({ comprobantes: await leerResultadosDB(proyectoId, periodo), errores });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: e.message });
  }
});

// POST  reprocess specific files (returns new data without saving; los que fallan van en `errores`)
router.post('/empresas/:empresaId/proyectos/:proyectoId/:periodo/reprocesar', requireEscritura('facturas'), async (req, res) => {
  try {
    const { empresaId, proyectoId, periodo } = req.params;
    const { archivos } = req.body;

    if (!Array.isArray(archivos) || !archivos.length) {
      return res.status(400).json({ error: 'archivos debe ser un array no vacío' });
    }

    const folderPath = `proyectos/${empresaId}/${proyectoId}/${periodo}`;
    const downloadResults = await Promise.allSettled(
      archivos.map(filename =>
        storageService.downloadFile(`${folderPath}/${filename}`)
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

    const empresa = await empresaService.getById(empresaId).catch(() => null);
    const { comprobantes, errores } = await facturaService.analizarMultipleArchivos(archivosData, { empresa });
    res.json({ comprobantes, errores });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: e.message });
  }
});

// ── PDF de un comprobante ────────────────────────────────

/** Comprobante del proyecto, o null si no existe o es de otro proyecto */
function buscarFactura(proyectoId, facturaId) {
  return prisma.factura.findFirst({ where: { id: facturaId, proyectoId } });
}

/** Clave en S3 del archivo de un comprobante (misma convención que subir-y-procesar) */
function claveArchivo(empresaId, proyectoId, periodo, archivo) {
  return `proyectos/${empresaId}/${proyectoId}/${periodo}/${archivo}`;
}

/** Content-Disposition con el nombre original, también si tiene tildes o eñes */
function disposicion(tipo, nombre) {
  const ascii = nombre.replace(/[^\x20-\x7E]/g, '_').replace(/["\\]/g, '_');
  const utf8 = encodeURIComponent(nombre).replace(/['()*]/g, (c) => `%${c.charCodeAt(0).toString(16).toUpperCase()}`);
  return `${tipo}; filename="${ascii}"; filename*=UTF-8''${utf8}`;
}

/**
 * Nombre libre para un archivo nuevo en la carpeta del período: si otro
 * comprobante ya usa ese nombre (un PDF puede traer varios comprobantes) se le
 * agrega " (2)", " (3)"... para no pisarle el archivo.
 */
async function nombreLibre(proyectoId, periodo, facturaId, original) {
  const limpio = path.basename(original).replace(/[\\/]/g, '_');
  const ext = path.extname(limpio);
  const base = limpio.slice(0, limpio.length - ext.length);
  const usados = new Set(
    (await prisma.factura.findMany({
      where: { proyectoId, periodo, archivo: { not: null }, id: { not: facturaId } },
      select: { archivo: true },
    })).map((f) => f.archivo)
  );
  let nombre = limpio;
  for (let n = 2; usados.has(nombre); n++) nombre = `${base} (${n})${ext}`;
  return nombre;
}

// GET  link temporal para ver (?modo=ver) o bajar el archivo de un comprobante.
// Devuelve { url, nombre }: el navegador va directo a S3 con una URL firmada,
// así el archivo no pasa por el backend (y no choca con el límite de Vercel).
router.get('/empresas/:empresaId/proyectos/:proyectoId/facturas/:facturaId/archivo', async (req, res) => {
  try {
    const { empresaId, proyectoId, facturaId } = req.params;
    const factura = await buscarFactura(proyectoId, facturaId);
    if (!factura) return res.status(404).json({ error: 'Comprobante no encontrado' });
    if (!factura.archivo) return res.status(404).json({ error: 'Este comprobante no tiene archivo' });

    const key = claveArchivo(empresaId, proyectoId, factura.periodo, factura.archivo);
    if (!(await storageService.exists(key))) {
      return res.status(404).json({ error: 'No encontramos el archivo guardado. Podés volver a subirlo.' });
    }

    const tipo = req.query.modo === 'ver' ? 'inline' : 'attachment';
    const url = await storageService.getSignedUrl(key, 300, {
      disposition: disposicion(tipo, factura.archivo),
      contentType: getMimeType(factura.archivo),
    });
    res.json({ url, nombre: factura.archivo });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: e.message });
  }
});

// POST  adjuntar (o reemplazar) el archivo de un comprobante. No vuelve a leer
// los datos: sólo guarda el PDF y lo vincula. Devuelve los comprobantes del período.
router.post('/empresas/:empresaId/proyectos/:proyectoId/facturas/:facturaId/archivo', requireEscritura('facturas'), upload.single('file'), async (req, res) => {
  try {
    const { empresaId, proyectoId, facturaId } = req.params;
    if (!req.file?.buffer) return res.status(400).json({ error: 'No se recibió archivo' });
    if (!isSupported(req.file.originalname)) {
      return res.status(400).json({ error: 'El archivo tiene que ser PDF o imagen (PNG, JPG, WEBP)' });
    }

    const factura = await buscarFactura(proyectoId, facturaId);
    if (!factura) return res.status(404).json({ error: 'Comprobante no encontrado' });

    const nombre = await nombreLibre(proyectoId, factura.periodo, factura.id, req.file.originalname);
    await storageService.uploadFile(
      claveArchivo(empresaId, proyectoId, factura.periodo, nombre),
      req.file.buffer,
      getMimeType(nombre)
    );
    await prisma.factura.update({ where: { id: factura.id }, data: { archivo: nombre } });

    res.json(await leerResultadosDB(proyectoId, factura.periodo));
  } catch (e) {
    console.error(e);
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
router.put('/empresas/:empresaId/proyectos/:proyectoId/:periodo', requireEscritura('facturas'), async (req, res) => {
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

// POST  export Excel
router.post('/empresas/:empresaId/proyectos/:proyectoId/:periodo/excel', async (req, res) => {
  try {
    const { empresaId, proyectoId, periodo } = req.params;

    let resultados = await leerResultadosDB(proyectoId, periodo);
    if (!resultados || !resultados.length) {
      const folderPath = `proyectos/${empresaId}/${proyectoId}/${periodo}`;
      const fileList = await storageService.listFiles(folderPath);
      const archivosData = await Promise.all(
        (fileList || [])
          .filter(f => isSupported(f.name))
          .map(f =>
            storageService.downloadFile(`${folderPath}/${f.name}`)
              .then(buffer => ({ buffer, mimeType: getMimeType(f.name), filename: f.name }))
          )
      );
      const empresa = await empresaService.getById(empresaId).catch(() => null);
      const { comprobantes: parsedStats } = await facturaService.analizarMultipleArchivos(archivosData, { empresa });
      if (puedeEscribir(req.acceso, 'facturas')) {
        await guardarResultadosDB(proyectoId, periodo, parsedStats);
        resultados = await leerResultadosDB(proyectoId, periodo);
      } else {
        // Sin permiso de escritura no persistimos, pero el Excel se genera
        // igual: normalizamos las fechas como lo haria guardarResultadosDB
        // para que el archivo salga identico.
        resultados = parsedStats.map(aFilaFactura);
      }
    }
    if (!resultados.length) return res.status(404).json({ error: 'No hay facturas procesadas' });

    const [meta = {}, empresaInfo] = await Promise.all([
      proyectoService.getMetadata(empresaId, proyectoId),
      empresaService.getById(empresaId).catch(() => null),
    ]);
    const fechaBalance = empresaInfo?.fecha_balance || null;

    const timestamp = new Date().toISOString().replace(/[-:T]/g, '').substring(0, 15);
    // `periodo` y `empresaId` van a un nombre de archivo local y path.join
    // normaliza los '..', asi que se escaparian de TMP_DIR. Para los valores
    // reales ('presentacion', 'control_1', el id de empresa) esto no cambia nada.
    const safe = (v) => String(v).replace(/[^A-Za-z0-9_-]/g, '');
    const nombre = `cuadro_inversiones_${safe(empresaId)}_${safe(periodo)}_${timestamp}.xlsx`;
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
      anio_presentacion: meta.anio_presentacion,
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
      { header: 'fecha_ejecucion (DD/MM/YYYY)', key: 'fecha_ejecucion', width: 30 },
    ];
    ws.getColumn(5).numFmt = 'DD/MM/YYYY';
    ws.getRow(1).font = { bold: true };

    // Lista desplegable para tipo_comprobante (columna J)
    for (let i = 2; i <= 1000; i++) {
      ws.getCell(`J${i}`).dataValidation = {
        type: 'list',
        allowBlank: true,
        formulae: ['"Factura,Presupuesto"'],
        showErrorMessage: true,
        errorStyle: 'stop',
        errorTitle: 'Tipo inválido',
        error: 'Elegí Factura o Presupuesto',
      };
    }

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
router.post('/empresas/:empresaId/proyectos/:proyectoId/:periodo/importar', requireEscritura('facturas'), upload.single('file'), async (req, res) => {
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
      const tipo_comprobante = normalizarTipoComprobante(row.getCell(10).text);
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

    const nuevasConFecha = nuevas.map(r => ({
      ...r,
      fecha_ejecucion: r.fecha_ejecucion || r.fecha,
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

module.exports = router;
