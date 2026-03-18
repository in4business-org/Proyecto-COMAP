/**
 * JSON Schema for a single invoice item, used as Gemini's response schema.
 * Mirrors the TypeScript interface from invoice_parcer.
 */
const INVOICE_CATEGORIES_SCHEMA = [
  'Maquinaria',
  'Equipos',
  'Instalaciones',
  'Vehiculos',
  'Materiales',
  'Mano de Obra',
  'Leyes Sociales',
  'Honorarios',
];

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
    moneda: { type: 'STRING', enum: ['$', 'USD'], nullable: true },
    subtotal: { type: 'NUMBER', nullable: true },
    categoria: {
      type: 'STRING',
      enum: COMAP_CATEGORIES,
      nullable: true,
    },
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
    'categoria',
  ],
};

const INVOICE_RESPONSE_SCHEMA = {
  type: 'ARRAY',
  items: INVOICE_ITEM_SCHEMA,
};

module.exports = { INVOICE_ITEM_SCHEMA, INVOICE_RESPONSE_SCHEMA, INVOICE_CATEGORIES_SCHEMA };
