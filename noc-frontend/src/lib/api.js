const BASE = import.meta.env?.VITE_API_URL ?? '';

export class ApiError extends Error {
  constructor(message, status, details, ref) {
    super(message);
    this.status = status;
    this.details = details;
    this.ref = ref; // referencia del error en el log del backend (solo en errores 5xx)
  }
}

/** Mensaje de un error HTTP. Un 5xx sin cuerpo JSON no viene de nuestra API: suele ser el proxy porque el backend no respondió. */
function mensajeHttp(res, json) {
  if (json?.error?.message) return json.error.message;
  if (res.status >= 500) return `El servidor respondió con un error (${res.status}) sin detalle. Revise la consola del backend; si el terminal de Vite muestra «http proxy error», el backend no está respondiendo.`;
  return `Error ${res.status}`;
}

let obtenerToken = () => null;
let alNoAutorizado = () => {};
export const configurarApi = ({ token, noAutorizado }) => {
  if (token) obtenerToken = token;
  if (noAutorizado) alNoAutorizado = noAutorizado;
};

export async function request(path, { method = 'GET', body, auth = true, form } = {}) {
  const headers = {};
  if (body !== undefined) headers['Content-Type'] = 'application/json'; // con FormData el navegador fija el Content-Type (y el boundary)
  const token = obtenerToken();
  if (auth && token) headers.Authorization = `Bearer ${token}`;

  let res;
  try {
    res = await fetch(BASE + path, { method, headers, body: form ?? (body !== undefined ? JSON.stringify(body) : undefined) });
  } catch {
    throw new ApiError('No se pudo conectar con el servidor', 0);
  }

  const json = await res.json().catch(() => null);
  if (!res.ok || json?.ok === false) {
    if (res.status === 401 && auth) alNoAutorizado(); // token vencido o usuario desactivado
    throw new ApiError(mensajeHttp(res, json), res.status, json?.error?.details, json?.error?.ref);
  }
  return json;
}

/** Igual que request() pero devuelve el cuerpo como texto (p. ej. el HTML imprimible del acta). */
export async function requestTexto(path) {
  const token = obtenerToken();
  let res;
  try {
    res = await fetch(BASE + path, { headers: token ? { Authorization: `Bearer ${token}` } : {} });
  } catch {
    throw new ApiError('No se pudo conectar con el servidor', 0);
  }
  if (!res.ok) {
    if (res.status === 401) alNoAutorizado();
    const json = await res.json().catch(() => null);
    throw new ApiError(json?.error?.message ?? `Error ${res.status}`, res.status, json?.error?.details);
  }
  return res.text();
}

/** Descarga binaria autenticada (documentos adjuntos). */
export async function requestBlob(path) {
  const token = obtenerToken();
  let res;
  try {
    res = await fetch(BASE + path, { headers: token ? { Authorization: `Bearer ${token}` } : {} });
  } catch {
    throw new ApiError('No se pudo conectar con el servidor', 0);
  }
  if (!res.ok) {
    if (res.status === 401) alNoAutorizado();
    const json = await res.json().catch(() => null);
    throw new ApiError(mensajeHttp(res, json), res.status, json?.error?.details, json?.error?.ref);
  }
  return res.blob();
}

export const api = {
  login: (email, password) => request('/api/auth/login', { method: 'POST', body: { email, password }, auth: false }),
  me: () => request('/api/auth/me'),
  nodos: () => request('/api/nodes'),
  enlaces: () => request('/api/links?limit=500'),
  enlace: (id) => request(`/api/links/${id}`),
  cambiarEstado: (id, body) => request(`/api/links/${id}/status`, { method: 'PATCH', body }),
  moverNodo: (idNodo, { x, y }) => request(`/api/nodes/${idNodo}/position`, { method: 'PATCH', body: { x, y } }),

  // ---- turnos
  turnoActual: () => request('/api/shifts/current'),
  abrirTurno: (body) => request('/api/shifts/open', { method: 'POST', body }),
  turno: (id) => request(`/api/shifts/${id}`),
  // Traspaso: último turno cerrado (de cualquier operador). `antes` = fecha ISO: el que terminó antes de ese momento
  horariosTurnos: () => request('/api/shifts/schedule'), // horario de los turnos, cuál está en curso y cuál proponer al abrir
  turnoAnterior: (antes) => request(`/api/shifts/previous${antes ? `?antes=${encodeURIComponent(antes)}` : ''}`),
  turnos: (query = '') => request(`/api/shifts${query ? `?${query}` : ''}`),
  actualizarBitacora: (id, bitacora_general) => request(`/api/shifts/${id}`, { method: 'PATCH', body: { bitacora_general } }),
  actualizarChecklist: (id, enlaceId, body) => request(`/api/shifts/${id}/checklist/${enlaceId}`, { method: 'PATCH', body }),
  sincronizarChecklist: (id) => request(`/api/shifts/${id}/checklist/sync`, { method: 'POST' }),
  cerrarTurno: (id, body = {}) => request(`/api/shifts/${id}/close`, { method: 'POST', body }),
  actaImprimible: (id) => requestTexto(`/api/shifts/${id}/print`),

  // ---- indicadores
  metricas: (query) => request(`/api/links/metrics?${query}`),
  incidencias: (query) => request(`/api/incidents?${query}`),
  actualizarIncidencia: (id, body) => request(`/api/incidents/${id}`, { method: 'PATCH', body }),

  diagnostico: () => request('/api/sistema/diagnostico'),

  // ---- administración
  tipos: () => request('/api/link-types'),
  crearTipo: (body) => request('/api/link-types', { method: 'POST', body }),
  actualizarTipo: (id, body) => request(`/api/link-types/${id}`, { method: 'PUT', body }),
  eliminarTipo: (id) => request(`/api/link-types/${id}`, { method: 'DELETE' }),

  alarmas: () => request('/api/alarm-types'),
  crearAlarma: (body) => request('/api/alarm-types', { method: 'POST', body }),
  actualizarAlarma: (id, body) => request(`/api/alarm-types/${id}`, { method: 'PUT', body }),
  eliminarAlarma: (id) => request(`/api/alarm-types/${id}`, { method: 'DELETE' }),

  subirAdjunto: (alarmaId, archivo, descripcion = '') => {
    const form = new FormData();
    form.append('archivo', archivo);
    if (descripcion) form.append('descripcion', descripcion);
    return request(`/api/alarm-types/${alarmaId}/adjuntos`, { method: 'POST', form });
  },
  eliminarAdjunto: (id) => request(`/api/adjuntos/${id}`, { method: 'DELETE' }),
  descargarAdjunto: (id, { enLinea = false } = {}) => requestBlob(`/api/adjuntos/${id}/archivo${enLinea ? '?disposicion=inline' : ''}`),

  zonales: () => request('/api/zonales'),
  crearZonal: (body) => request('/api/zonales', { method: 'POST', body }),
  actualizarZonal: (id, body) => request(`/api/zonales/${id}`, { method: 'PUT', body }),
  eliminarZonal: (id) => request(`/api/zonales/${id}`, { method: 'DELETE' }),
  guardarTramos: (id, body) => request(`/api/links/${id}/tramos`, { method: 'PUT', body }),

  usuarios: () => request('/api/users'),
  crearUsuario: (body) => request('/api/users', { method: 'POST', body }),
  actualizarUsuario: (id, body) => request(`/api/users/${id}`, { method: 'PATCH', body }),
  restablecerPassword: (id, password) => request(`/api/users/${id}/password`, { method: 'PATCH', body: { password } }),

  crearNodo: (body) => request('/api/nodes', { method: 'POST', body }),
  actualizarNodo: (idNodo, body) => request(`/api/nodes/${idNodo}`, { method: 'PUT', body }),
  eliminarNodo: (idNodo) => request(`/api/nodes/${idNodo}`, { method: 'DELETE' }),

  crearEnlace: (body) => request('/api/links', { method: 'POST', body }),
  actualizarEnlace: (id, body) => request(`/api/links/${id}`, { method: 'PUT', body }),
  guardarLevantamiento: (id, sentido, body) => request(`/api/links/${id}/filamentos/${sentido}`, { method: 'PUT', body }),
};
