const fs = require('fs');
const path = require('path');
const ExcelJS = require('exceljs');
const { TEMPLATE_SIMULADOR } = require('../../config/storage.config');
const supabaseService = require('../../config/supabase.config');

class SimuladorService {
  async getSimuladorBuffer(empresaId, proyectoId) {
    const filePath = `proyectos/${empresaId}/${proyectoId}/simulador/0_Simulador.xlsx`;
    try {
        const buffer = await supabaseService.downloadFile(filePath);
        return buffer;
    } catch {
        if (!fs.existsSync(TEMPLATE_SIMULADOR)) return null;
        return fs.readFileSync(TEMPLATE_SIMULADOR);
    }
  }

  async subirSimulador(empresaId, proyectoId, fileBuffer) {
    const filePath = `proyectos/${empresaId}/${proyectoId}/simulador/0_Simulador_completado.xlsx`;
    await supabaseService.uploadFile(filePath, fileBuffer, 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(fileBuffer);
    const ws = workbook.getWorksheet('SIMULADOR');
    let resultados = {};
    if (ws) {
        resultados = {
          puntaje_final: ws.getCell('F141').value,
          alcanza_minimo: ws.getCell('C144').value,
          exoneracion_irae_pct: ws.getCell('D153').value,
          exoneracion_ui: ws.getCell('D155').value,
          plazo_exoneracion: ws.getCell('D159').value,
        };
    }

    const metaPath = `proyectos/${empresaId}/${proyectoId}/metadata.json`;
    let meta = {};
    try {
        const metaBuf = await supabaseService.downloadFile(metaPath);
        meta = JSON.parse(metaBuf.toString('utf-8'));
    } catch {}

    meta.simulador = resultados;
    await supabaseService.uploadFile(metaPath, Buffer.from(JSON.stringify(meta, null, 2)), 'application/json');
    return resultados;
  }

  async getResultados(empresaId, proyectoId) {
    const metaPath = `proyectos/${empresaId}/${proyectoId}/metadata.json`;
    try {
        const metaBuf = await supabaseService.downloadFile(metaPath);
        const meta = JSON.parse(metaBuf.toString('utf-8'));
        return meta.simulador || {};
    } catch {
        return {};
    }
  }
}

module.exports = new SimuladorService();
