const fs = require('fs');
const path = require('path');
const { PROYECTOS_DIR } = require('../../config/storage.config');
const prisma = require('../../config/prisma');

const CAMPOS_EMPRESA = [
  'rut', 'nombre', 'razon_social', 'domicilio_constituido', 'domicilio_fiscal',
  'telefono', 'email', 'giro', 'codigo_ciiu', 'fecha_balance', 'tipo_contribuyente',
];

class EmpresaService {
  async crear(rut, nombre) {
    const empresaId = `${rut}_${nombre.replace(/\s+/g, '_')}`;
    
    // Keep directory creation for compatibility with files
    const dir = path.join(PROYECTOS_DIR, empresaId);
    fs.mkdirSync(dir, { recursive: true });

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

  async listar() {
    return prisma.empresa.findMany();
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
