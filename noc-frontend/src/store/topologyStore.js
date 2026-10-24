import { create } from 'zustand';
import { api } from '../lib/api.js';
import { normalizarFilamentos } from '../lib/levantamiento.js';

// ---------------------------------------------------------------- normalización
export const normalizarNodo = (n) => ({
  _id: n._id,
  id_nodo: n.id_nodo,
  nombre: n.nombre ?? n.id_nodo,
  tipo: n.tipo,
  posicion: { x: n.posicion?.x ?? 0, y: n.posicion?.y ?? 0 },
});

const normalizarTramos = (raw) =>
  (raw ?? [])
    .filter((t) => t.zonal)
    .map((t) => ({
      zonal: typeof t.zonal === 'object'
        ? { _id: t.zonal._id, clave: t.zonal.clave, nombre: t.zonal.nombre, color: t.zonal.color }
        : { _id: t.zonal, clave: null, nombre: 'Zonal', color: '#8296ab' },
      km_desde: t.km_desde,
      km_hasta: t.km_hasta,
    }))
    .sort((a, b) => a.km_desde - b.km_desde);

// Los enlaces llegan con origen/destino poblados ({ id_nodo, ... }); en el store se guardan como id_nodo.
export const normalizarEnlace = (l) => ({
  _id: l._id ?? l.id,
  id_enlace: l.id_enlace,
  estado: l.estado,
  estado_desde: l.estado_desde,
  proveedor: l.proveedor ?? '',
  ticket_actual: l.ticket_actual ?? '',
  origen: l.origen_nodo?.id_nodo ?? null,
  destino: l.destino_nodo?.id_nodo ?? null,
  // tipo de línea (propia o de otra telco); null = sin clasificar
  tipo: l.tipo_enlace && typeof l.tipo_enlace === 'object'
    ? { _id: l.tipo_enlace._id, clave: l.tipo_enlace.clave, nombre: l.tipo_enlace.nombre, color: l.tipo_enlace.color, propio: Boolean(l.tipo_enlace.propio) }
    : null,
  filamentos: normalizarFilamentos(l.filamentos, { estado: l.estado, estado_desde: l.estado_desde }),
  // largo total (km) y reparto por zonal; los km se miden desde el nodo origen
  longitud_km: typeof l.longitud_km === 'number' ? l.longitud_km : null,
  tramos: normalizarTramos(l.tramos),
  updatedAt: l.updatedAt ?? null,
});

const indexar = (lista, clave) => Object.fromEntries(lista.map((x) => [x[clave], x]));

const estadoInicial = () => ({
  nodos: {},
  enlaces: {},
  tipos: [], // catálogo de tipos de línea
  zonales: [], // catálogo de zonales (reparto por km de cada enlace)
  alarmas: [], // catálogo de tipificación de alarmas (significado y procedimiento)
  items: [], // ítems de atención ABIERTOS (compartidos por todos los operadores)
  serviciosPorEnlace: {}, // { enlaceId: n } cuántos servicios pasan por cada enlace (el detalle se pide al abrir el enlace)
  mantenimientos: [], // activos: Programado y En curso (la lista completa, con historial, se pide en su pantalla)
  expandidos: {}, // { enlaceId: true } enlaces con los dos filamentos desplegados
  cargando: true,
  error: null,
  conectado: false,
  seleccion: { enlaceId: null, nodoId: null },
  filtros: { ocultarOK: false, tipo: null }, // tipo = clave del tipo de línea a mostrar (null = todos)
  eventos: [],
  toasts: [],
  sidebarAbierto: typeof window === 'undefined' ? true : window.innerWidth >= 1024,
});

let secuencia = 0;

export const useTopology = create((set, get) => ({
  ...estadoInicial(),

  reset: () => set(estadoInicial()),

  // ------------------------------------------------------------ carga inicial / resincronización
  async cargar({ silencioso = false } = {}) {
    if (!silencioso) set({ cargando: true, error: null });
    try {
      // los mantenimientos son informativos: si fallan, la consola sigue funcionando (se reintenta con el próximo evento)
      const [n, e, t, z, a, m, sv, it] = await Promise.all([api.nodos(), api.enlaces(), api.tipos(), api.zonales(), api.alarmas(), api.mantenimientos().catch(() => null), api.serviciosResumen().catch(() => null), api.items().catch(() => null)]);
      set({
        nodos: indexar(n.data.map(normalizarNodo), 'id_nodo'),
        enlaces: indexar(e.data.map(normalizarEnlace), '_id'),
        tipos: t.data,
        zonales: z.data,
        alarmas: a.data,
        ...(m && { mantenimientos: m.data }),
        ...(sv && { serviciosPorEnlace: sv.data.por_enlace }),
        ...(it && { items: it.data }),
        cargando: false,
        error: null,
      });
    } catch (err) {
      if (silencioso) get().pushToast({ nivel: 'warn', texto: `No se pudo resincronizar: ${err.message}` });
      else set({ cargando: false, error: err.message });
    }
  },

  async cargarItems() {
    try { set({ items: (await api.items()).data }); } catch { /* informativo: se reintenta con el próximo evento */ }
  },

  async cargarServicios() {
    try { set({ serviciosPorEnlace: (await api.serviciosResumen()).data.por_enlace }); } catch { /* informativo */ }
  },

  async cargarMantenimientos() {
    try { set({ mantenimientos: (await api.mantenimientos()).data }); } catch { /* informativo: se reintenta con el próximo evento */ }
  },

  // ------------------------------------------------------------ enlaces
  aplicarEnlace(raw) {
    const nuevo = normalizarEnlace(raw);
    if (!nuevo._id) return;
    const previo = get().enlaces[nuevo._id];
    // descarta eventos atrasados (p. ej. el eco de socket de un cambio anterior)
    if (previo?.updatedAt && nuevo.updatedAt && new Date(nuevo.updatedAt) < new Date(previo.updatedAt)) return;
    // si el payload no trae nodos poblados, conserva los que ya teníamos
    const fusion = { ...previo, ...nuevo, origen: nuevo.origen ?? previo?.origen ?? null, destino: nuevo.destino ?? previo?.destino ?? null };
    set((s) => ({ enlaces: { ...s.enlaces, [nuevo._id]: fusion } }));
  },

  quitarEnlace(id) {
    set((s) => {
      const { [id]: _quitado, ...resto } = s.enlaces;
      return { enlaces: resto, seleccion: s.seleccion.enlaceId === id ? { ...s.seleccion, enlaceId: null } : s.seleccion };
    });
  },

  // Cambio de estado hecho por este usuario: la respuesta del PATCH es la verdad (el eco de socket llega igual y es idempotente)
  async cambiarEstado(enlaceId, payload) {
    const { data } = await api.cambiarEstado(enlaceId, payload);
    get().aplicarEnlace(data);
    return data;
  },

  // ------------------------------------------------------------ nodos
  aplicarNodo(raw) {
    const n = normalizarNodo(raw);
    set((s) => ({ nodos: { ...s.nodos, [n.id_nodo]: n } }));
  },

  quitarNodo(idNodo) {
    set((s) => {
      const { [idNodo]: _quitado, ...resto } = s.nodos;
      return { nodos: resto };
    });
  },

  moverNodoLocal(idNodo, posicion) {
    const nodo = get().nodos[idNodo];
    if (!nodo || !posicion) return;
    set((s) => ({ nodos: { ...s.nodos, [idNodo]: { ...nodo, posicion: { x: posicion.x, y: posicion.y } } } }));
  },

  // Actualización optimista: se mueve ya y, si el servidor rechaza, se revierte
  async moverNodo(idNodo, posicion) {
    const anterior = get().nodos[idNodo]?.posicion;
    get().moverNodoLocal(idNodo, posicion);
    try {
      await api.moverNodo(idNodo, posicion);
    } catch (err) {
      if (anterior) get().moverNodoLocal(idNodo, anterior);
      get().pushToast({ nivel: 'critico', texto: `No se guardó la posición de ${idNodo}: ${err.message}` });
    }
  },

  // ------------------------------------------------------------ tipos de línea
  async recargarTipos() {
    const { data } = await api.tipos();
    set({ tipos: data });
  },

  // ------------------------------------------------------------ UI
  toggleExpandido: (id) =>
    set((s) => {
      const { [id]: abierto, ...resto } = s.expandidos;
      return { expandidos: abierto ? resto : { ...resto, [id]: true } };
    }),
  seleccionarEnlace: (id) => set((s) => ({ seleccion: { ...s.seleccion, enlaceId: id } })),
  seleccionarNodo: (id) => set((s) => ({ seleccion: { ...s.seleccion, nodoId: id } })),
  setFiltro: (clave, valor) => set((s) => ({ filtros: { ...s.filtros, [clave]: valor } })),
  setConectado: (conectado) => set({ conectado }),
  toggleSidebar: () => set((s) => ({ sidebarAbierto: !s.sidebarAbierto })),

  pushEvento(evento) {
    set((s) => ({ eventos: [{ id: ++secuencia, ts: new Date().toISOString(), ...evento }, ...s.eventos].slice(0, 30) }));
  },

  pushToast({ nivel = 'info', texto, ms }) {
    const id = ++secuencia;
    set((s) => ({ toasts: [...s.toasts, { id, nivel, texto }].slice(-5) }));
    const timer = setTimeout(() => get().quitarToast(id), ms ?? (nivel === 'critico' ? 12_000 : 6_000));
    timer?.unref?.(); // en tests de Node no mantiene vivo el proceso
    return id;
  },
  quitarToast: (id) => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),
}));
