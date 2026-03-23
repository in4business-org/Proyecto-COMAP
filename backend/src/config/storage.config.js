const path = require('path');

const STORAGE_BASE = process.env.STORAGE_PATH || path.join(__dirname, '..', '..', 'storage');

module.exports = {
  STORAGE_BASE,
  PROYECTOS_DIR: path.join(STORAGE_BASE, 'proyectos'),
  UPLOADS_DIR: path.join(STORAGE_BASE, 'uploads'),
  OUTPUTS_DIR: path.join(STORAGE_BASE, 'outputs'),
  TEMPLATES_DIR: path.join(__dirname, '..', 'assets', 'templates', 'decreto_329'),
  TEMPLATE_CUADRO: path.join(__dirname, '..', 'assets', 'templates', 'decreto_329', 'cuadro_inversiones_template.xlsx'),
  TEMPLATE_SIMULADOR: path.join(__dirname, '..', 'assets', 'templates', 'decreto_329', '0_Simulador.xlsx'),
};
