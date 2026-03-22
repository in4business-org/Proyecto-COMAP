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
    
    // Create physical folders
    const rutaProyecto = path.join(PROYECTOS_DIR, empresaId, proyectoId);
    
    const periodos = ['presentacion'];
    for (let i = 1; i <= duracionSeguimiento; i++) {
        periodos.push(`control_${anioPresentacion + i}`);
    }
    
    for (const periodo of periodos) {
        fs.mkdirSync(path.join(rutaProyecto, periodo, 'facturas'), { recursive: true });
        fs.mkdirSync(path.join(rutaProyecto, periodo, 'archivos_comap'), { recursive: true });
        fs.mkdirSync(path.join(rutaProyecto, periodo, 'documentos'), { recursive: true });
    }

    if (fs.existsSync(TEMPLATES_DIR)) {
        for (const periodo of periodos) {
            const destino = path.join(rutaProyecto, periodo, 'archivos_comap');
            for (const archivo of fs.readdirSync(TEMPLATES_DIR)) {
                fs.copyFileSync(path.join(TEMPLATES_DIR, archivo), path.join(destino, archivo));
            }
        }
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

  getRutaFacturas(empresaId, proyectoId, periodo) {
    return path.join(PROYECTOS_DIR, empresaId, proyectoId, periodo, 'facturas');
  }

  getRutaDocumentos(empresaId, proyectoId, periodo) {
    return path.join(PROYECTOS_DIR, empresaId, proyectoId, periodo, 'documentos');
  }
}

module.exports = new ProyectoService();
