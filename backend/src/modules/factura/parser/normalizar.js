/**
 * Criterio único para lo que lee la IA: la IA devuelve los datos como vienen
 * en el comprobante y acá se llevan siempre al mismo formato. Así una factura
 * de UTE y una proforma del exterior quedan cargadas igual.
 */
const { CATEGORIAS, TIPOS_COMPROBANTE } = require('../../../common/constants/factura');
const { normalizarMonto, toFechaDDMMYYYY, normalizarTipoComprobante } = require('../../../common/utils/normalize');

const sinTildes = (s) => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
const texto = (v) => (v == null ? '' : String(v).trim());

/** "$", "$U", "UYU", "Peso Uruguayo" -> UYU; "US$", "U$S", "dólares" -> USD; el resto null */
function normalizarMoneda(v) {
  const s = sinTildes(texto(v)).toUpperCase().replace(/[\s.]/g, '');
  if (!s) return null;
  if (['USD', 'US$', 'U$S', 'U$D'].includes(s) || /DOLAR|DOLLAR/.test(s)) return 'USD';
  if (['UYU', '$', '$U', 'UY$'].includes(s) || /PESO/.test(s)) return 'UYU';
  return null;
}

/** "A 095921", "A-095921", "A / 095921" -> "A095921". Conserva letras y ceros a la izquierda */
function normalizarSerieNumero(v) {
  const s = texto(v).toUpperCase().replace(/[\s\-/.:#°º]/g, '');
  return s || null;
}

/** RUT sólo dígitos: "21 123456 0017" -> "211234560017". Sin los ceros de relleno de algunos formularios ("00211...") */
function normalizarRut(v) {
  let s = texto(v).replace(/\D/g, '');
  while (s.length > 12 && s.startsWith('0')) s = s.slice(1);
  return s || null;
}

/** Saca los códigos de cliente que algunos proveedores pegan al nombre: "199913 EJEMPLO SAS", "EJEMPLO SAS (15176)" */
function limpiarRazonSocial(v) {
  const s = texto(v)
    .replace(/^\(?\d{3,}\)?\s+/, '')
    .replace(/\s*\(\d{3,}\)$/, '')
    .trim();
  return s || null;
}

/** Nombre sin tipo societario ni puntuación, para comparar: "Empresa Ejemplo S.A.S." -> "EMPRESA EJEMPLO" */
function nucleoNombre(v) {
  return sinTildes(texto(v)).toUpperCase()
    .replace(/[^A-Z0-9 ]/g, ' ')
    .replace(/\b(S ?A ?S|S ?A|S ?R ?L|LTDA|SOCIEDAD ANONIMA|Y CIA)\b/g, ' ')
    .replace(/\d+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

const mismoNombre = (a, b) => {
  const x = nucleoNombre(a);
  const y = nucleoNombre(b);
  return Boolean(x && y && (x === y || x.includes(y) || y.includes(x)));
};

const redondear = (n) => Math.round(n * 100) / 100;

/**
 * Monto sin impuestos (criterio de la gestora, 2026-10-30). Se controla con el
 * total: si subtotal + IVA da el total (con hasta $1 de diferencia, porque en
 * pesos el total suele ir redondeado), vale el subtotal. Si no da, la IA tomó
 * un subtotal antes de un descuento u otro ajuste, y se usa total - IVA.
 */
function montoSinImpuestos(item) {
  const subtotal = normalizarMonto(item.subtotal);
  const impuestos = normalizarMonto(item.impuestos);
  const total = normalizarMonto(item.total);
  if (total == null || impuestos == null) return subtotal != null ? subtotal : total;
  // Un pago sin IVA (BPS, honorarios exentos) a veces viene con todo como "impuestos" y subtotal 0
  if (!subtotal && total > 0 && impuestos >= total) return total;
  if (subtotal != null && Math.abs(subtotal + impuestos - total) <= 1) return subtotal;
  return redondear(total - impuestos);
}

/** Fecha a DD/MM/YYYY; acepta también D.M.YYYY y YYYY/MM/DD */
function normalizarFechaComprobante(v) {
  const s = texto(v).replace(/\./g, '/').replace(/^(\d{4})\/(\d{1,2})\/(\d{1,2})$/, '$1-$2-$3');
  return toFechaDDMMYYYY(s);
}

function normalizarCategoria(v) {
  const s = sinTildes(texto(v)).toLowerCase();
  return CATEGORIAS.find((c) => sinTildes(c).toLowerCase() === s) || null;
}

function normalizarTipo(v) {
  const s = sinTildes(texto(v)).toLowerCase();
  if (['proforma', 'cotizacion', 'presupuesto', 'quotation', 'quote', 'proforma invoice'].includes(s)) return 'Presupuesto';
  const tipo = normalizarTipoComprobante(texto(v));
  return TIPOS_COMPROBANTE.includes(tipo) ? tipo : null;
}

function normalizarCantidad(v) {
  const n = Math.round(Number(v));
  return Number.isFinite(n) && n > 0 ? n : 1;
}

/**
 * Si la IA cruzó emisor y receptor (pasa en algunos formatos), los da vuelta
 * usando los datos de la empresa del proyecto, que siempre es la receptora.
 */
function ordenarEmisorReceptor(c, empresa) {
  if (!empresa) return c;
  const rutEmpresa = normalizarRut(empresa.rut);
  const nombresEmpresa = [empresa.razon_social, empresa.nombre].filter(Boolean);
  const esEmpresa = (nombre) => nombresEmpresa.some((n) => mismoNombre(n, nombre));
  const o = { ...c };
  if (rutEmpresa && o.rut === rutEmpresa && o.rut_receptor !== rutEmpresa) {
    [o.rut, o.rut_receptor] = [o.rut_receptor, o.rut];
  }
  if (esEmpresa(o.proveedor) && !esEmpresa(o.razon_social_receptor)) {
    // Si la IA no leyó el receptor, el proveedor queda vacío para completarlo a mano
    [o.proveedor, o.razon_social_receptor] = [o.razon_social_receptor || null, o.proveedor];
  }
  return o;
}

/**
 * Comprobante leído por la IA -> fila de Factura.
 * `empresa` ({ rut, nombre, razon_social }) es opcional y sirve para corregir emisor y receptor cruzados.
 */
function normalizarComprobante(item, archivo, { empresa } = {}) {
  return ordenarEmisorReceptor({
    archivo,
    descripcion: texto(item.descripcion) || null,
    numero_factura: normalizarSerieNumero(item.serie_numero_factura),
    proveedor: limpiarRazonSocial(item.razon_social_emisor),
    rut: normalizarRut(item.rut_emisor),
    fecha: normalizarFechaComprobante(item.fecha_comprobante),
    monto: montoSinImpuestos(item),
    moneda: normalizarMoneda(item.moneda),
    cantidad: normalizarCantidad(item.cantidad),
    categoria: normalizarCategoria(item.categoria),
    rut_receptor: normalizarRut(item.rut_receptor),
    razon_social_receptor: limpiarRazonSocial(item.razon_social_receptor),
    tipo_comprobante: normalizarTipo(item.tipo_comprobante),
    texto_extraido: true,
  }, empresa);
}

module.exports = {
  normalizarComprobante,
  normalizarMoneda,
  normalizarSerieNumero,
  normalizarRut,
  limpiarRazonSocial,
  montoSinImpuestos,
  normalizarFechaComprobante,
  normalizarCategoria,
  normalizarTipo,
};
