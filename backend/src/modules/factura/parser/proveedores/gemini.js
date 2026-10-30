const { GoogleGenAI } = require('@google/genai');

const apiKey = process.env.GEMINI_API_KEY;

if (!apiKey) {
  console.warn('WARNING: Falta GEMINI_API_KEY en .env — el parser de facturas no funcionará.');
}

const ai = apiKey ? new GoogleGenAI({ apiKey }) : null;

const MODELO_POR_DEFECTO = 'gemini-2.5-flash';

/**
 * Manda el archivo a Gemini y devuelve el texto JSON de la respuesta.
 * Los errores de la API traen `status` (402 sin saldo, 429 cuota, 5xx caída).
 */
async function extraer({ base64, mimeType, prompt, schema, modelo }) {
  if (!ai) {
    const err = new Error('GEMINI_API_KEY no configurada');
    err.status = 401;
    throw err;
  }
  const response = await ai.models.generateContent({
    model: modelo || MODELO_POR_DEFECTO,
    contents: [
      { inlineData: { mimeType, data: base64 } },
      { text: prompt },
    ],
    config: {
      responseMimeType: 'application/json',
      responseSchema: schema,
      temperature: 0,
    },
  });
  return response.text;
}

module.exports = { extraer };
