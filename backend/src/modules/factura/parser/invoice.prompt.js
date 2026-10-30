const { CATEGORIAS } = require('../../../common/constants/factura');

// La IA sólo lee: moneda, RUT, serie y tipo se devuelven como aparecen en el
// documento y los normaliza normalizar.js.
const INVOICE_EXTRACTION_PROMPT = `
Este documento es un comprobante de compra de una empresa uruguaya que presenta
un proyecto de inversión ante la COMAP. Puede ser una e-factura uruguaya, una
factura del exterior, una proforma o un presupuesto, en español o en otro idioma.

Devolvé un array JSON con un objeto por comprobante (no por ítem). Casi siempre
hay uno solo; si el archivo junta varios comprobantes distintos, uno por cada uno.

Campos:
- descripcion: resumen breve en español de qué se compró o qué servicio fue.
- serie_numero_factura: serie y número tal como aparecen (ej. "A 095921"). En
  proformas o facturas del exterior, el número del documento.
- fecha_comprobante: fecha de emisión del comprobante, en formato DD/MM/YYYY.
  No la de vencimiento, ni la de la resolución o el rango de CAE de DGI.
- cantidad: 1, salvo que el comprobante sea por un único ítem con cantidad mayor.
- rut_emisor / razon_social_emisor: quien emite y cobra (el proveedor). La
  razón social es la que va junto al RUT EMISOR, normalmente arriba con el
  logo; no la del bloque del cliente. En documentos del exterior, el
  identificador fiscal que figure, o null.
- rut_receptor / razon_social_receptor: el cliente al que se le factura (el
  bloque "RUT RECEPTOR", "Cliente", "Bill to").
- moneda: la moneda tal como aparece (ej. "$", "UYU", "US$", "USD", "EUR").
- subtotal: el importe sin impuestos del comprobante completo, ya con los
  descuentos aplicados (en e-facturas, la suma de los "Subtotal gravado" y
  "Subtotal no gravado").
- impuestos: sólo el IVA (suma de todas las tasas). 0 si no tiene IVA. Los
  aportes, contribuciones y retenciones no son IVA: en un pago a BPS, por
  ejemplo, impuestos es 0 y subtotal es el importe pagado.
- total: el total a pagar.
- Los importes van como número, con punto decimal y sin separador de miles.
- categoria: una de: ${CATEGORIAS.join(', ')}. Elegí según qué se compró; si no
  está claro, null.
- tipo_comprobante: "Factura" para facturas (e-factura, e-ticket, invoice);
  "Presupuesto" para presupuestos, cotizaciones y proformas; si no está claro, null.

Reglas:
- No inventes datos: si algo no se puede leer con seguridad, null.
- No confundas emisor con receptor: guiate por la estructura del documento
  (bloques "RUT EMISOR", "RUT RECEPTOR", "Cliente", "Bill to", etc.).
`;

module.exports = { INVOICE_EXTRACTION_PROMPT };
