const crypto = require('crypto');
const prisma = require('../../config/prisma');
const supabaseService = require('../../config/supabase.config');
const { CHECKLIST_PRESENTACION } = require('../../common/constants/checklist-items');
const facturaService = require('../factura/factura.service');

// Extensiones permitidas para comprobantes
const ALLOWED_MIMETYPES = ['application/pdf', 'image/png', 'image/jpeg', 'image/webp'];
const ALLOWED_EXTENSIONS = ['.pdf', '.png', '.jpg', '.jpeg', '.webp'];

class ClienteService {
  // ── Admin ──────────────────────────────────────────────────

  async crearToken(proyectoId, nombre, expira_en) {
    const token = crypto.randomBytes(32).toString('hex');
    return prisma.clienteToken.create({
      data: {
        token,
        proyectoId,
        nombre,
        expira_en: expira_en ? new Date(expira_en) : null,
      },
      select: { id: true, token: true, nombre: true, activo: true, expira_en: true, createdAt: true }
    });
  }

  async listarTokens(proyectoId) {
    return prisma.clienteToken.findMany({
      where: { proyectoId },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        token: true,
        nombre: true,
        activo: true,
        expira_en: true,
        ultimo_uso: true,
        createdAt: true,
      }
    });
  }

  async revocarToken(tokenId, proyectoId) {
    return prisma.clienteToken.update({
      where: { id: tokenId, proyectoId },
      data: { activo: false },
      select: { id: true, activo: true }
    });
  }

  // ── Vista cliente ─────────────────────────────────────────

  async getVistaProyecto(proyectoId, empresaId) {
    const [proyecto, empresa, checklistItems, facturas] = await Promise.all([
      prisma.proyecto.findUnique({ where: { id: proyectoId } }),
      prisma.empresa.findUnique({
        where: { id: empresaId },
        select: { id: true, nombre: true, rut: true }
      }),
      prisma.checklistItem.findMany({ where: { proyectoId } }),
      prisma.factura.findMany({
        where: { proyectoId },
        orderBy: { createdAt: 'asc' }
      }),
    ]);

    // Mapa de estados desde DB
    const estadoMap = {};
    for (const item of checklistItems) {
      estadoMap[`${item.periodo}__${item.item_id}`] = item;
    }

    // Enriquecer ítems con definición estática (solo presentacion por ahora)
    const enriquecidos = CHECKLIST_PRESENTACION.map(def => {
      const dbItem = estadoMap[`presentacion__${def.id}`];
      return {
        id: def.id,
        seccion: def.seccion,
        descripcion: def.descripcion,
        nota: def.nota,
        acepta_archivo: def.acepta_archivo,
        periodo: 'presentacion',
        estado: dbItem?.estado || 'pendiente',
        tiene_archivo: !!(dbItem?.archivo),
        nota_usuario: dbItem?.nota_usuario || '',
      };
    });

    const aplicables = enriquecidos.filter(i => i.estado !== 'no_aplica');
    const total = aplicables.length;
    const completados = aplicables.filter(i => i.estado === 'completado').length;
    const porcentaje = total > 0 ? Math.round((completados / total) * 100) : 0;

    // Solo campos públicos de facturas
    const facturasPublicas = facturas.map(f => ({
      id: f.id,
      periodo: f.periodo,
      proveedor: f.proveedor,
      descripcion: f.descripcion,
      categoria: f.categoria,
      numero_factura: f.numero_factura,
      fecha: f.fecha,
      monto: f.monto,
      moneda: f.moneda,
      fecha_ejecucion: f.fecha_ejecucion,
    }));

    return {
      empresa: { id: empresa.id, nombre: empresa.nombre, rut: empresa.rut },
      proyecto: {
        id: proyecto.id,
        expediente: proyecto.expediente,
        fecha_presentacion: proyecto.fecha_presentacion,
        anio_presentacion: proyecto.anio_presentacion,
        cotizacion_ui: proyecto.cotizacion_ui,
        cotizacion_usd: proyecto.cotizacion_usd,
      },
      progreso: { total, completados, porcentaje },
      checklist: enriquecidos,
      facturas: facturasPublicas,
    };
  }

  async subirFacturaCliente(proyectoId, empresaId, periodo, file) {
    // Validar tipo de archivo
    const ext = '.' + file.originalname.split('.').pop().toLowerCase();
    if (!ALLOWED_EXTENSIONS.includes(ext) || !ALLOWED_MIMETYPES.includes(file.mimetype)) {
      throw new Error('Tipo de archivo no permitido. Use PDF, PNG, JPG o WEBP');
    }

    // Subir a Supabase (misma ruta que facturas normales)
    const filePath = `proyectos/${empresaId}/${proyectoId}/${periodo}/${file.originalname}`;
    await supabaseService.uploadFile(filePath, file.buffer, file.mimetype);

    // Procesar con Gemini
    const items = await facturaService.analizarBuffer(file.buffer, file.mimetype, file.originalname);

    // Persistir cada ítem como Factura
    const creadas = await Promise.all(items.map(item =>
      prisma.factura.create({
        data: {
          proyectoId,
          periodo,
          archivo: filePath,
          descripcion: item.descripcion || null,
          numero_factura: item.numero_factura || null,
          proveedor: item.proveedor || null,
          rut: item.rut || null,
          fecha: item.fecha || null,
          monto: item.monto || null,
          moneda: item.moneda || null,
          cantidad: item.cantidad || 1,
          categoria: item.categoria || null,
          rut_receptor: item.rut_receptor || null,
          razon_social_receptor: item.razon_social_receptor || null,
          tipo_comprobante: item.tipo_comprobante || null,
          texto_extraido: item.texto_extraido ?? true,
        }
      })
    ));

    return creadas.map(f => ({
      id: f.id,
      periodo: f.periodo,
      numero_factura: f.numero_factura,
      proveedor: f.proveedor,
      fecha: f.fecha,
      monto: f.monto,
      moneda: f.moneda,
      tipo_comprobante: f.tipo_comprobante,
      categoria: f.categoria,
    }));
  }

  async subirComprobante(proyectoId, empresaId, itemId, file) {
    // Validar que el ítem existe y acepta archivo
    const itemDef = CHECKLIST_PRESENTACION.find(i => i.id === itemId);
    if (!itemDef) throw new Error('Ítem de checklist no encontrado');
    if (!itemDef.acepta_archivo) throw new Error('Este ítem no acepta archivos');

    // Validar tipo de archivo
    const ext = '.' + file.originalname.split('.').pop().toLowerCase();
    if (!ALLOWED_EXTENSIONS.includes(ext) || !ALLOWED_MIMETYPES.includes(file.mimetype)) {
      throw new Error('Tipo de archivo no permitido. Use PDF, PNG, JPG o WEBP');
    }

    // Construir path igual que el admin (mismo destino en Supabase)
    const seccion = itemDef.seccion;
    const descripcionCorta = itemDef.descripcion.substring(0, 60).trimEnd();
    const nombreCarpeta = `${itemId} ${descripcionCorta}`;
    const folderPath = `proyectos/${empresaId}/${proyectoId}/checklist/${seccion}/${nombreCarpeta}`;
    const filePath = `${folderPath}/${file.originalname}`;

    await supabaseService.uploadFile(filePath, file.buffer, file.mimetype);

    await prisma.checklistItem.upsert({
      where: {
        proyectoId_periodo_item_id: {
          proyectoId,
          periodo: 'presentacion',
          item_id: itemId,
        }
      },
      update: { archivo: filePath, estado: 'completado' },
      create: {
        proyectoId,
        periodo: 'presentacion',
        item_id: itemId,
        archivo: filePath,
        estado: 'completado',
      }
    });

    return { ok: true };
  }
}

module.exports = new ClienteService();
