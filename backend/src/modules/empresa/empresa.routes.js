const { Router } = require('express');
const empresaService = require('./empresa.service');

const router = Router();

// POST /api/empresas
router.post('/', async (req, res) => {
  try {
    const { rut, nombre } = req.body;
    if (!rut || !nombre) return res.status(400).json({ error: 'rut y nombre son requeridos' });
    const empresa_id = await empresaService.crear(rut, nombre);
    res.json({ empresa_id });
  } catch(e) {
    res.status(500).json({ error: e.message });
  }
});

// GET /api/empresas
router.get('/', async (_req, res) => {
  try {
    res.json(await empresaService.listar());
  } catch(e) {
    res.status(500).json({ error: e.message });
  }
});

// GET /api/empresas/:empresaId
router.get('/:empresaId', async (req, res) => {
  try {
    const empresa = await empresaService.getById(req.params.empresaId);
    if (!empresa) return res.status(404).json({ error: 'Empresa no encontrada' });
    res.json(empresa);
  } catch(e) {
    res.status(500).json({ error: e.message });
  }
});

// PUT /api/empresas/:empresaId
router.put('/:empresaId', async (req, res) => {
  try {
    const ok = await empresaService.actualizar(req.params.empresaId, req.body);
    if (!ok) return res.status(404).json({ error: 'Empresa no encontrada' });
    res.json({ ok: true });
  } catch(e) {
    res.status(500).json({ error: e.message });
  }
});

module.exports = router;
