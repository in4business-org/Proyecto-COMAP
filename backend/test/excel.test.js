// Genera el cuadro COMAP con el template real y revisa lo que se escribe.
const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const ExcelJS = require('exceljs');
const excelService = require('../src/modules/factura/excel.service');
const { normalizarMonto } = require('../src/common/utils/normalize');

let fallos = 0;
function chequear(desc, fn) {
  try { fn(); console.log('OK  ' + desc); }
  catch (e) { console.log('FAIL ' + desc + ' -> ' + e.message); fallos++; }
}

(async () => {
  chequear('normalizarMonto conserva el 0', () => assert.strictEqual(normalizarMonto(0), 0));
  chequear('normalizarMonto con coma decimal', () => assert.strictEqual(normalizarMonto('17.303,28'), 17303.28));
  chequear('normalizarMonto vacío -> null', () => assert.strictEqual(normalizarMonto(''), null));

  const ruta = path.join(os.tmpdir(), `excel_test_${process.pid}.xlsx`);
  const facturas = [
    // fecha_ejecucion en DD/MM/YYYY, como se guarda en la base
    { categoria: 'Maquinaria', monto: 1000, moneda: 'UYU', tipo_comprobante: 'Factura', fecha: '10/03/2026', fecha_ejecucion: '10/03/2026' },
    { categoria: 'Equipos', monto: 50, moneda: 'USD', tipo_comprobante: 'Presupuesto', fecha: '10/03/2026', fecha_ejecucion: '01/01/2027' },
    { categoria: 'Maquinaria', monto: 500, moneda: 'UYU', tipo_comprobante: 'Presupuesto', fecha: '10/03/2026', fecha_ejecucion: '15/06/2026' },
  ];
  await excelService.generarExcelComap(facturas, ruta, {
    cotizacion_ui: 5, cotizacion_usd: 40, fecha_presentacion: '2026-01-01', anio_presentacion: 2026,
  });

  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(ruta);
  const cron = wb.getWorksheet('CRONOGRAMA DE INVERSIONES');
  chequear('cronograma: factura del año de presentación en columna C (1000/5)', () =>
    assert.strictEqual(cron.getCell(13, 3).value, 200));
  chequear('cronograma: presupuesto del año de presentación en columna D (500/5)', () =>
    assert.strictEqual(cron.getCell(13, 4).value, 100));
  chequear('cronograma: presupuesto del año siguiente en columna E (50*40/5)', () =>
    assert.strictEqual(cron.getCell(14, 5).value, 400));
  fs.unlinkSync(ruta);

  // Sin anio_presentacion se deduce de la fecha, sin correrse de año por UTC
  const ruta2 = path.join(os.tmpdir(), `excel_test2_${process.pid}.xlsx`);
  await excelService.generarExcelComap(facturas.slice(0, 1), ruta2, {
    cotizacion_ui: 5, cotizacion_usd: 40, fecha_presentacion: '2026-01-01',
  });
  const wb2 = new ExcelJS.Workbook();
  await wb2.xlsx.readFile(ruta2);
  chequear('cronograma: el año sale de fecha_presentacion (1 de enero)', () =>
    assert.strictEqual(wb2.getWorksheet('CRONOGRAMA DE INVERSIONES').getCell(13, 3).value, 200));
  fs.unlinkSync(ruta2);

  console.log(fallos === 0 ? '\nTODOS LOS TESTS DE EXCEL PASARON' : `\n${fallos} FALLARON`);
  process.exit(fallos === 0 ? 0 : 1);
})();
