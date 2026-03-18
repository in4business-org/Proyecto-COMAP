/**
 * Invoice Parser — powered by Google Gemini
 *
 * Receives a file buffer (PDF or image) and returns an array of
 * parsed invoice items using Gemini's structured output.
 */
const { ai } = require('./gemini.client');
const { INVOICE_EXTRACTION_PROMPT } = require('./invoice.prompt');
const { INVOICE_RESPONSE_SCHEMA } = require('./invoice.schema');

const ALLOWED_MIME_TYPES = [
  'application/pdf',
  'image/png',
  'image/jpeg',
  'image/jpg',
  'image/webp',
];

function normalizeMimeType(mimeType) {
  if (!mimeType) return 'application/pdf';
  if (!ALLOWED_MIME_TYPES.includes(mimeType)) {
    throw new Error(`Tipo de archivo no soportado: ${mimeType}`);
  }
  return mimeType === 'image/jpg' ? 'image/jpeg' : mimeType;
}

/**
 * Parse a single invoice file with Gemini.
 * @param {Object} params
 * @param {Buffer} params.fileBuffer - The file contents
 * @param {string} [params.mimeType] - MIME type (defaults to application/pdf)
 * @returns {Promise<Array>} Array of invoice item objects
 */
async function parseInvoice({ fileBuffer, mimeType }) {
  if (!ai) {
    throw new Error('GEMINI_API_KEY no configurada — no se puede analizar facturas');
  }

  if (!fileBuffer || fileBuffer.length === 0) {
    throw new Error('Archivo vacío o inexistente');
  }

  const finalMimeType = normalizeMimeType(mimeType);

  const response = await ai.models.generateContent({
    model: 'gemini-2.5-flash',
    contents: [
      {
        inlineData: {
          mimeType: finalMimeType,
          data: fileBuffer.toString('base64'),
        },
      },
      {
        text: INVOICE_EXTRACTION_PROMPT,
      },
    ],
    config: {
      responseMimeType: 'application/json',
      responseSchema: INVOICE_RESPONSE_SCHEMA,
      temperature: 0,
    },
  });

  if (!response.text) {
    throw new Error('Gemini no devolvió contenido');
  }

  const parsed = JSON.parse(response.text);

  if (!Array.isArray(parsed)) {
    throw new Error('Gemini no devolvió un array JSON');
  }

  return parsed;
}

module.exports = { parseInvoice, ALLOWED_MIME_TYPES };
