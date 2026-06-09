import { Amplify } from 'aws-amplify';
import {
  signIn,
  signOut,
  confirmSignIn,
  fetchAuthSession,
  getCurrentUser,
} from 'aws-amplify/auth';
import { Hub } from 'aws-amplify/utils';

const userPoolId = import.meta.env.VITE_COGNITO_USER_POOL_ID;
const userPoolClientId = import.meta.env.VITE_COGNITO_CLIENT_ID;

if (!userPoolId || !userPoolClientId) {
  console.error(
    'Faltan variables VITE_COGNITO_USER_POOL_ID o VITE_COGNITO_CLIENT_ID en el frontend.'
  );
}

Amplify.configure({
  Auth: {
    Cognito: {
      userPoolId,
      userPoolClientId,
    },
  },
});

/**
 * Devuelve el ID token (string) de la sesión actual, o null si no hay sesión.
 * Amplify refresca el token automáticamente si está por expirar.
 * @returns {Promise<{ token: string|null, payload: object|null, expiresAt: number }>}
 */
export async function getIdToken() {
  try {
    const session = await fetchAuthSession();
    const idToken = session.tokens?.idToken;
    if (!idToken) return { token: null, payload: null, expiresAt: 0 };
    return {
      token: idToken.toString(),
      payload: idToken.payload,
      expiresAt: idToken.payload?.exp ? idToken.payload.exp * 1000 : 0,
    };
  } catch {
    return { token: null, payload: null, expiresAt: 0 };
  }
}

export { signIn, signOut, confirmSignIn, fetchAuthSession, getCurrentUser, Hub };
