const { parseInvoice, ErrorLectura } = require('./parser');
const { normalizarComprobante } = require('./parser/normalizar');

class FacturaService {
  /**
   * Lee un archivo (PDF o imagen) con la IA.
   * Devuelve { comprobantes } si salió bien, o { error } con un mensaje para
   * mostrar en pantalla si no se pudo leer.
   * `empresa` (opcional) es la del proyecto: se usa para no cruzar emisor y receptor.
   */
  async analizarBuffer(fileBuffer, mimeType, archivo, { empresa } = {}) {
    try {
      const items = await parseInvoice({ fileBuffer, mimeType });
      return { comprobantes: items.map(item => normalizarComprobante(item, archivo, { empresa })) };
    } catch (error) {
      console.error(`Error analizando ${archivo}:`, error.causa?.message || error.message);
      const mensaje = error instanceof ErrorLectura
        ? error.message
        : 'No pudimos leer el archivo. Probá reprocesarlo o completá los datos a mano.';
      return { error: mensaje };
    }
  }

  /**
   * Lee varios archivos, de a tres por vez.
   * @param {Array<{buffer: Buffer, mimeType: string, filename: string}>} archivosData
   * @param {{ empresa?: { rut: string, nombre: string, razon_social?: string } }} [opciones]
   * @returns {Promise<{ comprobantes: Array, errores: Array<{archivo: string, mensaje: string}> }>}
   */
  async analizarMultipleArchivos(archivosData, { empresa } = {}) {
    const BATCH_SIZE = 3;
    const comprobantes = [];
    const errores = [];
    for (let i = 0; i < archivosData.length; i += BATCH_SIZE) {
      const batch = archivosData.slice(i, i + BATCH_SIZE);
      const resultados = await Promise.all(
        batch.map(d => this.analizarBuffer(d.buffer, d.mimeType, d.filename, { empresa }))
      );
      resultados.forEach((r, j) => {
        if (r.error) errores.push({ archivo: batch[j].filename, mensaje: r.error });
        else comprobantes.push(...r.comprobantes);
      });
    }
    return { comprobantes, errores };
  }
}

module.exports = new FacturaService();
