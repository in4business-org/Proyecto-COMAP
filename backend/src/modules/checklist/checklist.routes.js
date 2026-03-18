const { Router } = require('express');
const multer = require('multer');
const fs = require('fs');
const path = require('path');
const checklistService = require('./checklist.service');

const upload = multer({ storage: multer.memoryStorage() });
const router = Router({ mergeParams: true });

// GET /api/empresas/:empresaId/proyectos/:proyectoId/checklist
router.get('/', (req, res) => {
  const { empresaId, proyectoId } = req.params;
  res.json(checklistService.getChecklist(empresaId, proyectoId));
});

// PATCH /api/empresas/:empresaId/proyectos/:proyectoId/checklist/:itemId
router.patch('/:itemId', (req, res) => {
  const { empresaId, proyectoId, itemId } = req.params;
  const ok = checklistService.actualizarItem(
    empresaId, proyectoId, itemId,
    req.body.estado, req.body.nota_usuario || '',
  );
  if (!ok) return res.status(404).json({ error: 'Checklist no encontrado' });
  res.json({ ok: true });
});

// POST /api/empresas/:empresaId/proyectos/:proyectoId/checklist/:itemId/archivo
router.post('/:itemId/archivo', upload.single('file'), (req, res) => {
  const { empresaId, proyectoId, itemId } = req.params;
  const { carpetaBase, seccion, nombreCarpeta } = checklistService.getUploadPath(
    empresaId, proyectoId, itemId,
  );
  const carpeta = path.join(carpetaBase, seccion, nombreCarpeta);
  fs.mkdirSync(carpeta, { recursive: true });
  fs.writeFileSync(path.join(carpeta, req.file.originalname), req.file.buffer);
  const rutaRelativa = path.join(seccion, nombreCarpeta, req.file.originalname);
  checklistService.guardarArchivo(empresaId, proyectoId, itemId, rutaRelativa);
  res.json({ ok: true, archivo: rutaRelativa });
});

// GET /api/empresas/:empresaId/proyectos/:proyectoId/checklist/:itemId/archivo
router.get('/:itemId/archivo', (req, res) => {
  const { empresaId, proyectoId, itemId } = req.params;
  const result = checklistService.getArchivoPath(empresaId, proyectoId, itemId);
  if (!result) return res.status(404).json({ error: 'Archivo no encontrado' });
  res.download(result.ruta, result.nombre);
});

module.exports = router;
