const prisma = require('../../config/prisma');
const { parseStringPromise } = require('xml2js');

const BCU_URL = 'https://cotizaciones.bcu.gub.uy/wscotizaciones/servlet/awsbcucotizaciones';
const MONEDA_USD = 2224;
const MONEDA_UI = 9800;

function buildSoapBody(codigoMoneda, fechaStr) {
    return `<?xml version="1.0" encoding="UTF-8"?>
    <soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/" xmlns:cot="Cotiza">
      <soapenv:Header/>
      <soapenv:Body>
        <cot:wsbcucotizaciones.Execute>
          <cot:Entrada>
            <cot:Moneda>
              <cot:item>${codigoMoneda}</cot:item>
            </cot:Moneda>
            <cot:FechaDesde>${fechaStr}</cot:FechaDesde>
            <cot:FechaHasta>${fechaStr}</cot:FechaHasta>
            <cot:Grupo>0</cot:Grupo>
          </cot:Entrada>
        </cot:wsbcucotizaciones.Execute>
      </soapenv:Body>
    </soapenv:Envelope>`;
}

// Devuelve el valor TCV para una moneda en una fecha exacta, o null si no hay cotización
async function fetchCotizacionBCU(codigoMoneda, fecha) {
    const fechaStr = fecha.toISOString().split('T')[0];

    const response = await fetch(BCU_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'text/xml; charset=utf-8', 'SOAPAction': '""' },
        body: buildSoapBody(codigoMoneda, fechaStr),
    });

    const xml = await response.text();
    const parsed = await parseStringPromise(xml, { explicitArray: false });

    // Navegar hasta datoscotizaciones — ajustar según respuesta real de Postman
    const body = parsed?.['SOAP-ENV:Envelope']?.['SOAP-ENV:Body'];
    const respuesta = body?.['wsbcucotizaciones.ExecuteResponse'];
    const status = respuesta?.respuestastatus?.Status;

    if (status !== 'OK') return null;

    const item = respuesta?.datoscotizaciones?.item;
    if (!item) return null;

    // Puede venir como array o como objeto único
    const items = Array.isArray(item) ? item : [item];
    if (items.length === 0) return null;

    return parseFloat(items[0].TCV);
}

// Busca hacia atrás hasta encontrar un día con cotización
async function fetchUltimoDiaHabilBCU(codigoMoneda, fechaBase) {
    const fecha = new Date(fechaBase);

    for (let i = 0; i < 10; i++) {
        const valor = await fetchCotizacionBCU(codigoMoneda, fecha);
        if (valor !== null) return valor;
        fecha.setDate(fecha.getDate() - 1);
    }

    throw new Error(`No se encontró cotización para moneda ${codigoMoneda} en los últimos 10 días`);
}

// Devuelve el último día del mes anterior como objeto Date
function getUltimoDiaMesAnterior() {
    const hoy = new Date();
    return new Date(hoy.getFullYear(), hoy.getMonth(), 0);
}

// Formatea fecha como YYYY-MM-DD para comparar con la BD
function formatFecha(date) {
    return date.toISOString().split('T')[0];
}

class CotizacionService {

    async getCotizacionMesAnterior() {
        const ultimoDia = getUltimoDiaMesAnterior();
        const fechaKey = formatFecha(ultimoDia); // ej: "2026-02-28"

        // 1. Buscar en BD
        const existente = await prisma.cotizacion.findFirst({
            where: { fecha: fechaKey }
        });

        if (existente) return existente;

        // 2. No existe — consultar BCU
        let valor_usd, valor_ui;

        try {
            valor_usd = await fetchUltimoDiaHabilBCU(MONEDA_USD, ultimoDia); // USD
        } catch {
            valor_usd = null;
        }

        try {
            valor_ui = await fetchUltimoDiaHabilBCU(MONEDA_UI, ultimoDia); // Unidad indexada
        } catch {
            valor_ui = null;
        }

        if (valor_usd === null && valor_ui === null) {
            throw new Error('Servicio BCU no disponible');
        }

        // 3. Guardar en BD con la fecha del último día del mes (no del día hábil encontrado)
        const nueva = await prisma.cotizacion.create({
            data: {
                id: `${fechaKey}`,
                fecha: fechaKey,
                valor_usd: valor_usd ?? 0,
                valor_ui: valor_ui ?? 0,
            }
        });

        return nueva;
    }

    async listar() {
        return prisma.cotizacion.findMany({
            orderBy: { fecha: 'desc' }
        });
    }

    async eliminar(id) {
        try {
            await prisma.cotizacion.delete({ where: { id } });
            return true;
        } catch {
            return false;
        }
    }
}

module.exports = new CotizacionService();