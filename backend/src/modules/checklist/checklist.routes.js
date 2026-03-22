const { Router } = require('express');
const multer = require('multer');
const fs = require('fs');
const path = require('path');
const checklistService = require('./checklist.service');

const upload = multer({ storage: multer.memoryStorage() });
const router = Router({ mergeParams: true });

// GET /api/empresas/:empresaId/proyectos/:proyectoId/checklist
router.get('/', async (req, res) => {
  try {
    const { empresaId, proyectoId } = req.params;
    res.json(await checklistService.getChecklist(empresaId, proyectoId));
  } catch(e) {
    res.status(500).json({ error: e.message });
  }
});

// PATCH /api/empresas/:empresaId/proyectos/:proyectoId/checklist/:itemId
router.patch('/:itemId', async (req, res) => {
  try {
    const { empresaId, proyectoId, itemId } = req.params;
    const ok = await checklistService.actualizarItem(
      empresaId, proyectoId, itemId,
      req.body.estado, req.body.nota_usuario || '',
    );
    if (!ok) return res.status(404).json({ error: 'Checklist no encontrado' });
    res.json({ ok: true });
  } catch(e) {
    res.status(500).json({ error: e.message });
  }
});

// POST /api/empresas/:empresaId/proyectos/:proyectoId/checklist/:itemId/archivo
router.post('/:itemId/archivo', upload.single('file'), async (req, res) => {
  try {
    const { empresaId, proyectoId, itemId } = req.params;
    const { carpetaBase, seccion, nombreCarpeta } = checklistService.getUploadPath(
      empresaId, proyectoId, itemId,
    );
    const carpeta = path.join(carpetaBase, seccion, nombreCarpeta);
    fs.mkdirSync(carpeta, { recursive: true });
    fs.writeFileSync(path.join(carpeta, req.file.originalname), req.file.buffer);
    const rutaRelativa = path.join(seccion, nombreCarpeta, req.file.originalname);
    
    await checklistService.guardarArchivo(empresaId, proyectoId, itemId, rutaRelativa);
    res.json({ ok: true, archivo: rutaRelativa });
  } catch(e) {
    res.status(500).json({ error: e.message });
  }
});

// GET /api/empresas/:empresaId/proyectos/:proyectoId/checklist/:itemId/archivo
router.get('/:itemId/archivo', async (req, res) => {
  try {
    const { empresaId, proyectoId, itemId } = req.params;
    const result = await checklistService.getArchivoPath(empresaId, proyectoId, itemId);
    if (!result) return res.status(404).json({ error: 'Archivo no encontrado' });
    res.download(result.ruta, result.nombre);
  } catch(e) {
    res.status(500).json({ error: e.message });
  }
});

module.exports = router;
