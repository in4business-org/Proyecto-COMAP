import React, { createContext, useState, useEffect, useContext, useCallback } from 'react';
import { getIdToken, signOut as cognitoSignOut, Hub } from '../lib/cognito';
import { me as meApi } from '../lib/api';

const AuthContext = createContext({});

export const AuthProvider = ({ children }) => {
  const [session, setSession] = useState(null);
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  // Permisos por empresa que devuelve /api/me: [{ empresaId, escritura: [] }]
  const [accesos, setAccesos] = useState([]);

  const refresh = async () => {
    const { token, payload } = await getIdToken();
    if (token) {
      setSession({ token });
      setUser(payload); // claims del ID token: { sub, email, name, ... }
      // Los permisos por empresa viven en Postgres, no en el token.
      // Si falla, dejamos la lista vacía: el backend decide igual.
      try {
        const info = await meApi.load();
        setAccesos(info?.accesos || []);
      } catch {
        setAccesos([]);
      }
    } else {
      setSession(null);
      setUser(null);
      setAccesos([]);
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
          setAccesos([]);
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
    setAccesos([]);
  };

  // El rol sale del claim `cognito:groups` del ID token. Es sólo para decidir
  // qué mostrar en la UI: el control real lo hace el backend (requireAdmin).
  // Un cambio de rol se ve recién cuando el token se renueva o el usuario
  // vuelve a iniciar sesión.
  const groups = user?.['cognito:groups'] || [];
  // admins = administrador general (master); admins_empresa = administrador
  // dentro de las empresas que le asignaron. master gana sobre el otro.
  const isMaster = groups.includes('admins');
  const isAdminEmpresa = !isMaster && groups.includes('admins_empresa');
  // Quien puede entrar al panel de administracion
  const isAdmin = isMaster || isAdminEmpresa;

  /**
   * ¿Puede escribir `modulo` en `empresaId`?
   * Igual que arriba, esto sólo sirve para ocultar botones: cada endpoint
   * revalida en el backend.
   */
  const puedeEscribir = useCallback(
    (empresaId, modulo) => {
      if (isMaster) return true;
      const acceso = accesos.find((a) => a.empresaId === empresaId);
      if (!acceso) return false;
      // Un admin de empresa tiene control total sobre las empresas que
      // administra: el detalle por módulo no aplica para él.
      if (isAdminEmpresa) return true;
      return (acceso.escritura || []).includes(modulo);
    },
    [isMaster, isAdminEmpresa, accesos]
  );

  const value = {
    session,
    user,
    loading,
    logout,
    groups,
    isAdmin,
    isMaster,
    isAdminEmpresa,
    role: isMaster ? 'master' : isAdminEmpresa ? 'admin_empresa' : 'user',
    accesos,
    puedeEscribir,
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
