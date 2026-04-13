const prisma = require('../config/prisma');

/**
 * Middleware de autenticación para el portal de cliente.
 * Valida un token opaco almacenado en DB (independiente de Supabase).
 * El token puede venir de req.params.token o del header Authorization.
 */
module.exports = async (req, res, next) => {
  const token = req.params.token
    || req.headers.authorization?.replace('Bearer ', '');

  if (!token) return res.status(401).json({ error: 'Token requerido' });

  let record;
  try {
    record = await prisma.clienteToken.findUnique({
      where: { token },
      include: { proyecto: { select: { id: true, empresaId: true } } }
    });
  } catch (e) {
    return res.status(500).json({ error: 'Error interno al validar token' });
  }

  if (!record || !record.activo)
    return res.status(401).json({ error: 'Token inválido o revocado' });

  if (record.expira_en && record.expira_en < new Date())
    return res.status(401).json({ error: 'Token expirado' });

  // Fire-and-forget: actualizar último uso sin bloquear la respuesta
  prisma.clienteToken.update({
    where: { id: record.id },
    data: { ultimo_uso: new Date() }
  }).catch(() => {});

  req.clienteToken = record;
  req.proyectoId = record.proyectoId;
  req.empresaId = record.proyecto.empresaId;
  next();
};
