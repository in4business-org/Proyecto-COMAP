const { Router } = require('express');
const proyectoService = require('./proyecto.service');

const router = Router({ mergeParams: true });

// POST /api/empresas/:empresaId/proyectos
router.post('/', async (req, res) => {
  try {
    const { empresaId } = req.params;
    const { anio_presentacion, duracion_seguimiento, fecha_presentacion } = req.body;
    const proyecto_id = await proyectoService.crear(
      empresaId, parseInt(anio_presentacion), parseInt(duracion_seguimiento),
      fecha_presentacion || null,
    );
    res.json({ proyecto_id });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: e.message });
  }
});

// GET /api/empresas/:empresaId/proyectos
router.get('/', async (req, res) => {
  try {
    res.json(await proyectoService.listar(req.params.empresaId));
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// PATCH /api/empresas/:empresaId/proyectos/:proyectoId/expediente
router.patch('/:proyectoId/expediente', async (req, res) => {
  try {
    const { empresaId, proyectoId } = req.params;
    const ok = await proyectoService.actualizarExpediente(empresaId, proyectoId, req.body.expediente);
    if (!ok) return res.status(404).json({ error: 'Proyecto no encontrado' });
    res.json({ ok: true });
  } catch(e) {
    res.status(500).json({ error: e.message });
  }
});

// PATCH /api/empresas/:empresaId/proyectos/:proyectoId/metadata
router.patch('/:proyectoId/metadata', async (req, res) => {
  try {
    const { empresaId, proyectoId } = req.params;
    const ok = await proyectoService.actualizarMetadata(empresaId, proyectoId, req.body);
    if (!ok) return res.status(404).json({ error: 'Proyecto no encontrado' });
    res.json({ ok: true });
  } catch(e) {
    res.status(500).json({ error: e.message });
  }
});

module.exports = router;
