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

const CRONOGRAMA_CONFIG = {
  'Maquinaria': 13,
  'Equipos': 14,
  'Instalaciones': 15,
  'Vehiculos': 16,
  'MEIV/Imprevistos': 17,
  'Materiales': 23,
  'Mano de Obra Directa': 24,
  'Mano de Obra Indirecta': 25,
  'Leyes Sociales': 26,
  'Honorarios': 27,
  'OC/Imprevistos': 28,
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

    // M = monto en UI: si USD → subtotal*C4/C5, si UYU → subtotal/C5
    const formula = moneda === 'USD'
      ? `${subtotal}*$C$4/$C$5`
      : `${subtotal}/$C$5`;
    ws.getCell(rowNumber, 13).value = { formula };
  }

  _llenarCuadroInversiones(ws, facturas, opciones) {
    const { cotizacion_usd, cotizacion_ui, fecha_cotizacion, fecha_presentacion, fecha_balance } = opciones;

    if (fecha_cotizacion) {
      ws.getCell(3, 3).value = normalizarFecha(fecha_cotizacion);
    }

    if (cotizacion_usd) {
      ws.getCell(4, 3).value = parseFloat(cotizacion_usd);
    }

    if (cotizacion_ui) {
      ws.getCell(5, 3).value = parseFloat(cotizacion_ui);
    }

    if (fecha_balance) {
      ws.getCell(6, 3).value = normalizarFecha(fecha_balance);
    }

    if (fecha_presentacion) {
      ws.getCell(7, 3).value = normalizarFecha(fecha_presentacion);
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
  }

  _llenarCronogramaInversiones(ws, facturas, opciones) {
    const { cotizacion_ui, cotizacion_usd, fecha_presentacion } = opciones;

    let anio_presentacion = opciones.anio_presentacion;
    if (!anio_presentacion && fecha_presentacion) {
      anio_presentacion = new Date(fecha_presentacion).getFullYear();
    }

    if (!anio_presentacion || !cotizacion_ui) return;

    const uiRate = parseFloat(cotizacion_ui);
    const usdRate = cotizacion_usd ? parseFloat(cotizacion_usd) : 0;

    // sums[rowNum][colNum] = total en UI
    const sums = {};

    for (const factura of facturas) {
      const categoria = this.normalizeCategory(factura.categoria);
      const rowNum = CRONOGRAMA_CONFIG[categoria];
      if (!rowNum) continue;

      const fechaEjecucion = factura.fecha_ejecucion;
      if (!fechaEjecucion) continue;

      const anioEjecucion = parseInt(fechaEjecucion.substring(0, 4), 10);
      if (isNaN(anioEjecucion)) continue;

      const diff = anioEjecucion - anio_presentacion;

      let colNum;
      if (diff === 0) {
        colNum = factura.tipo_comprobante === 'Presupuesto' ? 4 : 3;
      } else if (diff >= 1 && diff <= 10) {
        colNum = diff + 4; // diff=1 → col 5, diff=2 → col 6, ..., diff=10 → col 14
      } else {
        continue;
      }

      const monto = normalizarMonto(factura.monto ?? factura.subtotal ?? factura.valor_monto);
      if (!monto) continue;

      let montoUI;
      if (factura.moneda === 'USD') {
        montoUI = (monto * usdRate) / uiRate;
      } else {
        montoUI = monto / uiRate;
      }

      if (!sums[rowNum]) sums[rowNum] = {};
      sums[rowNum][colNum] = (sums[rowNum][colNum] || 0) + montoUI;
    }

    for (const rowNum of Object.keys(sums)) {
      for (const colNum of Object.keys(sums[rowNum])) {
        ws.getCell(parseInt(rowNum), parseInt(colNum)).value = sums[rowNum][colNum];
      }
    }
  }

  async generarExcelComap(facturas, rutaSalida, opciones = {}) {
    const { sheetName } = opciones;

    if (!fs.existsSync(TEMPLATE_CUADRO)) {
      throw new Error(`Template not found: ${TEMPLATE_CUADRO}`);
    }

    if (!Array.isArray(facturas)) {
      throw new Error('facturas debe ser un array');
    }

    fs.copyFileSync(TEMPLATE_CUADRO, rutaSalida);

    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.readFile(rutaSalida);

    const wsCuadro = sheetName
      ? workbook.getWorksheet(sheetName)
      : workbook.getWorksheet('CUADRO DE INVERSIONES') || workbook.worksheets[0];

    if (!wsCuadro) {
      throw new Error('No se encontró la hoja a procesar');
    }

    this._llenarCuadroInversiones(wsCuadro, facturas, opciones);

    const wsCronograma = workbook.getWorksheet('CRONOGRAMA DE INVERSIONES');
    if (wsCronograma) {
      this._llenarCronogramaInversiones(wsCronograma, facturas, opciones);
    }

    workbook.calcProperties = { fullCalcOnLoad: true };
    await workbook.xlsx.writeFile(rutaSalida);
    return rutaSalida;
  }
}

module.exports = new ExcelService();
