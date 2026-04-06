const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);

// Cache token → user para evitar una llamada de red a Supabase en cada request.
// TTL de 55 segundos (tokens de Supabase duran 1 hora).
// Máximo 500 entradas para no crecer ilimitado.
const TOKEN_CACHE = new Map();
const TOKEN_TTL = 55 * 1000;
const TOKEN_CACHE_MAX = 500;

function getCachedUser(token) {
  const entry = TOKEN_CACHE.get(token);
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) {
    TOKEN_CACHE.delete(token);
    return null;
  }
  return entry.user;
}

function setCachedUser(token, user) {
  if (TOKEN_CACHE.size >= TOKEN_CACHE_MAX) {
    // Evict the oldest entry
    TOKEN_CACHE.delete(TOKEN_CACHE.keys().next().value);
  }
  TOKEN_CACHE.set(token, { user, expiresAt: Date.now() + TOKEN_TTL });
}

const requireAuth = async (req, res, next) => {
  if (req.method === 'OPTIONS') {
    return next();
  }

  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Acceso denegado: Token no proporcionado' });
    }

    const token = authHeader.split(' ')[1];

    // Check cache first — avoid a network call if we already validated this token recently
    const cached = getCachedUser(token);
    if (cached) {
      req.user = cached;
      return next();
    }

    // Cache miss: validate with Supabase (network call)
    const authStart = performance.now();
    const { data: { user }, error } = await supabase.auth.getUser(token);
    console.log(`  [AUTH] getUser -> ${(performance.now() - authStart).toFixed(0)}ms (cache miss)`);

    if (error || !user) {
      return res.status(401).json({ error: 'Acceso denegado: Token inválido o expirado' });
    }

    setCachedUser(token, user);
    req.user = user;
    next();
  } catch (error) {
    console.error('Error de autenticación:', error);
    res.status(500).json({ error: 'Error interno en middleware de validación' });
  }
};

module.exports = requireAuth;
