const { Router } = require('express');
const empresaService = require('./empresa.service');

const router = Router();

// POST /api/empresas
router.post('/', (req, res) => {
  const { rut, nombre } = req.body;
  if (!rut || !nombre) return res.status(400).json({ error: 'rut y nombre son requeridos' });
  const empresa_id = empresaService.crear(rut, nombre);
  res.json({ empresa_id });
});

// GET /api/empresas
router.get('/', (_req, res) => {
  res.json(empresaService.listar());
});

// GET /api/empresas/:empresaId
router.get('/:empresaId', (req, res) => {
  const empresa = empresaService.getById(req.params.empresaId);
  if (!empresa) return res.status(404).json({ error: 'Empresa no encontrada' });
  res.json(empresa);
});

// PUT /api/empresas/:empresaId
router.put('/:empresaId', (req, res) => {
  const ok = empresaService.actualizar(req.params.empresaId, req.body);
  if (!ok) return res.status(404).json({ error: 'Empresa no encontrada' });
  res.json({ ok: true });
});

module.exports = router;
