/**
 * Normalizes monetary amounts from various string formats to a float.
 * Handles formats like "17.303,28" (Spanish) or "17303.28" (English).
 */
function normalizarMonto(value) {
  if (!value) return null;
  let s = String(value).replace(/\s/g, '').replace(/\$/g, '');
  if (s.includes(',')) {
    s = s.replace(/\./g, '').replace(',', '.');
  }
  const num = parseFloat(s);
  return isNaN(num) ? null : num;
}

/**
 * Normalizes date strings from various formats to a Date object.
 * Supports DD/MM/YYYY, DD-MM-YYYY, YYYY-MM-DD.
 */
function normalizarFecha(value) {
  if (!value) return null;
  const s = String(value).trim();

  // DD/MM/YYYY or DD-MM-YYYY
  const dmy = s.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/);
  if (dmy) {
    const [, d, m, y] = dmy;
    return new Date(parseInt(y), parseInt(m) - 1, parseInt(d));
  }

  // YYYY-MM-DD
  const ymd = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (ymd) {
    const [, y, m, d] = ymd;
    return new Date(parseInt(y), parseInt(m) - 1, parseInt(d));
  }

  return null;
}

/**
 * Formats a Date object to DD/MM/YYYY string.
 */
function formatearFecha(date) {
  if (!date || !(date instanceof Date)) return null;
  const dd = String(date.getDate()).padStart(2, '0');
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const yyyy = date.getFullYear();
  return `${dd}/${mm}/${yyyy}`;
}

module.exports = { normalizarMonto, normalizarFecha, formatearFecha };
