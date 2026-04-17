const { CognitoJwtVerifier } = require('aws-jwt-verify');

const verifier = CognitoJwtVerifier.create({
  userPoolId: process.env.COGNITO_USER_POOL_ID,
  tokenUse: 'id',
  clientId: process.env.COGNITO_CLIENT_ID,
});

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

    const cached = getCachedUser(token);
    if (cached) {
      req.user = cached;
      return next();
    }

    const authStart = performance.now();
    const payload = await verifier.verify(token);
    console.log(`  [AUTH] verify -> ${(performance.now() - authStart).toFixed(0)}ms (cache miss)`);

    const user = {
      id: payload.sub,
      email: payload.email,
      email_verified: payload.email_verified,
    };

    setCachedUser(token, user);
    req.user = user;
    next();
  } catch (error) {
    console.error('Error de autenticación:', error.message);
    return res.status(401).json({ error: 'Acceso denegado: Token inválido o expirado' });
  }
};

module.exports = requireAuth;
