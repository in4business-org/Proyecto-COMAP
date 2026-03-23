import { supabase } from './supabase';

const BASE = import.meta.env.VITE_API_URL || '/api';

async function request(url, options = {}) {
  const { data: { session } } = await supabase.auth.getSession();
  const token = session?.access_token;

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
    throw new Error(data.error || data.detail || `Request failed: ${res.status}`);
  }
  const contentType = res.headers.get('content-type') || '';
  if (contentType.includes('application/json')) return res.json();
  if (contentType.includes('spreadsheetml') || contentType.includes('octet-stream')) return res.blob();
  return res.json();
}

// -- Empresas
export const empresas = {
  list: () => request('/empresas'),
  get: (id) => request(`/empresas/${id}`),
  create: (rut, nombre) =>
    request('/empresas', { method: 'POST', body: JSON.stringify({ rut, nombre }) }),
  update: (id, data) => request(`/empresas/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
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
  upload: (empresaId, proyectoId, periodo, files) => {
    const fd = new FormData();
    files.forEach(f => fd.append('files', f));
    return request(`/empresas/${empresaId}/proyectos/${proyectoId}/${periodo}/upload`, { method: 'POST', body: fd });
  },
  getResults: (empresaId, proyectoId, periodo) =>
    request(`/empresas/${empresaId}/proyectos/${proyectoId}/${periodo}/resultados`),
  analyze: (empresaId, proyectoId, periodo) =>
    request(`/empresas/${empresaId}/proyectos/${proyectoId}/${periodo}/analizar`),
  exportExcel: (empresaId, proyectoId, periodo) =>
    request(`/empresas/${empresaId}/proyectos/${proyectoId}/${periodo}/excel`, { method: 'POST', body: new FormData() }),
  // Simple mode
  simpleUpload: (files) => {
    const fd = new FormData();
    files.forEach(f => fd.append('files', f));
    return request('/simple/upload', { method: 'POST', body: fd });
  },
  updateResults: (empresaId, proyectoId, periodo, results) =>
    request(`/empresas/${empresaId}/proyectos/${proyectoId}/${periodo}`, {
      method: 'PUT',
      body: JSON.stringify({ results }),
    }),
  simpleGetResults: () => request('/simple/resultados'),
  simpleAnalyze: () => request('/simple/analizar'),
  simpleExcel: () => request('/simple/excel'),
  simpleAssociate: (empresaId, proyectoId, periodo) =>
    request('/simple/asociar', {
      method: 'POST',
      body: JSON.stringify({ empresaId, proyectoId, periodo }),
    }),
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
