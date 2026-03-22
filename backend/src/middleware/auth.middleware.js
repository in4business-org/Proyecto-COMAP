const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);

const requireAuth = async (req, res, next) => {
  // Omitimos la autenticación en el método OPTIONS por los preflights de CORS
  if (req.method === 'OPTIONS') {
    return next();
  }

  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Acceso denegado: Token no proporcionado' });
    }

    const token = authHeader.split(' ')[1];
    
    // Validar el JWT token mediante Supabase
    const { data: { user }, error } = await supabase.auth.getUser(token);

    if (error || !user) {
      return res.status(401).json({ error: 'Acceso denegado: Token inválido o expirado' });
    }

    // Adjuntar la información del usuario en caso de que las rutas lo necesiten
    req.user = user;
    next();
  } catch (error) {
    console.error('Error de autenticación:', error);
    res.status(500).json({ error: 'Error interno en middleware de validación' });
  }
};

module.exports = requireAuth;
