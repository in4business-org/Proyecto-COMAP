const fs = require('fs');
const path = require('path');
const { parseInvoice, ALLOWED_MIME_TYPES } = require('./parser');

/**
 * Maps Gemini item fields to the format the rest of the app expects
 * (excel.service, routes, etc.)
 */
function mapGeminiItemToLegacy(item, archivo) {
  return {
    archivo,
    descripcion: item.descripcion || null,
    numero_factura: item.serie_numero_factura || null,
    proveedor: item.razon_social_emisor || null,
    rut: item.rut_emisor || null,
    fecha: item.fecha_comprobante || null,
    monto: item.subtotal || null,
    moneda: item.moneda === '$' ? 'UYU' : (item.moneda || null),
    cantidad: item.cantidad || 1,
    categoria: item.categoria || null,
    rut_receptor: item.rut_receptor || null,
    razon_social_receptor: item.razon_social_receptor || null,
    texto_extraido: true,
  };
}

/**
 * Supported file extensions for invoice parsing.
 */
const SUPPORTED_EXTENSIONS = ['.pdf', '.png', '.jpg', '.jpeg', '.webp'];

function getMimeType(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  const mimeMap = {
    '.pdf': 'application/pdf',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.webp': 'image/webp',
  };
  return mimeMap[ext] || 'application/pdf';
}

class FacturaService {
  /**
   * Analyze a single invoice file (PDF or image).
   * Returns an array of line-item objects in legacy format.
   */
  async analizarBuffer(fileBuffer, mimeType, archivo) {
    try {
      const items = await parseInvoice({ fileBuffer, mimeType });
      return items.map(item => mapGeminiItemToLegacy(item, archivo));
    } catch (error) {
      console.error(`Error analizando ${archivo}:`, error.message);
      return [{
        archivo,
        numero_factura: null,
        proveedor: null,
        rut: null,
        fecha: null,
        monto: null,
        moneda: null,
        texto_extraido: false,
      }];
    }
  }

  /**
   * Analyze multiple files from memory buffers
   * @param {Array<{buffer: Buffer, mimeType: string, filename: string}>} archivosData 
   */
  async analizarMultipleArchivos(archivosData) {
    const resultados = [];
    for (const data of archivosData) {
      const items = await this.analizarBuffer(data.buffer, data.mimeType, data.filename);
      resultados.push(...items);
    }
    return resultados;
  }
}

module.exports = new FacturaService();
