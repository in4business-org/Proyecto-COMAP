const fs = require('fs');
const path = require('path');
const { PROYECTOS_DIR } = require('../../config/storage.config');
const { CHECKLIST_PRESENTACION } = require('../../common/constants/checklist-items');
const prisma = require('../../config/prisma');

class ChecklistService {
  async getChecklist(empresaId, proyectoId) {
    const items = await prisma.checklistItem.findMany({
        where: { proyectoId, periodo: 'presentacion' }
    });
    const estados = {};
    for (const item of items) {
        estados[item.item_id] = item;
    }
    
    return CHECKLIST_PRESENTACION.map(item => ({
      ...item,
      estado: estados[item.id]?.estado || 'pendiente',
      archivo: estados[item.id]?.archivo || null,
      nota_usuario: estados[item.id]?.nota_usuario || ''
    }));
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
    const carpeta = path.join(PROYECTOS_DIR, empresaId, proyectoId, 'presentacion', 'documentos');
    const ruta = path.join(carpeta, item.archivo);
    if (!fs.existsSync(ruta)) return null;
    return { ruta, nombre: path.basename(item.archivo) };
  }

  getUploadPath(empresaId, proyectoId, itemId) {
    const itemDef = CHECKLIST_PRESENTACION.find(i => i.id === itemId);
    const seccion = itemDef ? itemDef.seccion : 'otros';
    const descripcionCorta = itemDef ? itemDef.descripcion.substring(0, 60).trimEnd() : itemId;
    const nombreCarpeta = `${itemId} ${descripcionCorta}`;
    const carpetaBase = path.join(PROYECTOS_DIR, empresaId, proyectoId, 'presentacion', 'documentos');
    return { carpetaBase, seccion, nombreCarpeta };
  }
}

module.exports = new ChecklistService();
