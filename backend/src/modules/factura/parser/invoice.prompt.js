const INVOICE_EXTRACTION_PROMPT = `
Este documento es una factura de Uruguay.

Extraé la información y devolvé únicamente un array JSON válido.
No agregues markdown.
No agregues texto adicional.
No agregues \`\`\`json.
La respuesta debe ser solo JSON parseable.

Debe haber un objeto por comprobante (factura), no por ítem.

Usá exactamente esta estructura:
[
  {
    "descripcion": "string o null",
    "serie_numero_factura": "string o null",
    "fecha_comprobante": "DD/MM/YYYY o null",
    "cantidad": 1,
    "rut_emisor": "string o null",
    "razon_social_emisor": "string o null",
    "rut_receptor": "string o null",
    "razon_social_receptor": "string o null",
    "moneda": "$ | USD | null",
    "subtotal": number o null,
    "categoria": "Maquinaria | Equipos | Instalaciones | Vehiculos | Materiales | Mano de Obra | Leyes Sociales | Honorarios | null"
  }
]


Reglas generales:
- Debe haber exactamente un objeto por comprobante (factura), sin importar cuántos ítems tenga.
- En "descripcion" resumí brevemente el contenido de la factura (qué se compró o qué servicio fue).
- En "subtotal" usá el total o subtotal de la factura completa, no el de un ítem individual.
- No inventes datos.
- Si un dato no se puede determinar con seguridad, devolvé null.
- "subtotal" debe ser numérico, no string.
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

Además, devolvé un campo "categoria" para cada item.

La categoría debe ser una de estas opciones exactas:
- 'Maquinaria',
- 'Equipos',
- 'Instalaciones',
- 'Vehiculos',
- 'MEIV/Imprevistos',
- 'Materiales',
- 'Mano de Obra Directa',
- 'Mano de Obra Indirecta',
- 'Leyes Sociales',
- 'Honorarios',
- 'OC/Imprevistos',

Reglas para categoria:
- Elegí la categoría más probable según la descripción del item y el contexto de la factura.
- Si no es posible inferirla con suficiente confianza, devolver null.
- No inventar categorías fuera de la lista.

Validación final:
- La salida debe ser JSON válido.
- La salida debe ser un array, incluso si hay un solo item.
`;

module.exports = { INVOICE_EXTRACTION_PROMPT };
