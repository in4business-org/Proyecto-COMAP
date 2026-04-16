const { tool } = require('ai');
const { z } = require('zod');
const empresaService = require('../empresa/empresa.service');
const proyectoService = require('../proyecto/proyecto.service');
const checklistService = require('../checklist/checklist.service');
const cotizacionService = require('../cotizacion/cotizacion.service');
const simuladorService = require('../simulador/simulador.service');
const prisma = require('../../config/prisma');

const obtener_empresa = tool({
  description: 'Obtiene los datos de una empresa por su ID. Usar cuando el cliente quiere ver información de su empresa.',
  parameters: z.object({
    empresaId: z.string().describe('ID de la empresa'),
  }),
  execute: async ({ empresaId }) => {
    const empresa = await empresaService.getById(empresaId);
    if (!empresa) return { error: 'Empresa no encontrada' };
    return {
      nombre: empresa.nombre,
      rut: empresa.rut,
      razon_social: empresa.razon_social,
      email: empresa.email,
      telefono: empresa.telefono,
      giro: empresa.giro,
      domicilio_fiscal: empresa.domicilio_fiscal,
      codigo_ciiu: empresa.codigo_ciiu,
      tipo_contribuyente: empresa.tipo_contribuyente,
    };
  },
});

const listar_proyectos = tool({
  description: 'Lista todos los proyectos de inversión de una empresa. Usar cuando el cliente pregunta por sus proyectos.',
  parameters: z.object({
    empresaId: z.string().describe('ID de la empresa'),
  }),
  execute: async ({ empresaId }) => {
    const proyectos = await proyectoService.listar(empresaId);
    if (!proyectos || proyectos.length === 0) {
      return { mensaje: 'No se encontraron proyectos para esta empresa', proyectos: [] };
    }
    return {
      total: proyectos.length,
      proyectos: proyectos.map(p => ({
        id: p.id,
        expediente: p.expediente || 'Sin expediente',
        fecha_creacion: p.fecha_creacion,
        fecha_presentacion: p.fecha_presentacion || 'No definida',
        anio_presentacion: p.anio_presentacion,
        duracion_seguimiento: p.duracion_seguimiento,
        cotizacion_ui: p.cotizacion_ui,
        cotizacion_usd: p.cotizacion_usd,
      })),
    };
  },
});

const ver_checklist = tool({
  description: 'Ve el checklist documental de un proyecto con el estado de cada item (completado o pendiente). Usar cuando el cliente pregunta qué documentos tiene o qué le falta.',
  parameters: z.object({
    empresaId: z.string().describe('ID de la empresa'),
    proyectoId: z.string().describe('ID del proyecto'),
  }),
  execute: async ({ empresaId, proyectoId }) => {
    const items = await checklistService.getChecklist(empresaId, proyectoId);
    const completados = items.filter(i => i.estado === 'completado');
    const pendientes = items.filter(i => i.estado === 'pendiente');
    return {
      total: items.length,
      completados: completados.length,
      pendientes: pendientes.length,
      items: items.map(i => ({
        id: i.id,
        seccion: i.seccion,
        descripcion: i.descripcion,
        estado: i.estado,
        archivo: i.archivo ? 'Sí' : 'No',
        nota: i.nota_usuario || '',
      })),
    };
  },
});

const actualizar_item_checklist = tool({
  description: 'Actualiza el estado de un item del checklist (completado o pendiente). Usar cuando el cliente quiere marcar un documento como completado o pendiente.',
  parameters: z.object({
    empresaId: z.string().describe('ID de la empresa'),
    proyectoId: z.string().describe('ID del proyecto'),
    itemId: z.string().describe('ID del item del checklist'),
    estado: z.enum(['completado', 'pendiente']).describe('Nuevo estado del item'),
    nota: z.string().optional().describe('Nota opcional del usuario'),
  }),
  execute: async ({ empresaId, proyectoId, itemId, estado, nota }) => {
    const ok = await checklistService.actualizarItem(empresaId, proyectoId, itemId, estado, nota || '');
    if (!ok) return { error: 'No se pudo actualizar el item' };
    return { exito: true, mensaje: `Item ${itemId} actualizado a "${estado}"` };
  },
});

const ver_facturas_periodo = tool({
  description: 'Lista las facturas procesadas de un periodo específico de un proyecto. Los periodos pueden ser "presentacion" o "control_YYYY" (ej: control_2026).',
  parameters: z.object({
    proyectoId: z.string().describe('ID del proyecto'),
    periodo: z.string().describe('Periodo a consultar (ej: presentacion, control_2026)'),
  }),
  execute: async ({ proyectoId, periodo }) => {
    const facturas = await prisma.factura.findMany({
      where: { proyectoId, periodo },
      orderBy: { createdAt: 'desc' },
    });
    if (facturas.length === 0) {
      return { mensaje: `No hay facturas para el periodo "${periodo}"`, facturas: [] };
    }
    return {
      periodo,
      total: facturas.length,
      facturas: facturas.map(f => ({
        id: f.id,
        archivo: f.archivo,
        proveedor: f.proveedor || 'Sin proveedor',
        numero_factura: f.numero_factura || 'S/N',
        fecha: f.fecha || 'Sin fecha',
        monto: f.monto,
        moneda: f.moneda || 'UYU',
        categoria: f.categoria || 'Sin categoría',
        tipo_comprobante: f.tipo_comprobante,
      })),
    };
  },
});

const ver_todas_facturas = tool({
  description: 'Lista todas las facturas de todos los periodos de un proyecto, agrupadas por periodo.',
  parameters: z.object({
    proyectoId: z.string().describe('ID del proyecto'),
  }),
  execute: async ({ proyectoId }) => {
    const facturas = await prisma.factura.findMany({
      where: { proyectoId },
      orderBy: { createdAt: 'desc' },
    });
    const porPeriodo = {};
    for (const f of facturas) {
      const p = f.periodo || 'sin_periodo';
      if (!porPeriodo[p]) porPeriodo[p] = [];
      porPeriodo[p].push({
        id: f.id,
        archivo: f.archivo,
        proveedor: f.proveedor || 'Sin proveedor',
        numero_factura: f.numero_factura || 'S/N',
        fecha: f.fecha,
        monto: f.monto,
        moneda: f.moneda || 'UYU',
        categoria: f.categoria,
      });
    }
    return {
      total: facturas.length,
      periodos: Object.entries(porPeriodo).map(([periodo, facts]) => ({
        periodo,
        cantidad: facts.length,
        facturas: facts,
      })),
    };
  },
});

const obtener_cotizacion = tool({
  description: 'Obtiene la cotización del dólar (USD) y la Unidad Indexada (UI) del mes anterior a una fecha dada. Si no se da fecha, usa la fecha actual.',
  parameters: z.object({
    fecha: z.string().optional().describe('Fecha de referencia en formato YYYY-MM-DD (opcional, por defecto hoy)'),
  }),
  execute: async ({ fecha }) => {
    try {
      const cotizacion = await cotizacionService.getCotizacionMesAnterior(fecha || null);
      return {
        fecha: cotizacion.fecha,
        valor_usd: cotizacion.valor_usd,
        valor_ui: cotizacion.valor_ui,
      };
    } catch (e) {
      return { error: e.message };
    }
  },
});

const ver_resultados_simulador = tool({
  description: 'Obtiene los resultados del simulador de beneficios fiscales de un proyecto (puntaje, exoneración IRAE, etc.).',
  parameters: z.object({
    empresaId: z.string().describe('ID de la empresa'),
    proyectoId: z.string().describe('ID del proyecto'),
  }),
  execute: async ({ empresaId, proyectoId }) => {
    const resultados = await simuladorService.getResultados(empresaId, proyectoId);
    if (!resultados || Object.keys(resultados).length === 0) {
      return { mensaje: 'No hay resultados del simulador para este proyecto. El simulador aún no fue completado.' };
    }
    return resultados;
  },
});

const buscar_empresa = tool({
  description: 'Busca empresas por nombre parcial o RUT. Usar cuando el usuario quiere vincularse a una empresa y necesita encontrarla. Devuelve una lista de empresas que coinciden. El parámetro se llama "query".',
  parameters: z.object({
    query: z.string().optional().describe('Texto de búsqueda: nombre parcial o RUT de la empresa'),
  }).passthrough(),
  execute: async (rawInput) => {
    // Gemini sometimes renames parameters — grab any string value
    const searchRaw = rawInput.query || rawInput.busqueda || rawInput.nombre_parcial || rawInput.nombre || rawInput.search || rawInput.rut
      || Object.values(rawInput).find(v => typeof v === 'string') || '';
    const cleanSearch = String(searchRaw).replace(/["""'']/g, '').trim();
    console.log(`[buscar_empresa] Buscando: "${cleanSearch}" (raw input: ${JSON.stringify(rawInput)})`);

    if (!cleanSearch) {
      const all = await prisma.empresa.findMany({ take: 20 });
      return {
        mensaje: 'No se proporcionó texto de búsqueda. Estas son las empresas disponibles:',
        total: all.length,
        empresas: all.map(e => ({ id: e.id, nombre: e.nombre, rut: e.rut, razon_social: e.razon_social || e.nombre })),
      };
    }

    // Search by name (case-insensitive contains) or RUT
    let empresas = await prisma.empresa.findMany({
      where: {
        OR: [
          { nombre: { contains: cleanSearch, mode: 'insensitive' } },
          { razon_social: { contains: cleanSearch, mode: 'insensitive' } },
          { rut: { contains: cleanSearch, mode: 'insensitive' } },
          { id: { contains: cleanSearch, mode: 'insensitive' } },
        ],
      },
      take: 10,
    });

    // If no results, try searching each word separately
    if (empresas.length === 0 && cleanSearch.includes(' ')) {
      const words = cleanSearch.split(/[\s_]+/).filter(w => w.length > 2);
      for (const word of words) {
        empresas = await prisma.empresa.findMany({
          where: {
            OR: [
              { nombre: { contains: word, mode: 'insensitive' } },
              { razon_social: { contains: word, mode: 'insensitive' } },
            ],
          },
          take: 10,
        });
        if (empresas.length > 0) break;
      }
    }

    // If still nothing, list all empresas so the user can pick
    if (empresas.length === 0) {
      empresas = await prisma.empresa.findMany({ take: 20 });
      if (empresas.length > 0) {
        return {
          mensaje: `No encontré empresas con "${cleanSearch}", pero estas son las empresas disponibles:`,
          total: empresas.length,
          empresas: empresas.map(e => ({ id: e.id, nombre: e.nombre, rut: e.rut, razon_social: e.razon_social || e.nombre })),
        };
      }
      return { mensaje: 'No hay empresas registradas en el sistema.', empresas: [] };
    }

    return {
      total: empresas.length,
      empresas: empresas.map(e => ({ id: e.id, nombre: e.nombre, rut: e.rut, razon_social: e.razon_social || e.nombre })),
    };
  },
});

const vincular_empresa = tool({
  description: 'Vincula al usuario actual con una empresa. Usar después de confirmar con el usuario qué empresa quiere. Requiere userId y empresaId.',
  parameters: z.object({
    userId: z.string().optional().describe('ID del usuario actual (viene del contexto)'),
    empresaId: z.string().optional().describe('ID de la empresa a vincular'),
  }).passthrough(),
  execute: async (rawInput) => {
    // Gemini sometimes renames parameters
    const userId = rawInput.userId || rawInput.user_id || Object.values(rawInput).find(v => typeof v === 'string');
    const empresaId = rawInput.empresaId || rawInput.empresa_id || rawInput.id_empresa
      || Object.values(rawInput).filter(v => typeof v === 'string' && v !== userId)[0];

    console.log(`[vincular_empresa] userId=${userId}, empresaId=${empresaId} (raw: ${JSON.stringify(rawInput)})`);

    if (!userId || !empresaId) {
      return { error: 'Faltan parámetros: userId y empresaId son requeridos.' };
    }

    // Verify empresa exists
    const empresa = await prisma.empresa.findUnique({ where: { id: empresaId } });
    if (!empresa) return { error: `Empresa no encontrada con ID "${empresaId}"` };

    // Upsert the user-empresa mapping
    await prisma.userEmpresa.upsert({
      where: { userId },
      update: { empresaId },
      create: { userId, empresaId, role: 'cliente' },
    });

    // Also update the current conversation with the empresaId
    const activeConv = await prisma.chatConversation.findFirst({
      where: { userId, status: 'active' },
      orderBy: { updatedAt: 'desc' },
    });
    if (activeConv) {
      await prisma.chatConversation.update({
        where: { id: activeConv.id },
        data: { empresaId },
      });
    }

    return {
      exito: true,
      mensaje: `Usuario vinculado exitosamente a la empresa "${empresa.nombre}" (${empresa.rut}).`,
      empresa: { id: empresa.id, nombre: empresa.nombre, rut: empresa.rut },
    };
  },
});

const derivar_a_gestor = tool({
  description: 'Deriva la conversación a un gestor humano cuando el cliente lo solicita o cuando no podés resolver su consulta.',
  parameters: z.object({
    motivo: z.string().describe('Motivo de la derivación'),
    conversationId: z.string().describe('ID de la conversación actual'),
  }),
  execute: async ({ motivo, conversationId }) => {
    await prisma.chatConversation.update({
      where: { id: conversationId },
      data: { status: 'handed_off' },
    });
    return {
      exito: true,
      mensaje: 'La conversación fue derivada a un gestor humano. Te van a contactar a la brevedad.',
      motivo,
    };
  },
});

module.exports = {
  obtener_empresa,
  listar_proyectos,
  ver_checklist,
  actualizar_item_checklist,
  ver_facturas_periodo,
  ver_todas_facturas,
  obtener_cotizacion,
  ver_resultados_simulador,
  buscar_empresa,
  vincular_empresa,
  derivar_a_gestor,
};
