const ExcelJS = require('exceljs');
const fs = require('fs');
const path = require('path');
const { TEMPLATE_CUADRO } = require('../../config/storage.config');
const { normalizarMonto, normalizarFecha } = require('../../common/utils/normalize');

const PALABRAS = {
  maquinaria: [
    'maquina', 'maquinaria', 'tractor', 'cosechadora', 'prensa', 'torno',
    'fresadora', 'compresor', 'bomba', 'motor', 'generador', 'soldadora',
    'grúa', 'excavadora', 'retroexcavadora', 'cargadora', 'perforadora',
    'implemento', 'arado', 'sembradora', 'pulverizadora',
  ],
  equipo: [
    'equipo', 'computadora', 'laptop', 'servidor', 'impresora', 'scanner',
    'software', 'sistema', 'dispositivo', 'electronico', 'ups', 'rack',
    'switch', 'router', 'monitor', 'pantalla', 'cámara', 'balanza',
    'medidor', 'sensor', 'analizador', 'laboratorio', 'informatico',
  ],
  instalacion: [
    'instalacion', 'instalación', 'cableado', 'red eléctrica', 'plomeria',
    'climatizacion', 'aire acondicionado', 'hvac', 'ducto', 'cañeria',
    'tablero', 'transformador', 'subestacion', 'automatizacion',
    'automatización', 'iluminacion', 'alarma', 'rociador',
  ],
  vehiculo: [
    'vehiculo', 'vehículo', 'camion', 'camión', 'camioneta', 'automovil',
    'automóvil', 'furgon', 'furgón', 'trailer', 'acoplado', 'motocicleta',
    'moto', 'minibus', 'omnibus', 'pickup', 'utilitario',
  ],
};

const SECCIONES = [
  { cat: 'maquinaria', header: 16, dataStart: 17, dataCount: 2 },
  { cat: 'equipo', header: 19, dataStart: 20, dataCount: 2 },
  { cat: 'instalacion', header: 22, dataStart: 23, dataCount: 1 },
  { cat: 'vehiculo', header: 24, dataStart: 25, dataCount: 1 },
];
const FILA_TOTAL_MEIV_ORIG = 28;

class ExcelService {
  clasificarFactura(factura) {
    const texto = [
      String(factura.proveedor || ''),
      String(factura.archivo || ''),
      String(factura.numero_factura || ''),
    ].join(' ').toLowerCase();
    const scores = {};
    for (const [cat, pals] of Object.entries(PALABRAS)) {
      scores[cat] = pals.filter(p => texto.includes(p)).length;
    }
    const mejor = Object.keys(scores).reduce((a, b) => scores[a] > scores[b] ? a : b);
    return scores[mejor] > 0 ? mejor : 'equipo';
  }

  agruparPorCategoria(facturas) {
    const grupos = {};
    for (const cat of Object.keys(PALABRAS)) grupos[cat] = [];
    for (const f of facturas) grupos[this.clasificarFactura(f)].push(f);
    return grupos;
  }

  async generarExcelComap(facturas, rutaSalida, opciones = {}) {
    const { cotizacion_usd, cotizacion_ui } = opciones;
    if (!fs.existsSync(TEMPLATE_CUADRO)) {
      throw new Error(`Template not found: ${TEMPLATE_CUADRO}`);
    }
    fs.copyFileSync(TEMPLATE_CUADRO, rutaSalida);
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.readFile(rutaSalida);
    const ws = workbook.getWorksheet('CUADRO DE INVERSIONES');
    if (!ws) throw new Error('Worksheet "CUADRO DE INVERSIONES" not found');

    if (cotizacion_usd) ws.getCell(4, 3).value = parseFloat(cotizacion_usd);
    if (cotizacion_ui) ws.getCell(5, 3).value = parseFloat(cotizacion_ui);

    const grupos = this.agruparPorCategoria(facturas);
    let desplazamiento = 0;
    const escritura = [];

    for (const sec of SECCIONES) {
      const nFacturas = grupos[sec.cat].length;
      const filasExtra = Math.max(0, nFacturas - sec.dataCount);
      const dataStartReal = sec.dataStart + desplazamiento;
      if (filasExtra > 0) {
        ws.insertRows(dataStartReal + sec.dataCount, filasExtra);
        desplazamiento += filasExtra;
      }
      escritura.push({ inicio: dataStartReal, lista: grupos[sec.cat] });
    }

    for (const { inicio, lista } of escritura) {
      for (let i = 0; i < lista.length; i++) {
        this._escribirFactura(ws, inicio + i, lista[i]);
      }
    }

    const filaTotal = FILA_TOTAL_MEIV_ORIG + desplazamiento;
    ws.getCell(filaTotal, 13).value = { formula: `SUM(M16:M${filaTotal - 2})` };
    await workbook.xlsx.writeFile(rutaSalida);
    return rutaSalida;
  }

  _escribirFactura(ws, fila, f) {
    ws.getCell(fila, 2).value = f.proveedor || (f.archivo || '').replace('.pdf', '');
    ws.getCell(fila, 3).value = f.numero_factura || (f.archivo || '').replace('.pdf', '');
    ws.getCell(fila, 5).value = normalizarFecha(f.fecha);
    ws.getCell(fila, 9).value = 1;
    ws.getCell(fila, 10).value = f.proveedor || null;
    ws.getCell(fila, 11).value = f.moneda || null;
    ws.getCell(fila, 12).value = normalizarMonto(f.monto);
  }

  async generarExcelSimple(facturas, rutaSalida) {
    const workbook = new ExcelJS.Workbook();
    const ws = workbook.addWorksheet('Facturas extraídas');
    const headers = ['Archivo', 'N° Factura', 'Proveedor', 'RUT', 'Fecha', 'Monto', 'Moneda', 'Categoría COMAP', 'Estado'];
    const headerRow = ws.addRow(headers);
    headerRow.eachCell(cell => {
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1F4E79' } };
      cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
      cell.alignment = { horizontal: 'center' };
    });
    [32, 16, 36, 16, 14, 18, 10, 18, 16].forEach((w, i) => { ws.getColumn(i + 1).width = w; });

    const catLabels = { maquinaria: 'Maquinaria', equipo: 'Equipo', instalacion: 'Instalación', vehiculo: 'Vehículo' };
    const catColors = { maquinaria: 'FFDBEAFE', equipo: 'FFD1FAE5', instalacion: 'FFFEF3C7', vehiculo: 'FFFCE7F3' };

    for (const f of facturas) {
      const cat = this.clasificarFactura(f);
      const clave = [f.proveedor, f.fecha, f.monto];
      const ok = clave.every(Boolean);
      const estado = ok ? '✓ Completo' : `⚠ Faltan ${clave.filter(c => !c).length} campo(s)`;
      const row = ws.addRow([f.archivo, f.numero_factura, f.proveedor, f.rut, f.fecha, f.monto, f.moneda, catLabels[cat] || cat, estado]);
      const color = ok ? catColors[cat] : 'FFFEE2E2';
      row.eachCell(cell => {
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: color } };
      });
    }
    await workbook.xlsx.writeFile(rutaSalida);
    return rutaSalida;
  }
}

module.exports = new ExcelService();
