const fs = require('fs');
const path = require('path');
const ExcelJS = require('exceljs');
const { PROYECTOS_DIR, TEMPLATE_SIMULADOR } = require('../../config/storage.config');

class SimuladorService {
  getSimuladorPath(empresaId, proyectoId) {
    const ruta = path.join(PROYECTOS_DIR, empresaId, proyectoId, 'presentacion', 'archivos_comap', '0_Simulador.xlsx');
    if (!fs.existsSync(ruta)) {
      if (!fs.existsSync(TEMPLATE_SIMULADOR)) return null;
      fs.mkdirSync(path.dirname(ruta), { recursive: true });
      fs.copyFileSync(TEMPLATE_SIMULADOR, ruta);
    }
    return ruta;
  }

  async subirSimulador(empresaId, proyectoId, fileBuffer) {
    const carpeta = path.join(PROYECTOS_DIR, empresaId, proyectoId, 'presentacion', 'archivos_comap');
    fs.mkdirSync(carpeta, { recursive: true });
    const ruta = path.join(carpeta, '0_Simulador_completado.xlsx');
    fs.writeFileSync(ruta, fileBuffer);
    const resultados = await this.leerResultadosSimulador(ruta);

    const metaPath = path.join(PROYECTOS_DIR, empresaId, proyectoId, 'metadata.json');
    if (fs.existsSync(metaPath)) {
      const meta = JSON.parse(fs.readFileSync(metaPath, 'utf-8'));
      meta.simulador = resultados;
      fs.writeFileSync(metaPath, JSON.stringify(meta, null, 2), 'utf-8');
    }
    return resultados;
  }

  getResultados(empresaId, proyectoId) {
    const metaPath = path.join(PROYECTOS_DIR, empresaId, proyectoId, 'metadata.json');
    if (!fs.existsSync(metaPath)) return {};
    const meta = JSON.parse(fs.readFileSync(metaPath, 'utf-8'));
    return meta.simulador || {};
  }

  async leerResultadosSimulador(ruta) {
    try {
      const workbook = new ExcelJS.Workbook();
      await workbook.xlsx.readFile(ruta);
      const ws = workbook.getWorksheet('SIMULADOR');
      if (!ws) return { error: 'Worksheet SIMULADOR not found' };
      return {
        puntaje_final: ws.getCell('F141').value,
        alcanza_minimo: ws.getCell('C144').value,
        exoneracion_irae_pct: ws.getCell('D153').value,
        exoneracion_ui: ws.getCell('D155').value,
        plazo_exoneracion: ws.getCell('D159').value,
      };
    } catch (error) {
      return { error: error.message };
    }
  }
}

module.exports = new SimuladorService();
