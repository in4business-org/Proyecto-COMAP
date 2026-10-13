import { getIdToken, Hub } from './cognito';

const BASE = import.meta.env.VITE_API_URL || '/api';

// ── Cached auth token ─────────────────────────────────────
let _cachedToken = null;
let _tokenExpiresAt = 0;

async function getToken() {
  const now = Date.now();
  // Reuse token if it expires in more than 60 seconds
  if (_cachedToken && _tokenExpiresAt - now > 60_000) return _cachedToken;
  // Amplify refresca el token automáticamente si está por expirar
  const { token, expiresAt } = await getIdToken();
  _cachedToken = token;
  _tokenExpiresAt = expiresAt;
  return _cachedToken;
}

// Invalidate cache on auth state changes (login/logout/refresh)
Hub.listen('auth', ({ payload }) => {
  if (['signedIn', 'signedOut', 'tokenRefresh'].includes(payload.event)) {
    _cachedToken = null;
    _tokenExpiresAt = 0;
  }
});

async function request(url, options = {}) {
  const token = await getToken();

  const headers = {
    ...(options.body && !(options.body instanceof FormData) ? { 'Content-Type': 'application/json' } : {}),
    ...options.headers,
  };

  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  const res = await fetch(`${BASE}${url}`, {
    ...options,
    headers,
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    // status y data quedan en el error para que la pantalla pueda reaccionar
    // (p. ej. un 409 trae el id de lo que ya existía)
    const err = new Error(data.error || data.detail || `Request failed: ${res.status}`);
    err.status = res.status;
    err.data = data;
    throw err;
  }
  const contentType = res.headers.get('content-type') || '';
  if (contentType.includes('application/json')) return res.json();
  if (contentType.includes('spreadsheetml') || contentType.includes('octet-stream')) return res.blob();
  return res.json();
}

// -- Dashboard (empresas + proyectos in one call)
export const dashboard = {
  load: () => request('/dashboard'),
};

// -- Identidad y permisos del usuario actual
export const me = {
  load: () => request('/me'),
};

// -- Administración de usuarios (sólo rol admin; el backend valida con 403)
export const admin = {
  listUsuarios: () => request('/admin/usuarios'),
  listModulos: () => request('/admin/modulos'),
  getAccesos: (username) =>
    request(`/admin/usuarios/${encodeURIComponent(username)}/accesos`),
  setAccesos: (username, accesos) =>
    request(`/admin/usuarios/${encodeURIComponent(username)}/accesos`, {
      method: 'PUT',
      body: JSON.stringify({ accesos }),
    }),
  crearUsuario: ({ email, nombre, rol, enviarMail, accesos }) =>
    request('/admin/usuarios', {
      method: 'POST',
      body: JSON.stringify({ email, nombre, rol, enviarMail, accesos }),
    }),
  cambiarRol: (username, rol) =>
    request(`/admin/usuarios/${encodeURIComponent(username)}/rol`, {
      method: 'PATCH',
      body: JSON.stringify({ rol }),
    }),
  cambiarEstado: (username, habilitado) =>
    request(`/admin/usuarios/${encodeURIComponent(username)}/estado`, {
      method: 'PATCH',
      body: JSON.stringify({ habilitado }),
    }),
  resetPassword: (username) =>
    request(`/admin/usuarios/${encodeURIComponent(username)}/reset-password`, {
      method: 'POST',
    }),
  eliminarUsuario: (username) =>
    request(`/admin/usuarios/${encodeURIComponent(username)}`, { method: 'DELETE' }),
};

// -- Empresas
export const empresas = {
  list: () => request('/empresas'),
  get: (id) => request(`/empresas/${id}`),
  // `datos`: el resto de los campos de la empresa (razón social, domicilios...)
  create: (rut, nombre, datos = {}) =>
    request('/empresas', { method: 'POST', body: JSON.stringify({ ...datos, rut, nombre }) }),
  update: (id, data) => request(`/empresas/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  // Sólo administrador general
  resumenBorrado: (id) => request(`/empresas/${id}/borrado`),
  eliminar: (id) => request(`/empresas/${id}`, { method: 'DELETE' }),
};

// -- Proyectos
export const proyectos = {
  list: (empresaId) => request(`/empresas/${empresaId}/proyectos`),
  create: (empresaId, anioPresentacion, duracionSeguimiento, fechaPresentacion) =>
    request(`/empresas/${empresaId}/proyectos`, {
      method: 'POST',
      body: JSON.stringify({
        anio_presentacion: anioPresentacion,
        duracion_seguimiento: duracionSeguimiento,
        fecha_presentacion: fechaPresentacion || null,
      }),
    }),
  updateExpediente: (empresaId, proyectoId, expediente) =>
    request(`/empresas/${empresaId}/proyectos/${proyectoId}/expediente`, {
      method: 'PATCH',
      body: JSON.stringify({ expediente }),
    }),
  updateMetadata: (empresaId, proyectoId, data) =>
    request(`/empresas/${empresaId}/proyectos/${proyectoId}/metadata`, { method: 'PATCH', body: JSON.stringify(data) }),
};

// -- Facturas
export const facturas = {
  getAllResults: (empresaId, proyectoId) =>
    request(`/empresas/${empresaId}/proyectos/${proyectoId}/all-resultados`),
  uploadAndProcess: (empresaId, proyectoId, periodo, files) => {
    const fd = new FormData();
    files.forEach(f => fd.append('files', f));
    return request(`/empresas/${empresaId}/proyectos/${proyectoId}/${periodo}/subir-y-procesar`, { method: 'POST', body: fd });
  },
  exportExcel: (empresaId, proyectoId, periodo) =>
    request(`/empresas/${empresaId}/proyectos/${proyectoId}/${periodo}/excel`, { method: 'POST', body: new FormData() }),
  reprocesar: (empresaId, proyectoId, periodo, archivos) =>
    request(`/empresas/${empresaId}/proyectos/${proyectoId}/${periodo}/reprocesar`, {
      method: 'POST',
      body: JSON.stringify({ archivos }),
    }),
  updateResults: (empresaId, proyectoId, periodo, results) =>
    request(`/empresas/${empresaId}/proyectos/${proyectoId}/${periodo}`, {
      method: 'PUT',
      body: JSON.stringify({ results }),
    }),
  downloadTemplate: (empresaId, proyectoId, periodo) =>
    request(`/empresas/${empresaId}/proyectos/${proyectoId}/${periodo}/template-importar`),
  importar: (empresaId, proyectoId, periodo, file) => {
    const fd = new FormData();
    fd.append('file', file);
    return request(`/empresas/${empresaId}/proyectos/${proyectoId}/${periodo}/importar`, { method: 'POST', body: fd });
  },
};

// -- Checklist
export const checklist = {
  get: (empresaId, proyectoId) =>
    request(`/empresas/${empresaId}/proyectos/${proyectoId}/checklist`),
  updateItem: (empresaId, proyectoId, itemId, estado, notaUsuario = '') =>
    request(`/empresas/${empresaId}/proyectos/${proyectoId}/checklist/${itemId}`, {
      method: 'PATCH',
      body: JSON.stringify({ estado, nota_usuario: notaUsuario }),
    }),
  uploadFile: (empresaId, proyectoId, itemId, file) => {
    const fd = new FormData();
    fd.append('file', file);
    return request(`/empresas/${empresaId}/proyectos/${proyectoId}/checklist/${itemId}/archivo`, { method: 'POST', body: fd });
  },
  downloadFile: (empresaId, proyectoId, itemId) =>
    request(`/empresas/${empresaId}/proyectos/${proyectoId}/checklist/${itemId}/archivo`),
  // Preguntas de "Antes de empezar" y sus respuestas
  getPerfil: (empresaId, proyectoId) =>
    request(`/empresas/${empresaId}/proyectos/${proyectoId}/checklist/perfil`),
  setPerfil: (empresaId, proyectoId, respuestas) =>
    request(`/empresas/${empresaId}/proyectos/${proyectoId}/checklist/perfil`, {
      method: 'PUT',
      body: JSON.stringify({ respuestas }),
    }),
};

// -- Cotizaciones
export const cotizaciones = {
  getMesAnterior: (fecha) => request(`/cotizaciones/mes-anterior${fecha ? `?fecha=${encodeURIComponent(fecha)}` : ''}`),
};

// -- Simulador
export const simulador = {
  download: (empresaId, proyectoId) =>
    request(`/empresas/${empresaId}/proyectos/${proyectoId}/simulador/descargar`),
  upload: (empresaId, proyectoId, file) => {
    const fd = new FormData();
    fd.append('file', file);
    return request(`/empresas/${empresaId}/proyectos/${proyectoId}/simulador/subir`, { method: 'POST', body: fd });
  },
  results: (empresaId, proyectoId) =>
    request(`/empresas/${empresaId}/proyectos/${proyectoId}/simulador/resultados`),
};
