const { Router } = require('express');
const proyectoService = require('./proyecto.service');

const router = Router({ mergeParams: true });

// POST /api/empresas/:empresaId/proyectos
router.post('/', (req, res) => {
  try {
    const { empresaId } = req.params;
    const { anio_presentacion, duracion_seguimiento, fecha_presentacion } = req.body;
    const proyecto_id = proyectoService.crear(
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
router.get('/', (req, res) => {
  res.json(proyectoService.listar(req.params.empresaId));
});

// PATCH /api/empresas/:empresaId/proyectos/:proyectoId/expediente
router.patch('/:proyectoId/expediente', (req, res) => {
  const { empresaId, proyectoId } = req.params;
  const ok = proyectoService.actualizarExpediente(empresaId, proyectoId, req.body.expediente);
  if (!ok) return res.status(404).json({ error: 'Proyecto no encontrado' });
  res.json({ ok: true });
});

// PATCH /api/empresas/:empresaId/proyectos/:proyectoId/metadata
router.patch('/:proyectoId/metadata', (req, res) => {
  const { empresaId, proyectoId } = req.params;
  const ok = proyectoService.actualizarMetadata(empresaId, proyectoId, req.body);
  if (!ok) return res.status(404).json({ error: 'Proyecto no encontrado' });
  res.json({ ok: true });
});

module.exports = router;
