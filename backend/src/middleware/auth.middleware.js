const { CognitoJwtVerifier } = require('aws-jwt-verify');
const { roleFromGroups, puedeAdministrar } = require('../config/cognito.config');

// Verificador de tokens de Cognito. Valida firma (vía JWKS), expiración,
// issuer y audiencia LOCALMENTE — sólo hace una llamada de red la primera vez
// para descargar las claves públicas del User Pool, luego las cachea.
//
// Enviamos el ID token desde el frontend (trae el claim `email`), por eso
// tokenUse: 'id'. Si preferís usar el access token, cambialo a 'access'
// (pero el access token no incluye email).
const verifier = CognitoJwtVerifier.create({
  userPoolId: process.env.COGNITO_USER_POOL_ID,
  tokenUse: 'id',
  clientId: process.env.COGNITO_CLIENT_ID,
});

// Cache token → payload para evitar re-verificar en cada request.
// TTL de 55 segundos. Máximo 500 entradas para no crecer ilimitado.
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

    // Check cache first — avoid re-verifying a token we already validated recently
    const cached = getCachedUser(token);
    if (cached) {
      req.user = cached;
      return next();
    }

    // Cache miss: verificar el JWT contra Cognito
    const authStart = performance.now();
    let payload;
    try {
      payload = await verifier.verify(token);
    } catch (err) {
      console.log(`  [AUTH] verify rechazado: ${err.message}`);
      return res.status(401).json({ error: 'Acceso denegado: Token inválido o expirado' });
    }
    console.log(`  [AUTH] verify -> ${(performance.now() - authStart).toFixed(0)}ms (cache miss)`);

    // Normalizamos a una forma parecida a la que entregaba Supabase
    const groups = payload['cognito:groups'] || [];
    const user = {
      id: payload.sub,
      sub: payload.sub,
      email: payload.email,
      username: payload['cognito:username'] || payload.email,
      groups,
      role: roleFromGroups(groups),
      claims: payload,
    };

    setCachedUser(token, user);
    req.user = user;
    next();
  } catch (error) {
    console.error('Error de autenticación:', error);
    res.status(500).json({ error: 'Error interno en middleware de validación' });
  }
};

/**
 * Exige rol `master`: administración de toda la plataforma.
 * Se monta SIEMPRE después de requireAuth.
 *
 * Ojo: el rol sale del claim `cognito:groups` del ID token, así que un cambio
 * de rol recién se refleja cuando el token se renueva (~1h) o el usuario
 * vuelve a iniciar sesión.
 */
const requireMaster = (req, res, next) => {
  if (req.method === 'OPTIONS') return next();

  if (req.user?.role !== 'master') {
    return res.status(403).json({
      error: 'Acceso denegado: esta acción es exclusiva de un administrador general',
    });
  }
  next();
};

/**
 * Exige acceso al panel de administración: `master` o `admin_empresa`.
 * Que pueda entrar no significa que pueda tocar a cualquiera; el alcance de un
 * admin de empresa se recorta después, empresa por empresa, en admin.service.
 */
const requirePanel = (req, res, next) => {
  if (req.method === 'OPTIONS') return next();

  if (!puedeAdministrar(req.user?.role)) {
    return res.status(403).json({ error: 'Acceso denegado: se requieren permisos de administrador' });
  }
  next();
};

module.exports = requireAuth;
module.exports.requireAuth = requireAuth;
module.exports.requireMaster = requireMaster;
module.exports.requirePanel = requirePanel;
