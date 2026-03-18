const INVOICE_EXTRACTION_PROMPT = `
Este documento es una factura de Uruguay.

Extraé la información y devolvé únicamente un array JSON válido.
No agregues markdown.
No agregues texto adicional.
No agregues \`\`\`json.
La respuesta debe ser solo JSON parseable.

Debe haber un objeto por cada item de la factura.

Usá exactamente esta estructura:
[
  {
    "descripcion": "string o null",
    "serie_numero_factura": "string o null",
    "fecha_comprobante": "DD/MM/YYYY o null",
    "cantidad": number o null,
    "rut_emisor": "string o null",
    "razon_social_emisor": "string o null",
    "rut_receptor": "string o null",
    "razon_social_receptor": "string o null",
    "moneda": "$ | USD | null",
    "subtotal": number o null
  }
]


Reglas generales:
- Debe haber un objeto por cada item de la factura.
- Repetí los datos generales de la factura en cada objeto.
- No inventes datos.
- Si un dato no se puede determinar con seguridad, devolvé null.
- "cantidad" y "subtotal" deben ser numéricos, no strings.
- Remové separadores de miles.
- Usá punto como separador decimal.

Reglas de emisor y receptor:
- "razon_social_emisor" debe corresponder a la empresa que emite la factura.
- "razon_social_receptor" debe corresponder al cliente o empresa receptora de la factura.
- "rut_emisor" debe corresponder al emisor.
- "rut_receptor" debe corresponder al receptor.
- Si aparece un bloque con etiquetas como "RUT EMISOR", "RUT RECEPTOR", "RAZON SOCIAL", asociá cada razón social y cada RUT al bloque correcto según la estructura visual del documento.
- No asumas que cualquier texto junto a "razon social" corresponde al emisor.
- Nunca confundas receptor con emisor.

Reglas de moneda:
- Si la factura está en pesos uruguayos, devolver "$".
- Si la factura está en dólares estadounidenses, devolver "USD".
- Interpretar:
  - "PESOS URUGUAYOS", "UYU", "$" -> "$"
  - "DÓLARES", "USD", "US$", "DOLARES AMERICANOS" -> "USD"
- No devolver otros formatos como "UYU", "Pesos Uruguayos", "Dólares", "$U" o "US$".
- El campo "moneda" debe ser exactamente uno de estos valores: "$", "USD", null.

Reglas de serie_numero_factura:
- Debe devolver serie + número en un único string.
- Sin espacios.
- Sin guiones.
- Sin barras.
- Sin otros separadores.
- Conservar letras y ceros a la izquierda.
- Ejemplos:
  - "A 095921" -> "A095921"
  - "A-095921" -> "A095921"
  - "A / 095921" -> "A095921"

Validación final:
- La salida debe ser JSON válido.
- La salida debe ser un array, incluso si hay un solo item.
`;

module.exports = { INVOICE_EXTRACTION_PROMPT };
