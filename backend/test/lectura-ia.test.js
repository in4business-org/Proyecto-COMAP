// Lectura de comprobantes con IA: normalización y manejo de errores, sin llamar a la API.
const assert = require('assert');
const n = require('../src/modules/factura/parser/normalizar');

let fallos = 0;
async function chequear(desc, fn) {
  try { await fn(); console.log('OK  ' + desc); }
  catch (e) { console.log('FAIL ' + desc + ' -> ' + e.message); fallos++; }
}

// Reemplaza el proveedor de IA por uno falso que devuelve o tira lo que se le pase
const gemini = require('../src/modules/factura/parser/proveedores/gemini');
function proveedorFalso(fn) { gemini.extraer = fn; }
const facturaService = require('../src/modules/factura/factura.service');
const errorApi = (status) => Object.assign(new Error(`api ${status}`), { status });

(async () => {
  await chequear('moneda: $, $U, UYU y pesos -> UYU', () => {
    for (const v of ['$', '$U', 'UYU', 'Pesos Uruguayos', ' pesos ']) assert.strictEqual(n.normalizarMoneda(v), 'UYU', v);
  });
  await chequear('moneda: US$, U$S, USD y dólares -> USD', () => {
    for (const v of ['US$', 'U$S', 'usd', 'Dólares', 'DOLARES AMERICANOS']) assert.strictEqual(n.normalizarMoneda(v), 'USD', v);
  });
  await chequear('moneda desconocida -> null', () => assert.strictEqual(n.normalizarMoneda('EUR'), null));
  await chequear('serie y número sin separadores', () => {
    for (const v of ['A 095921', 'A-095921', 'A / 095921', 'a.095921']) assert.strictEqual(n.normalizarSerieNumero(v), 'A095921', v);
  });
  await chequear('RUT sólo dígitos', () => assert.strictEqual(n.normalizarRut('21 123456-0017'), '211234560017'));
  await chequear('fechas a DD/MM/YYYY', () => {
    assert.strictEqual(n.normalizarFechaComprobante('5/3/2026'), '05/03/2026');
    assert.strictEqual(n.normalizarFechaComprobante('05.03.2026'), '05/03/2026');
    assert.strictEqual(n.normalizarFechaComprobante('2026-03-05'), '05/03/2026');
    assert.strictEqual(n.normalizarFechaComprobante('marzo'), null);
  });
  await chequear('proforma y cotización -> Presupuesto', () => {
    for (const v of ['Proforma', 'cotización', 'Presupuesto', 'Proforma Invoice']) assert.strictEqual(n.normalizarTipo(v), 'Presupuesto', v);
    assert.strictEqual(n.normalizarTipo('factura'), 'Factura');
  });
  await chequear('categoría sin tildes ni mayúsculas', () => {
    assert.strictEqual(n.normalizarCategoria('vehículos'), 'Vehiculos');
    assert.strictEqual(n.normalizarCategoria('Software'), null);
  });
  await chequear('comprobante completo', () => {
    const c = n.normalizarComprobante({
      descripcion: ' Torno CNC ', serie_numero_factura: 'A-12', fecha_comprobante: '1/2/2026',
      cantidad: 0, rut_emisor: '21.000.000.0019', razon_social_emisor: 'Proveedor SA',
      moneda: 'U$S', subtotal: '17.303,28', categoria: 'maquinaria', tipo_comprobante: 'Factura',
    }, 'f.pdf');
    assert.deepStrictEqual(
      [c.descripcion, c.numero_factura, c.fecha, c.cantidad, c.rut, c.moneda, c.monto, c.categoria, c.archivo, c.texto_extraido],
      ['Torno CNC', 'A12', '01/02/2026', 1, '210000000019', 'USD', 17303.28, 'Maquinaria', 'f.pdf', true],
    );
  });

  await chequear('monto: subtotal si cuadra con el total redondeado', () => {
    assert.strictEqual(n.montoSinImpuestos({ subtotal: 483, impuestos: 106.26, total: 589 }), 483);
  });
  await chequear('monto: total - IVA si el subtotal es de antes del descuento', () => {
    assert.strictEqual(n.montoSinImpuestos({ subtotal: 1256.99, impuestos: 262.71, total: 1456.85 }), 1194.14);
  });
  await chequear('monto: sin total ni IVA, el subtotal', () => {
    assert.strictEqual(n.montoSinImpuestos({ subtotal: 50, impuestos: null, total: null }), 50);
  });
  await chequear('monto: pago a BPS con todo como "impuestos" -> el total', () => {
    assert.strictEqual(n.montoSinImpuestos({ subtotal: 0, impuestos: 12753, total: 12753 }), 12753);
  });
  await chequear('emisor es la empresa y no hay receptor -> proveedor vacío', () => {
    const c = n.normalizarComprobante({ razon_social_emisor: 'Ejemplo SAS', razon_social_receptor: null }, 'f.pdf', {
      empresa: { rut: '210000000019', nombre: 'EMPRESA EJEMPLO S.A.S.' },
    });
    assert.deepStrictEqual([c.proveedor, c.razon_social_receptor], [null, 'Ejemplo SAS']);
  });
  await chequear('RUT con ceros de relleno', () => assert.strictEqual(n.normalizarRut('00210000000019'), '210000000019'));
  await chequear('moneda "Peso Uruguayo" -> UYU', () => assert.strictEqual(n.normalizarMoneda('Peso Uruguayo'), 'UYU'));
  await chequear('razón social sin códigos de cliente', () => {
    assert.strictEqual(n.limpiarRazonSocial('199913 EJEMPLO SAS'), 'EJEMPLO SAS');
    assert.strictEqual(n.limpiarRazonSocial('EJEMPLO S.A.S (15176)'), 'EJEMPLO S.A.S');
    assert.strictEqual(n.limpiarRazonSocial('(3132) EJEMPLO SAS'), 'EJEMPLO SAS');
    assert.strictEqual(n.limpiarRazonSocial('6 B S.R.L.'), '6 B S.R.L.');
  });
  await chequear('emisor y receptor cruzados se dan vuelta con los datos de la empresa', () => {
    const c = n.normalizarComprobante({
      rut_emisor: '213000000016', razon_social_emisor: 'EJEMPLO SAS',
      rut_receptor: '210000000019', razon_social_receptor: 'PROVEEDOR SA',
    }, 'f.pdf', { empresa: { rut: '210000000019', nombre: 'Empresa Ejemplo S.A.S.' } });
    assert.deepStrictEqual([c.proveedor, c.razon_social_receptor, c.rut], ['PROVEEDOR SA', 'EJEMPLO SAS', '213000000016']);
  });

  const archivo = (filename) => ({ buffer: Buffer.from('%PDF'), mimeType: 'application/pdf', filename });

  await chequear('lectura correcta -> comprobantes normalizados, sin errores', async () => {
    proveedorFalso(async () => JSON.stringify([{ moneda: '$', subtotal: 100, serie_numero_factura: 'B 1' }]));
    const r = await facturaService.analizarMultipleArchivos([archivo('a.pdf')]);
    assert.strictEqual(r.errores.length, 0);
    assert.strictEqual(r.comprobantes[0].moneda, 'UYU');
    assert.strictEqual(r.comprobantes[0].numero_factura, 'B1');
  });
  await chequear('sin saldo (402) -> error visible, sin fila vacía y sin reintento', async () => {
    let llamadas = 0;
    proveedorFalso(async () => { llamadas++; throw errorApi(402); });
    const r = await facturaService.analizarMultipleArchivos([archivo('a.pdf')]);
    assert.strictEqual(r.comprobantes.length, 0);
    assert.strictEqual(r.errores[0].archivo, 'a.pdf');
    assert.match(r.errores[0].mensaje, /no está disponible/);
    assert.strictEqual(llamadas, 1);
  });
  await chequear('servicio saturado (429) -> reintenta una vez', async () => {
    let llamadas = 0;
    proveedorFalso(async () => { if (++llamadas === 1) throw errorApi(429); return '[{"subtotal": 5}]'; });
    const r = await facturaService.analizarMultipleArchivos([archivo('a.pdf')]);
    assert.strictEqual(llamadas, 2);
    assert.strictEqual(r.comprobantes[0].monto, 5);
  });
  await chequear('un archivo falla y otro no -> se informan por separado', async () => {
    proveedorFalso(async ({ base64 }) => {
      if (Buffer.from(base64, 'base64').toString() === 'malo') throw errorApi(400);
      return '[{"subtotal": 1}]';
    });
    const r = await facturaService.analizarMultipleArchivos([
      archivo('bien.pdf'), { ...archivo('mal.pdf'), buffer: Buffer.from('malo') },
    ]);
    assert.deepStrictEqual(r.comprobantes.map(c => c.archivo), ['bien.pdf']);
    assert.deepStrictEqual(r.errores.map(e => e.archivo), ['mal.pdf']);
  });
  await chequear('respuesta que no es JSON -> error, no excepción', async () => {
    proveedorFalso(async () => 'no es json');
    const r = await facturaService.analizarMultipleArchivos([archivo('a.pdf')]);
    assert.strictEqual(r.errores.length, 1);
  });

  if (fallos) { console.log(`\n${fallos} fallo(s)`); process.exit(1); }
  console.log('\nTodo OK');
})();
