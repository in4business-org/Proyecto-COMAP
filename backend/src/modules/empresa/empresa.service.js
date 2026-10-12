const prisma = require('../../config/prisma');

const CAMPOS_EMPRESA = [
  'rut', 'nombre', 'razon_social', 'domicilio_constituido', 'domicilio_fiscal',
  'telefono', 'email', 'giro', 'codigo_ciiu', 'fecha_balance', 'tipo_contribuyente',
];

class EmpresaService {
  /**
   * Da de alta una empresa. `datos` puede traer el resto de CAMPOS_EMPRESA.
   * Si ya hay una empresa con ese RUT no la toca: tira un error con status
   * 409 y el id de la existente (antes hacía upsert y le cambiaba el nombre
   * sin avisar).
   */
  async crear(rut, nombre, datos = {}) {
    const existente = await prisma.empresa.findUnique({ where: { rut } });
    if (existente) {
      const err = new Error(`Ya existe una empresa con ese RUT: ${existente.nombre}`);
      err.status = 409;
      err.empresaId = existente.id;
      throw err;
    }

    const empresaId = `${rut}_${nombre.replace(/\s+/g, '_')}`;
    const extra = {};
    for (const campo of CAMPOS_EMPRESA) {
      if (campo !== 'rut' && campo !== 'nombre' && datos[campo] !== undefined && datos[campo] !== '') {
        extra[campo] = datos[campo];
      }
    }
    await prisma.empresa.create({ data: { id: empresaId, rut, nombre, ...extra } });
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
