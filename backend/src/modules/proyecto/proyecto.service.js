const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const { PROYECTOS_DIR, TEMPLATES_DIR } = require('../../config/storage.config');
const { CHECKLIST_PRESENTACION } = require('../../common/constants/checklist-items');
const prisma = require('../../config/prisma');

class ProyectoService {
  async crear(empresaId, anioPresentacion, duracionSeguimiento, fechaPresentacion = null) {
    const fechaHoy = new Date().toISOString().split('T')[0];
    const proyectoId = `${fechaHoy}_${crypto.randomUUID().substring(0, 6)}`;
    
    const periodos = ['presentacion'];
    for (let i = 1; i <= duracionSeguimiento; i++) {
        periodos.push(`control_${anioPresentacion + i}`);
    }

    // Prepare checklist models
    const checklistsToCreate = CHECKLIST_PRESENTACION.map(item => ({
        periodo: 'presentacion',
        item_id: item.id,
        estado: 'pendiente',
        archivo: null,
        nota_usuario: ''
    }));

    // Save project recursively in DB
    await prisma.proyecto.create({
        data: {
            id: proyectoId,
            empresaId,
            fecha_creacion: fechaHoy,
            fecha_presentacion: fechaPresentacion,
            anio_presentacion: anioPresentacion,
            duracion_seguimiento: duracionSeguimiento,
            checklists: {
                create: checklistsToCreate
            }
        }
    });

    return proyectoId;
  }

  async listar(empresaId) {
    // Map db results to legacy response structure
    const proyectos = await prisma.proyecto.findMany({
        where: { empresaId }
    });
    return proyectos.map(p => ({
        id: p.id,
        expediente: p.expediente,
        fecha_creacion: p.fecha_creacion,
        fecha_presentacion: p.fecha_presentacion,
        anio_presentacion: p.anio_presentacion,
        duracion_seguimiento: p.duracion_seguimiento,
        cotizacion_ui: p.cotizacion_ui,
        cotizacion_usd: p.cotizacion_usd
    }));
  }

  async actualizarExpediente(empresaId, proyectoId, expediente) {
    try {
        await prisma.proyecto.update({
            where: { id: proyectoId },
            data: { expediente }
        });
        return true;
    } catch(e) {
        return false;
    }
  }

  async actualizarMetadata(empresaId, proyectoId, datos) {
    const camposEditables = [
        'fecha_presentacion', 'anio_presentacion', 'duracion_seguimiento',
        'cotizacion_ui', 'cotizacion_usd',
    ];
    
    const dataToUpdate = {};
    for (const campo of camposEditables) {
        if (datos[campo] !== undefined) dataToUpdate[campo] = datos[campo];
    }

    try {
        await prisma.proyecto.update({
            where: { id: proyectoId },
            data: dataToUpdate
        });
        return true;
    } catch(e) {
        return false;
    }
  }

  async getMetadata(empresaId, proyectoId) {
    const p = await prisma.proyecto.findUnique({ where: { id: proyectoId }});
    if (!p) return null;
    return {
        id: p.id,
        expediente: p.expediente,
        fecha_creacion: p.fecha_creacion,
        fecha_presentacion: p.fecha_presentacion,
        anio_presentacion: p.anio_presentacion,
        duracion_seguimiento: p.duracion_seguimiento,
        cotizacion_ui: p.cotizacion_ui,
        cotizacion_usd: p.cotizacion_usd
    };
  }

}

module.exports = new ProyectoService();
