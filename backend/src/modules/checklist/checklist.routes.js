const { Router } = require('express');
const multer = require('multer');
const fs = require('fs');
const path = require('path');
const checklistService = require('./checklist.service');
const supabaseService = require('../../config/supabase.config');

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
    const { seccion, nombreCarpeta } = checklistService.getUploadPath(
      empresaId, proyectoId, itemId,
    );
    const folderPath = `proyectos/${empresaId}/${proyectoId}/checklist/${seccion}/${nombreCarpeta}`;
    const filePath = `${folderPath}/${req.file.originalname}`;
    
    await supabaseService.uploadFile(filePath, req.file.buffer, req.file.mimetype);
    await checklistService.guardarArchivo(empresaId, proyectoId, itemId, filePath);
    res.json({ ok: true, archivo: filePath });
  } catch(e) {
    res.status(500).json({ error: e.message });
  }
});

// GET /api/empresas/:empresaId/proyectos/:proyectoId/checklist/:itemId/archivo
router.get('/:itemId/archivo', async (req, res) => {
  try {
    const { empresaId, proyectoId, itemId } = req.params;
    const filePath = await checklistService.getArchivoPath(empresaId, proyectoId, itemId);
    if (!filePath) return res.status(404).json({ error: 'Archivo no encontrado' });
    
    const buffer = await supabaseService.downloadFile(filePath);
    const filename = filePath.split('/').pop();
    res.set({
      'Content-Type': 'application/octet-stream',
      'Content-Disposition': `attachment; filename="${filename}"`
    });
    res.send(buffer);
  } catch(e) {
    res.status(500).json({ error: e.message });
  }
});

module.exports = router;
