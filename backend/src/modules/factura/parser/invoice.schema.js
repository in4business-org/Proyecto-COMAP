/**
 * Esquema de respuesta de la IA: un objeto por comprobante. Moneda y tipo van
 * como texto libre porque los normaliza normalizar.js; la categoría sí se
 * limita a la lista.
 */
const { CATEGORIAS } = require('../../../common/constants/factura');

const INVOICE_ITEM_SCHEMA = {
  type: 'OBJECT',
  properties: {
    descripcion: { type: 'STRING', nullable: true },
    serie_numero_factura: { type: 'STRING', nullable: true },
    fecha_comprobante: { type: 'STRING', nullable: true },
    cantidad: { type: 'NUMBER', nullable: true },
    rut_emisor: { type: 'STRING', nullable: true },
    razon_social_emisor: { type: 'STRING', nullable: true },
    rut_receptor: { type: 'STRING', nullable: true },
    razon_social_receptor: { type: 'STRING', nullable: true },
    moneda: { type: 'STRING', nullable: true },
    subtotal: { type: 'NUMBER', nullable: true },
    impuestos: { type: 'NUMBER', nullable: true },
    total: { type: 'NUMBER', nullable: true },
    categoria: {
      type: 'STRING',
      enum: CATEGORIAS,
      nullable: true,
    },
    tipo_comprobante: { type: 'STRING', nullable: true },
  },
  required: [
    'descripcion',
    'serie_numero_factura',
    'fecha_comprobante',
    'cantidad',
    'rut_emisor',
    'razon_social_emisor',
    'rut_receptor',
    'razon_social_receptor',
    'moneda',
    'subtotal',
    'impuestos',
    'total',
    'categoria',
    'tipo_comprobante',
  ],
};

const INVOICE_RESPONSE_SCHEMA = {
  type: 'ARRAY',
  items: INVOICE_ITEM_SCHEMA,
};

module.exports = { INVOICE_RESPONSE_SCHEMA };
