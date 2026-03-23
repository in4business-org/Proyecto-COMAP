const ExcelJS = require('exceljs');
const fs = require('fs');
const { TEMPLATE_CUADRO } = require('../../config/storage.config');
const { normalizarMonto, normalizarFecha } = require('../../common/utils/normalize');

const CATEGORY_CONFIG = {
  'OC/Imprevistos': { order: 11, insertRow: 40 },
  'Honorarios': { order: 10, insertRow: 38 },
  'Leyes Sociales': { order: 9, insertRow: 36 },
  'Mano de Obra Indirecta': { order: 8, insertRow: 34 },
  'Mano de Obra Directa': { order: 7, insertRow: 32 },
  'Materiales': { order: 6, insertRow: 30 },
  'MEIV/Imprevistos': { order: 5, insertRow: 25 },
  'Vehiculos': { order: 4, insertRow: 23 },
  'Instalaciones': { order: 3, insertRow: 21 },
  'Equipos': { order: 2, insertRow: 19 },
  'Maquinaria': { order: 1, insertRow: 17 },
};

class ExcelService {
  normalizeCategory(category) {
    return String(category || '').trim();
  }

  sortFacturasForInsert(facturas) {
    return [...facturas].sort((a, b) => {
      const aCategory = this.normalizeCategory(a.categoria);
      const bCategory = this.normalizeCategory(b.categoria);

      const aOrder = CATEGORY_CONFIG[aCategory]?.order ?? 0;
      const bOrder = CATEGORY_CONFIG[bCategory]?.order ?? 0;

      if (aOrder !== bOrder) {
        return bOrder - aOrder;
      }

      return;
    });
  }

  copyStyleToNewRow(ws, targetRowNumber) {
    const sourceRowNumber = targetRowNumber + 1;
    if (sourceRowNumber < 1) return;

    const sourceRow = ws.getRow(sourceRowNumber);
    const targetRow = ws.getRow(targetRowNumber);

    if (sourceRow.height) {
      targetRow.height = sourceRow.height;
    }

    // Copiar estilo de A a M
    for (let colNumber = 1; colNumber <= 14; colNumber++) {
      const sourceCell = sourceRow.getCell(colNumber);
      const targetCell = targetRow.getCell(colNumber);

      targetCell.style = JSON.parse(JSON.stringify(sourceCell.style || {}));
    }

    // Sacar negrita en B y C
    for (let col = 2; col <= 14; col++) {
      const cell = targetRow.getCell(col);
      cell.font = {
        ...(cell.font || {}),
        bold: false,
      };
    };
  }

  writeFacturaRow(ws, rowNumber, factura) {
    const descripcion = factura.descripcion || null;
    const numeroFactura =
      factura.numero_factura || factura.serie_numero_factura || null;
    const fecha = normalizarFecha(factura.fecha || factura.fecha_comprobante);
    const cantidad = factura.cantidad ?? 1;
    const proveedor =
      factura.proveedor || factura.razon_social_emisor || null;
    const moneda = factura.moneda || null;
    const subtotal = normalizarMonto(
      factura.monto ?? factura.subtotal ?? factura.valor_monto
    );

    // B = descripcion
    ws.getCell(rowNumber, 2).value = descripcion;

    // C = numero_factura
    ws.getCell(rowNumber, 3).value = numeroFactura;

    // D = nada
    ws.getCell(rowNumber, 4).value = null;

    // E = fecha
    ws.getCell(rowNumber, 5).value = fecha;

    // F = "Plaza"
    ws.getCell(rowNumber, 6).value = 'PG';

    // G = nada
    ws.getCell(rowNumber, 7).value = null;

    // H = "N"
    ws.getCell(rowNumber, 8).value = 'N';

    // I = cantidad
    ws.getCell(rowNumber, 9).value = cantidad;

    // J = proveedor
    ws.getCell(rowNumber, 10).value = proveedor;

    // K = moneda
    ws.getCell(rowNumber, 11).value = moneda;

    // L = subtotal
    ws.getCell(rowNumber, 12).value = subtotal;

    // M = formula: L * $C$5
    ws.getCell(rowNumber, 13).value =
    {
      formula: `L${rowNumber}*$C$5`,
    };
  }

  async generarExcelComap(facturas, rutaSalida, opciones = {}) {
    const { cotizacion_usd, cotizacion_ui, sheetName } = opciones;

    if (!fs.existsSync(TEMPLATE_CUADRO)) {
      throw new Error(`Template not found: ${TEMPLATE_CUADRO}`);
    }

    if (!Array.isArray(facturas)) {
      throw new Error('facturas debe ser un array');
    }

    fs.copyFileSync(TEMPLATE_CUADRO, rutaSalida);

    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.readFile(rutaSalida);

    const ws = sheetName
      ? workbook.getWorksheet(sheetName)
      : workbook.getWorksheet('CUADRO DE INVERSIONES') || workbook.worksheets[0];

    if (!ws) {
      throw new Error('No se encontró la hoja a procesar');
    }

    if (cotizacion_usd) {
      ws.getCell(4, 3).value = parseFloat(cotizacion_usd);
    }

    if (cotizacion_ui) {
      ws.getCell(5, 3).value = parseFloat(cotizacion_ui);
    }

    const sortedFacturas = this.sortFacturasForInsert(facturas);

    for (const factura of sortedFacturas) {
      const categoria = this.normalizeCategory(factura.categoria);
      const config = CATEGORY_CONFIG[categoria];

      if (!config) {
        throw new Error(`Categoría no válida: ${categoria} en factura ${factura.numero_factura}`);
      }

      const rowNumber = config.insertRow;

      ws.spliceRows(rowNumber, 0, []);
      this.copyStyleToNewRow(ws, rowNumber);
      this.writeFacturaRow(ws, rowNumber, factura);
    }

    await workbook.xlsx.writeFile(rutaSalida);
    return rutaSalida;
  }
}

module.exports = new ExcelService();