const prisma = require('../../config/prisma');

const CAMPOS_EMPRESA = [
  'rut', 'nombre', 'razon_social', 'domicilio_constituido', 'domicilio_fiscal',
  'telefono', 'email', 'giro', 'codigo_ciiu', 'fecha_balance', 'tipo_contribuyente',
];

class EmpresaService {
  async crear(rut, nombre) {
    const empresaId = `${rut}_${nombre.replace(/\s+/g, '_')}`;

    await prisma.empresa.upsert({
      where: { rut },
      update: { nombre },
      create: {
        id: empresaId,
        rut,
        nombre
      }
    });

    return empresaId;
  }

  /**
   * Lista las empresas visibles para el usuario.
   * `visibles === null` significa administrador: ve todas.
   * @param {string[]|null} visibles
   */
  async listar(visibles) {
    // null = administrador general, ve todas. Cualquier otra cosa (incluido
    // omitir el argumento) se trata como "sin empresas": el default tiene que
    // fallar cerrado, no devolver todo.
    if (visibles === null) return prisma.empresa.findMany();
    if (!Array.isArray(visibles) || visibles.length === 0) return [];
    return prisma.empresa.findMany({ where: { id: { in: visibles } } });
  }

  async getById(empresaId) {
    return prisma.empresa.findUnique({
      where: { id: empresaId }
    });
  }

  async actualizar(empresaId, datos) {
    const validData = {};
    for (const campo of CAMPOS_EMPRESA) {
      if (datos[campo] !== undefined) validData[campo] = datos[campo];
    }
    
    try {
      await prisma.empresa.update({
        where: { id: empresaId },
        data: validData
      });
      return true;
    } catch(e) {
      return false;
    }
  }
}

module.exports = new EmpresaService();
