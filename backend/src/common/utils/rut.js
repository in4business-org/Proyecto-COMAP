/**
 * RUT uruguayo: 12 dígitos; el último es el verificador de DGI (módulo 11
 * con pesos 4,3,2,9,8,7,6,5,4,3,2). El frontend tiene la misma validación
 * en src/lib/empresa.js para avisar mientras se escribe.
 */

/** Saca espacios, puntos y guiones */
function limpiarRut(rut) {
  return String(rut || '').replace(/[\s.-]/g, '');
}

/** null si es válido, o un texto corto con el problema */
function problemaRut(rut) {
  const s = limpiarRut(rut);
  if (!s) return 'Falta el RUT';
  if (!/^\d+$/.test(s)) return 'El RUT lleva sólo números';
  if (s.length !== 12) return `El RUT tiene ${s.length} números y son 12`;
  const pesos = [4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
  const suma = pesos.reduce((acc, p, i) => acc + p * Number(s[i]), 0);
  let dv = 11 - (suma % 11);
  if (dv === 11) dv = 0;
  if (dv === 10 || dv !== Number(s[11])) return 'El RUT no es válido: revisá que esté bien copiado';
  return null;
}

module.exports = { limpiarRut, problemaRut };
