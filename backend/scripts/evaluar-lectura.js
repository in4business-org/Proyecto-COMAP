/**
 * Set de control de la lectura con IA: lee una carpeta de PDF con la misma
 * lectura que usa la plataforma (sin tocar la base ni S3) y la compara contra
 * un CSV con los datos correctos. Sirve para medir si un cambio de prompt,
 * modelo o normalización mejora o empeora.
 *
 *   node scripts/evaluar-lectura.js --carpeta <pdfs> --esperado <esperado.csv> \
 *     [--empresa-rut 21...] [--empresa-nombre "Empresa SA"] [--salida resultado.json]
 *
 * Para comparar modelos: IA_MODELO=gemini-2.5-pro node scripts/evaluar-lectura.js ...
 *
 * esperado.csv (separado por ; con encabezado): archivo;fecha;numero_factura;
 * proveedor;rut;moneda;monto;categoria;tipo_comprobante. Una celda vacía no
 * se evalúa. Los datos de clientes no van al repo: el CSV y los PDF quedan afuera.
 */
require('dotenv').config({ quiet: true });
const fs = require('fs');
const path = require('path');
const facturaService = require('../src/modules/factura/factura.service');

const CAMPOS = ['fecha', 'numero_factura', 'proveedor', 'rut', 'moneda', 'monto', 'categoria', 'tipo_comprobante'];

function argumentos() {
  const a = {};
  const v = process.argv.slice(2);
  for (let i = 0; i < v.length; i += 2) a[v[i].replace(/^--/, '')] = v[i + 1];
  if (!a.carpeta || !a.esperado) {
    console.error('Uso: node scripts/evaluar-lectura.js --carpeta <pdfs> --esperado <esperado.csv> [--empresa-rut ...] [--empresa-nombre ...] [--salida ...]');
    process.exit(1);
  }
  return a;
}

function leerCsv(ruta) {
  const [encabezado, ...filas] = fs.readFileSync(ruta, 'utf8').replace(/^﻿/, '').split(/\r?\n/).filter((l) => l.trim());
  const cols = encabezado.split(';').map((c) => c.trim());
  return filas.map((l) => Object.fromEntries(l.split(';').map((v, i) => [cols[i], v.trim()])));
}

const simple = (s) => String(s ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase().replace(/[^A-Z0-9]/g, '');

/** ¿El valor leído coincide con el esperado? Monto con tolerancia de un centavo, proveedor sin puntuación */
function coincide(campo, leido, esperado) {
  if (campo === 'monto') {
    const n = parseFloat(String(esperado).replace(',', '.'));
    return leido != null && Math.abs(Number(leido) - n) <= 0.01;
  }
  if (campo === 'proveedor') {
    const a = simple(leido);
    const b = simple(esperado);
    return Boolean(a && b && (a.includes(b) || b.includes(a)));
  }
  return simple(leido) === simple(esperado);
}

(async () => {
  const a = argumentos();
  const esperados = leerCsv(a.esperado);
  const empresa = a['empresa-rut'] ? { rut: a['empresa-rut'], nombre: a['empresa-nombre'] || '' } : undefined;

  const archivos = esperados.map((e) => e.archivo).filter((f) => fs.existsSync(path.join(a.carpeta, f)));
  const faltan = esperados.length - archivos.length;
  const inicio = Date.now();
  const { comprobantes, errores } = await facturaService.analizarMultipleArchivos(
    archivos.map((f) => ({ buffer: fs.readFileSync(path.join(a.carpeta, f)), mimeType: 'application/pdf', filename: f })),
    { empresa },
  );
  const segundos = Math.round((Date.now() - inicio) / 1000);

  const aciertos = Object.fromEntries(CAMPOS.map((c) => [c, { ok: 0, total: 0 }]));
  const fallas = [];
  for (const e of esperados) {
    const leidos = comprobantes.filter((c) => c.archivo === e.archivo);
    if (leidos.length !== 1) {
      if (archivos.includes(e.archivo)) fallas.push(`${e.archivo}: ${leidos.length} comprobantes leídos`);
      continue;
    }
    for (const campo of CAMPOS) {
      if (!e[campo]) continue;
      aciertos[campo].total++;
      if (coincide(campo, leidos[0][campo], e[campo])) aciertos[campo].ok++;
      else fallas.push(`${e.archivo}: ${campo} leído "${leidos[0][campo] ?? ''}", esperado "${e[campo]}"`);
    }
  }

  console.log(`\nModelo: ${process.env.IA_MODELO || 'el del proveedor por defecto'} · ${archivos.length} archivos en ${segundos} s`);
  if (faltan) console.log(`(${faltan} archivos del CSV no están en la carpeta)`);
  for (const campo of CAMPOS) {
    const { ok, total } = aciertos[campo];
    if (total) console.log(`${campo.padEnd(17)} ${String(ok).padStart(3)} de ${String(total).padEnd(3)} ${Math.round((ok / total) * 100)}%`);
  }
  if (errores.length) console.log(`\nNo se pudieron leer ${errores.length}:`, errores.map((e) => `${e.archivo} (${e.mensaje})`).join('; '));
  if (fallas.length) console.log(`\nDiferencias:\n- ${fallas.join('\n- ')}`);
  if (a.salida) fs.writeFileSync(a.salida, JSON.stringify({ comprobantes, errores }, null, 2));
})();
