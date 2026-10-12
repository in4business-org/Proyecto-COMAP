const { CHECKLIST_PRESENTACION } = require('../../common/constants/checklist-items');
const {
  PREGUNTAS_CHECKLIST,
  normalizarRespuestas,
  aplicarRespuestas,
} = require('../../common/constants/checklist-preguntas');
const prisma = require('../../config/prisma');

class ChecklistService {
  async getChecklist(empresaId, proyectoId) {
    const [items, respuestas] = await Promise.all([
      prisma.checklistItem.findMany({ where: { proyectoId, periodo: 'presentacion' } }),
      this.getRespuestas(proyectoId),
    ]);
    const estados = {};
    for (const item of items) {
        estados[item.item_id] = item;
    }
    
    const armados = CHECKLIST_PRESENTACION.map(item => ({
      ...item,
      estado: estados[item.id]?.estado || 'pendiente',
      archivo: estados[item.id]?.archivo || null,
      nota_usuario: estados[item.id]?.nota_usuario || ''
    }));
    // Las respuestas de "Antes de empezar" marcan como 'no_aplica' los ítems
    // condicionales. Se calcula acá y no se guarda en cada ítem: cambiar una
    // respuesta se deshace solo y no pisa lo que se marcó a mano.
    return aplicarRespuestas(armados, respuestas);
  }

  /** Respuestas de "Antes de empezar" del proyecto: { pregunta: true | false } */
  async getRespuestas(proyectoId) {
    const p = await prisma.proyecto.findUnique({
      where: { id: proyectoId },
      select: { perfil_checklist: true },
    });
    return normalizarRespuestas(p?.perfil_checklist);
  }

  async guardarRespuestas(proyectoId, respuestas) {
    const limpias = normalizarRespuestas(respuestas);
    await prisma.proyecto.update({
      where: { id: proyectoId },
      data: { perfil_checklist: limpias },
    });
    return limpias;
  }

  /** Preguntas (con los ítems que afectan) y respuestas, para la pantalla */
  async getPerfil(proyectoId) {
    return { preguntas: PREGUNTAS_CHECKLIST, respuestas: await this.getRespuestas(proyectoId) };
  }

  async actualizarItem(empresaId, proyectoId, itemId, estado, notaUsuario = '') {
    try {
        await prisma.checklistItem.upsert({
            where: {
                proyectoId_periodo_item_id: {
                    proyectoId,
                    periodo: 'presentacion',
                    item_id: itemId
                }
            },
            update: { estado, nota_usuario: notaUsuario },
            create: {
                proyectoId,
                periodo: 'presentacion',
                item_id: itemId,
                estado,
                nota_usuario: notaUsuario
            }
        });
        return true;
    } catch(e) {
        return false;
    }
  }

  async guardarArchivo(empresaId, proyectoId, itemId, filename) {
    try {
        await prisma.checklistItem.upsert({
            where: {
                proyectoId_periodo_item_id: {
                    proyectoId,
                    periodo: 'presentacion',
                    item_id: itemId
                }
            },
            update: { archivo: filename, estado: 'completado' },
            create: {
                proyectoId,
                periodo: 'presentacion',
                item_id: itemId,
                archivo: filename,
                estado: 'completado'
            }
        });
        return true;
    } catch(e) {
        return false;
    }
  }

  async getArchivoPath(empresaId, proyectoId, itemId) {
    const item = await prisma.checklistItem.findUnique({
        where: {
            proyectoId_periodo_item_id: {
                proyectoId,
                periodo: 'presentacion',
                item_id: itemId
            }
        }
    });

    if (!item || !item.archivo) return null;
    return item.archivo;
  }

  getUploadPath(empresaId, proyectoId, itemId) {
    const itemDef = CHECKLIST_PRESENTACION.find(i => i.id === itemId);
    const seccion = itemDef ? itemDef.seccion : 'otros';
    const descripcionCorta = itemDef ? itemDef.descripcion.substring(0, 60).trimEnd() : itemId;
    const nombreCarpeta = `${itemId} ${descripcionCorta}`;
    return { seccion, nombreCarpeta };
  }
}

module.exports = new ChecklistService();
