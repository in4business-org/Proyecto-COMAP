const { GoogleGenAI } = require('@google/genai');

const apiKey = process.env.GEMINI_API_KEY;

if (!apiKey) {
  console.warn('WARNING: Falta GEMINI_API_KEY en .env — el parser de facturas no funcionará.');
}

const ai = apiKey ? new GoogleGenAI({ apiKey }) : null;

module.exports = { ai };
