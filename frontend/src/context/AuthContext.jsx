import React, { createContext, useState, useEffect, useContext } from 'react';
import { getIdToken, signOut as cognitoSignOut, Hub } from '../lib/cognito';

const AuthContext = createContext({});

export const AuthProvider = ({ children }) => {
  const [session, setSession] = useState(null);
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  const refresh = async () => {
    const { token, payload } = await getIdToken();
    if (token) {
      setSession({ token });
      setUser(payload); // claims del ID token: { sub, email, name, ... }
    } else {
      setSession(null);
      setUser(null);
    }
    setLoading(false);
  };

  useEffect(() => {
    // Estado inicial al cargar la página
    refresh();

    // Escuchar eventos de auth (login / logout / refresh de token)
    const unsubscribe = Hub.listen('auth', ({ payload }) => {
      switch (payload.event) {
        case 'signedIn':
        case 'tokenRefresh':
          refresh();
          break;
        case 'signedOut':
          setSession(null);
          setUser(null);
          setLoading(false);
          break;
        default:
          break;
      }
    });

    return () => unsubscribe();
  }, []);

  const logout = async () => {
    await cognitoSignOut();
    setSession(null);
    setUser(null);
  };

  const value = {
    session,
    user,
    loading,
    logout,
  };

  return (
    <AuthContext.Provider value={value}>
      {!loading && children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  return useContext(AuthContext);
};
