const { Router } = require('express');
const multer = require('multer');
const fs = require('fs');
const simuladorService = require('./simulador.service');

const upload = multer({ storage: multer.memoryStorage() });
const router = Router({ mergeParams: true });

// GET /api/empresas/:empresaId/proyectos/:proyectoId/simulador/descargar
router.get('/descargar', async (req, res) => {
  try {
    const { empresaId, proyectoId } = req.params;
    const buffer = await simuladorService.getSimuladorBuffer(empresaId, proyectoId);
    if (!buffer) return res.status(404).json({ error: 'Simulador no encontrado' });
    res.set({
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': 'attachment; filename=Simulador_COMAP.xlsx',
    });
    res.send(buffer);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// POST /api/empresas/:empresaId/proyectos/:proyectoId/simulador/subir
router.post('/subir', upload.single('file'), async (req, res) => {
  try {
    const { empresaId, proyectoId } = req.params;
    const resultados = await simuladorService.subirSimulador(empresaId, proyectoId, req.file.buffer);
    res.json({ ok: true, resultados });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: e.message });
  }
});

// GET /api/empresas/:empresaId/proyectos/:proyectoId/simulador/resultados
router.get('/resultados', async (req, res) => {
  try {
    const { empresaId, proyectoId } = req.params;
    res.json(await simuladorService.getResultados(empresaId, proyectoId));
  } catch(e) {
    res.status(500).json({ error: e.message });
  }
});

module.exports = router;
