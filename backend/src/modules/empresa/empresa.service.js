const fs = require('fs');
const path = require('path');
const { PROYECTOS_DIR } = require('../../config/storage.config');

const CAMPOS_EMPRESA = [
  'rut', 'nombre', 'razon_social', 'domicilio_constituido', 'domicilio_fiscal',
  'telefono', 'email', 'giro', 'codigo_ciiu', 'fecha_balance', 'tipo_contribuyente',
];

class EmpresaService {
  crear(rut, nombre) {
    const empresaId = `${rut}_${nombre.replace(/\s+/g, '_')}`;
    const dir = path.join(PROYECTOS_DIR, empresaId);
    fs.mkdirSync(dir, { recursive: true });

    const infoPath = path.join(dir, 'info.json');
    if (!fs.existsSync(infoPath)) {
      const info = {};
      for (const campo of CAMPOS_EMPRESA) info[campo] = '';
      info.rut = rut;
      info.nombre = nombre;
      info.id = empresaId;
      fs.writeFileSync(infoPath, JSON.stringify(info, null, 2), 'utf-8');
    }
    return empresaId;
  }

  listar() {
    if (!fs.existsSync(PROYECTOS_DIR)) return [];
    const empresas = [];
    for (const carpeta of fs.readdirSync(PROYECTOS_DIR)) {
      const infoPath = path.join(PROYECTOS_DIR, carpeta, 'info.json');
      if (fs.existsSync(infoPath)) {
        const info = JSON.parse(fs.readFileSync(infoPath, 'utf-8'));
        info.id = carpeta;
        empresas.push(info);
      }
    }
    return empresas;
  }

  getById(empresaId) {
    const infoPath = path.join(PROYECTOS_DIR, empresaId, 'info.json');
    if (!fs.existsSync(infoPath)) return null;
    const info = JSON.parse(fs.readFileSync(infoPath, 'utf-8'));
    info.id = empresaId;
    return info;
  }

  actualizar(empresaId, datos) {
    const infoPath = path.join(PROYECTOS_DIR, empresaId, 'info.json');
    if (!fs.existsSync(infoPath)) return false;
    const info = JSON.parse(fs.readFileSync(infoPath, 'utf-8'));
    for (const campo of CAMPOS_EMPRESA) {
      if (datos[campo] !== undefined) info[campo] = datos[campo];
    }
    info.id = empresaId;
    fs.writeFileSync(infoPath, JSON.stringify(info, null, 2), 'utf-8');
    return true;
  }
}

module.exports = new EmpresaService();
