/**
 * Lectura de comprobantes con IA.
 *
 * Recibe un archivo (PDF o imagen) y devuelve los comprobantes que encontró,
 * tal como los leyó la IA. La normalización (moneda, RUT, fechas, montos) la
 * hace normalizar.js, no la IA, para que el criterio sea siempre el mismo.
 *
 * Proveedor y modelo se eligen por entorno:
 *   IA_PROVEEDOR  hoy sólo "gemini" (por defecto)
 *   IA_MODELO     opcional; si falta, el del proveedor
 * Para sumar otro proveedor: un archivo en proveedores/ que exporte extraer().
 */
const { INVOICE_EXTRACTION_PROMPT } = require('./invoice.prompt');
const { INVOICE_RESPONSE_SCHEMA } = require('./invoice.schema');

const PROVEEDORES = {
  gemini: () => require('./proveedores/gemini'),
};

const ALLOWED_MIME_TYPES = [
  'application/pdf',
  'image/png',
  'image/jpeg',
  'image/jpg',
  'image/webp',
];

/** Error de lectura con un mensaje pensado para mostrar en pantalla */
class ErrorLectura extends Error {
  constructor(mensaje, { causa, reintentable = false } = {}) {
    super(mensaje);
    this.causa = causa;
    this.reintentable = reintentable;
  }
}

function normalizeMimeType(mimeType) {
  if (!mimeType) return 'application/pdf';
  if (!ALLOWED_MIME_TYPES.includes(mimeType)) {
    throw new ErrorLectura(`Tipo de archivo no soportado: ${mimeType}`);
  }
  return mimeType === 'image/jpg' ? 'image/jpeg' : mimeType;
}

/** Traduce un error de la API de IA a algo que entienda quien sube la factura */
function aErrorLectura(err) {
  const status = err?.status ?? err?.code;
  if (status === 401 || status === 403 || status === 402) {
    return new ErrorLectura('La lectura automática no está disponible en este momento. Avisale a in4business.', { causa: err });
  }
  if (status === 429 || (status >= 500 && status < 600)) {
    return new ErrorLectura('El servicio de lectura está saturado. Probá reprocesar en unos minutos.', { causa: err, reintentable: true });
  }
  return new ErrorLectura('No pudimos leer el archivo. Probá reprocesarlo o completá los datos a mano.', { causa: err });
}

const esperar = (ms) => new Promise((r) => setTimeout(r, ms));

/**
 * Lee un comprobante con la IA configurada.
 * @param {Object} params
 * @param {Buffer} params.fileBuffer
 * @param {string} [params.mimeType] - por defecto application/pdf
 * @returns {Promise<Array>} comprobantes leídos, sin normalizar
 * @throws {ErrorLectura}
 */
async function parseInvoice({ fileBuffer, mimeType }) {
  if (!fileBuffer || fileBuffer.length === 0) {
    throw new ErrorLectura('El archivo está vacío.');
  }

  const nombre = (process.env.IA_PROVEEDOR || 'gemini').toLowerCase();
  if (!PROVEEDORES[nombre]) {
    throw new ErrorLectura('La lectura automática no está disponible en este momento. Avisale a in4business.', {
      causa: new Error(`IA_PROVEEDOR desconocido: ${nombre}`),
    });
  }
  const proveedor = PROVEEDORES[nombre]();

  const pedido = {
    base64: fileBuffer.toString('base64'),
    mimeType: normalizeMimeType(mimeType),
    prompt: INVOICE_EXTRACTION_PROMPT,
    schema: INVOICE_RESPONSE_SCHEMA,
    modelo: process.env.IA_MODELO,
  };

  // Un reintento si el servicio está saturado o caído; sin saldo o sin clave no tiene sentido
  let texto;
  for (let intento = 1; ; intento++) {
    try {
      texto = await proveedor.extraer(pedido);
      break;
    } catch (err) {
      const errorLectura = aErrorLectura(err);
      if (!errorLectura.reintentable || intento >= 2) throw errorLectura;
      await esperar(2000);
    }
  }

  if (!texto) {
    throw new ErrorLectura('No encontramos datos en el archivo. Completalos a mano.');
  }

  let parsed;
  try {
    parsed = JSON.parse(texto);
  } catch (err) {
    throw new ErrorLectura('No pudimos leer el archivo. Probá reprocesarlo o completá los datos a mano.', { causa: err });
  }
  if (!Array.isArray(parsed)) parsed = [parsed];
  return parsed;
}

module.exports = { parseInvoice, ErrorLectura, ALLOWED_MIME_TYPES };
