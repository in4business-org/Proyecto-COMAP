import {
  CognitoUserPool,
  CognitoUser,
  AuthenticationDetails,
} from 'amazon-cognito-identity-js';

const userPoolId = import.meta.env.VITE_COGNITO_USER_POOL_ID;
const clientId = import.meta.env.VITE_COGNITO_CLIENT_ID;

if (!userPoolId || !clientId) {
  console.error('Faltan VITE_COGNITO_USER_POOL_ID o VITE_COGNITO_CLIENT_ID en el frontend.');
}

export const userPool = new CognitoUserPool({
  UserPoolId: userPoolId,
  ClientId: clientId,
});

function sessionToShape(cognitoUser, cognitoSession) {
  const idToken = cognitoSession.getIdToken();
  const payload = idToken.payload;
  return {
    access_token: idToken.getJwtToken(),
    expires_at: payload.exp,
    user: {
      id: payload.sub,
      email: payload.email,
    },
    _cognitoUser: cognitoUser,
    _cognitoSession: cognitoSession,
  };
}

export function signInWithPassword(email, password) {
  return new Promise((resolve, reject) => {
    const cognitoUser = new CognitoUser({ Username: email, Pool: userPool });
    const authDetails = new AuthenticationDetails({ Username: email, Password: password });
    cognitoUser.authenticateUser(authDetails, {
      onSuccess: (session) => resolve({ session: sessionToShape(cognitoUser, session) }),
      onFailure: (err) => reject(err),
      newPasswordRequired: () => {
        reject({ code: 'NewPasswordRequired', cognitoUser });
      },
    });
  });
}

export function completeNewPassword(cognitoUser, newPassword) {
  return new Promise((resolve, reject) => {
    cognitoUser.completeNewPasswordChallenge(newPassword, {}, {
      onSuccess: (session) => resolve({ session: sessionToShape(cognitoUser, session) }),
      onFailure: (err) => reject(err),
    });
  });
}

export function getCurrentSession() {
  return new Promise((resolve) => {
    const cognitoUser = userPool.getCurrentUser();
    if (!cognitoUser) return resolve(null);
    cognitoUser.getSession((err, session) => {
      if (err || !session || !session.isValid()) return resolve(null);
      resolve(sessionToShape(cognitoUser, session));
    });
  });
}

export function signOut() {
  const cognitoUser = userPool.getCurrentUser();
  if (cognitoUser) cognitoUser.signOut();
}

const listeners = new Set();

export function onAuthStateChange(callback) {
  listeners.add(callback);
  return { unsubscribe: () => listeners.delete(callback) };
}

export function notifyAuthChange(session) {
  listeners.forEach((cb) => cb(session ? 'SIGNED_IN' : 'SIGNED_OUT', session));
}
