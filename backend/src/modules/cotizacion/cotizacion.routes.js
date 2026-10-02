const { Router } = require('express');
const cotizacionService = require('./cotizacion.service');
const { requireMaster } = require('../../middleware/auth.middleware');

const router = Router();

// Obtener cotización del mes anterior (con fallback al BCU)
router.get('/mes-anterior', async (req, res) => {
    try {
        const data = await cotizacionService.getCotizacionMesAnterior(req.query.fecha || null);
        res.json(data);
    } catch (err) {
        res.status(503).json({ error: err.message });
    }
});

// Listar todas (para el módulo de configuración)
router.get('/', async (req, res) => {
    const data = await cotizacionService.listar();
    res.json(data);
});

// Eliminar (para el módulo de configuración)
// Las cotizaciones son datos globales que alimentan los calculos de todas las
// empresas: borrarlas no puede estar al alcance de cualquier usuario logueado.
router.delete('/:id', requireMaster, async (req, res) => {
    const ok = await cotizacionService.eliminar(req.params.id);
    res.status(ok ? 200 : 404).json({ ok });
});

module.exports = router;