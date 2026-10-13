const { Router } = require('express');
const empresaService = require('./empresa.service');
const accesoService = require('../acceso/acceso.service');
const { requireEscritura } = require('../../middleware/acceso.middleware');
const { requireMaster } = require('../../middleware/auth.middleware');
const { limpiarRut, problemaRut } = require('../../common/utils/rut');

const router = Router();

// POST /api/empresas
router.post('/', async (req, res) => {
  try {
    const { rut, nombre, ...datos } = req.body || {};
    const nombreLimpio = String(nombre || '').trim();
    if (!rut || !nombreLimpio) return res.status(400).json({ error: 'El RUT y el nombre son obligatorios' });
    const problema = problemaRut(rut);
    if (problema) return res.status(400).json({ error: problema });
    const empresa_id = await empresaService.crear(limpiarRut(rut), nombreLimpio, datos);
    res.json({ empresa_id });
  } catch(e) {
    if (e.status === 409) return res.status(409).json({ error: e.message, empresa_id: e.empresaId });
    res.status(500).json({ error: e.message });
  }
});

// GET /api/empresas
router.get('/', async (req, res) => {
  try {
    const visibles = await accesoService.getEmpresasVisibles(req.user);
    res.json(await empresaService.listar(visibles));
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
router.put('/:empresaId', requireEscritura('empresa'), async (req, res) => {
  try {
    const ok = await empresaService.actualizar(req.params.empresaId, req.body);
    if (!ok) return res.status(404).json({ error: 'Empresa no encontrada' });
    res.json({ ok: true });
  } catch(e) {
    res.status(500).json({ error: e.message });
  }
});

// GET /api/empresas/:empresaId/borrado
// Cuánto se pierde al borrar: sólo lo pide quien puede borrar
router.get('/:empresaId/borrado', requireMaster, async (req, res) => {
  try {
    res.json(await empresaService.resumenBorrado(req.params.empresaId));
  } catch(e) {
    res.status(500).json({ error: e.message });
  }
});

// DELETE /api/empresas/:empresaId
// Exclusivo del administrador general: borra la empresa con todo lo suyo.
router.delete('/:empresaId', requireMaster, async (req, res) => {
  try {
    const ok = await empresaService.eliminar(req.params.empresaId);
    if (!ok) return res.status(404).json({ error: 'Empresa no encontrada' });
    res.json({ ok: true });
  } catch(e) {
    res.status(500).json({ error: e.message });
  }
});

module.exports = router;
