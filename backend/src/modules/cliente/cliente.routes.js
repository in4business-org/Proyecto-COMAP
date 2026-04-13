const { Router } = require('express');
const multer = require('multer');
const requireClienteToken = require('../../middleware/clienteAuth.middleware');
const clienteService = require('./cliente.service');

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10 MB
});

// ── Router público: acceso con token en URL ────────────────
const clienteRouter = Router();

// GET /api/cliente/:token — snapshot completo del proyecto
clienteRouter.get('/:token', requireClienteToken, async (req, res) => {
  try {
    const data = await clienteService.getVistaProyecto(req.proyectoId, req.empresaId);
    res.json(data);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// POST /api/cliente/:token/comprobantes — subir y procesar una factura
clienteRouter.post(
  '/:token/comprobantes',
  requireClienteToken,
  upload.single('file'),
  async (req, res) => {
    try {
      if (!req.file) return res.status(400).json({ error: 'No se recibió ningún archivo' });
      const periodo = req.body.periodo || 'presentacion';

      const facturas = await clienteService.subirFacturaCliente(
        req.proyectoId,
        req.empresaId,
        periodo,
        req.file,
      );
      res.json({ ok: true, facturas });
    } catch (e) {
      res.status(400).json({ error: e.message });
    }
  }
);

// POST /api/cliente/:token/checklist/:itemId/archivo — subir comprobante
clienteRouter.post(
  '/:token/checklist/:itemId/archivo',
  requireClienteToken,
  upload.single('file'),
  async (req, res) => {
    try {
      const { itemId } = req.params;
      if (!req.file) return res.status(400).json({ error: 'No se recibió ningún archivo' });

      const result = await clienteService.subirComprobante(
        req.proyectoId,
        req.empresaId,
        itemId,
        req.file,
      );
      res.json(result);
    } catch (e) {
      res.status(400).json({ error: e.message });
    }
  }
);

// ── Router admin: protegido con requireAuth (aplicado en main.js) ──
const adminRouter = Router({ mergeParams: true });

// GET /api/empresas/:empresaId/proyectos/:proyectoId/tokens
adminRouter.get('/', async (req, res) => {
  try {
    const { proyectoId } = req.params;
    const tokens = await clienteService.listarTokens(proyectoId);
    res.json(tokens);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// POST /api/empresas/:empresaId/proyectos/:proyectoId/tokens
adminRouter.post('/', async (req, res) => {
  try {
    const { proyectoId } = req.params;
    const { nombre, expira_en } = req.body;
    if (!nombre) return res.status(400).json({ error: 'El nombre es requerido' });

    const token = await clienteService.crearToken(proyectoId, nombre, expira_en);
    res.status(201).json(token);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// DELETE /api/empresas/:empresaId/proyectos/:proyectoId/tokens/:tokenId
adminRouter.delete('/:tokenId', async (req, res) => {
  try {
    const { proyectoId, tokenId } = req.params;
    await clienteService.revocarToken(tokenId, proyectoId);
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

module.exports = { clienteRouter, adminRouter };
