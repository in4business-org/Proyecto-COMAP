const fs = require('fs');
const path = require('path');
const { PROYECTOS_DIR } = require('../../config/storage.config');
const { CHECKLIST_PRESENTACION } = require('../../common/constants/checklist-items');

class ChecklistService {
  getChecklist(empresaId, proyectoId) {
    const checkPath = path.join(PROYECTOS_DIR, empresaId, proyectoId, 'presentacion', 'checklist.json');
    if (!fs.existsSync(checkPath)) return [];
    const estados = JSON.parse(fs.readFileSync(checkPath, 'utf-8'));
    return CHECKLIST_PRESENTACION.map(item => ({
      ...item,
      ...(estados[item.id] || { estado: 'pendiente', archivo: null, nota_usuario: '' }),
    }));
  }

  actualizarItem(empresaId, proyectoId, itemId, estado, notaUsuario = '') {
    const checkPath = this._getPath(empresaId, proyectoId);
    if (!fs.existsSync(checkPath)) return false;
    const checklist = JSON.parse(fs.readFileSync(checkPath, 'utf-8'));
    if (!checklist[itemId]) checklist[itemId] = {};
    checklist[itemId].estado = estado;
    checklist[itemId].nota_usuario = notaUsuario;
    fs.writeFileSync(checkPath, JSON.stringify(checklist, null, 2), 'utf-8');
    return true;
  }

  guardarArchivo(empresaId, proyectoId, itemId, filename) {
    const checkPath = this._getPath(empresaId, proyectoId);
    if (!fs.existsSync(checkPath)) return false;
    const checklist = JSON.parse(fs.readFileSync(checkPath, 'utf-8'));
    if (!checklist[itemId]) checklist[itemId] = {};
    checklist[itemId].archivo = filename;
    checklist[itemId].estado = 'completado';
    fs.writeFileSync(checkPath, JSON.stringify(checklist, null, 2), 'utf-8');
    return true;
  }

  getArchivoPath(empresaId, proyectoId, itemId) {
    const checklist = this.getChecklist(empresaId, proyectoId);
    const item = checklist.find(i => i.id === itemId);
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

  _getPath(empresaId, proyectoId) {
    return path.join(PROYECTOS_DIR, empresaId, proyectoId, 'presentacion', 'checklist.json');
  }
}

module.exports = new ChecklistService();
