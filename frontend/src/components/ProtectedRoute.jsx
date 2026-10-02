import React from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export const ProtectedRoute = ({ adminOnly = false }) => {
  const { session, loading, isAdmin } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-slate-900"></div>
      </div>
    );
  }

  // Si no hay sessión válida, expulsa al usuario al login interceptando el renderizado
  if (!session) {
    return <Navigate to="/login" replace />;
  }

  // Rutas de administración: un usuario normal que entre por URL vuelve al inicio.
  // Esto es sólo cosmético — el backend rechaza igual con 403.
  if (adminOnly && !isAdmin) {
    return <Navigate to="/" replace />;
  }

  // Si hay sesión, renderiza la ruta hija normalmente
  return <Outlet />;
};
