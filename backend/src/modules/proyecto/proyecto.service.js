const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { PROYECTOS_DIR, TEMPLATES_DIR } = require('../../config/storage.config');
const { CHECKLIST_PRESENTACION } = require('../../common/constants/checklist-items');

class ProyectoService {
  crear(empresaId, anioPresentacion, duracionSeguimiento, fechaPresentacion = null) {
    const fechaHoy = new Date().toISOString().split('T')[0];
    const proyectoId = `${fechaHoy}_${crypto.randomUUID().substring(0, 6)}`;
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

    const checklist = {};
    for (const item of CHECKLIST_PRESENTACION) {
      checklist[item.id] = { estado: 'pendiente', archivo: null, nota_usuario: '' };
    }
    fs.writeFileSync(
      path.join(rutaProyecto, 'presentacion', 'checklist.json'),
      JSON.stringify(checklist, null, 2), 'utf-8',
    );

    const metadata = {
      expediente: null,
      fecha_creacion: fechaHoy,
      fecha_presentacion: fechaPresentacion,
      anio_presentacion: anioPresentacion,
      duracion_seguimiento: duracionSeguimiento,
    };
    fs.writeFileSync(
      path.join(rutaProyecto, 'metadata.json'),
      JSON.stringify(metadata, null, 2), 'utf-8',
    );
    return proyectoId;
  }

  listar(empresaId) {
    const ruta = path.join(PROYECTOS_DIR, empresaId);
    if (!fs.existsSync(ruta)) return [];
    const proyectos = [];
    for (const carpeta of fs.readdirSync(ruta)) {
      const metaPath = path.join(ruta, carpeta, 'metadata.json');
      if (fs.existsSync(metaPath)) {
        const meta = JSON.parse(fs.readFileSync(metaPath, 'utf-8'));
        meta.id = carpeta;
        proyectos.push(meta);
      }
    }
    return proyectos;
  }

  actualizarExpediente(empresaId, proyectoId, expediente) {
    const meta = this._readMeta(empresaId, proyectoId);
    if (!meta) return false;
    meta.expediente = expediente;
    this._writeMeta(empresaId, proyectoId, meta);
    return true;
  }

  actualizarMetadata(empresaId, proyectoId, datos) {
    const meta = this._readMeta(empresaId, proyectoId);
    if (!meta) return false;
    const camposEditables = [
      'fecha_presentacion', 'anio_presentacion', 'duracion_seguimiento',
      'cotizacion_ui', 'cotizacion_usd',
    ];
    for (const campo of camposEditables) {
      if (datos[campo] !== undefined) meta[campo] = datos[campo];
    }
    this._writeMeta(empresaId, proyectoId, meta);
    return true;
  }

  getMetadata(empresaId, proyectoId) {
    return this._readMeta(empresaId, proyectoId);
  }

  getRutaFacturas(empresaId, proyectoId, periodo) {
    return path.join(PROYECTOS_DIR, empresaId, proyectoId, periodo, 'facturas');
  }

  getRutaDocumentos(empresaId, proyectoId, periodo) {
    return path.join(PROYECTOS_DIR, empresaId, proyectoId, periodo, 'documentos');
  }

  _readMeta(empresaId, proyectoId) {
    const metaPath = path.join(PROYECTOS_DIR, empresaId, proyectoId, 'metadata.json');
    if (!fs.existsSync(metaPath)) return null;
    return JSON.parse(fs.readFileSync(metaPath, 'utf-8'));
  }

  _writeMeta(empresaId, proyectoId, meta) {
    const metaPath = path.join(PROYECTOS_DIR, empresaId, proyectoId, 'metadata.json');
    fs.writeFileSync(metaPath, JSON.stringify(meta, null, 2), 'utf-8');
  }
}

module.exports = new ProyectoService();
