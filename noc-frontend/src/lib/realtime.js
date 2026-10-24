import { describirEvento } from './eventos.js';
import { conectarSocket, desconectarSocket } from './socket.js';
import { useAuth } from '../store/authStore.js';
import { useTopology } from '../store/topologyStore.js';

/**
 * Conecta Socket.io y enlaza cada evento del backend con el store de topología.
 * Devuelve la función que corta la conexión (para el cleanup del efecto).
 */
export function iniciarTiempoReal(token) {
  const T = () => useTopology.getState();
  const miId = () => useAuth.getState().user?._id;
  let primeraConexion = true;

  const registrar = (tipo, p) => {
    const ev = describirEvento(tipo, p, miId());
    if (!ev) return;
    T().pushEvento({ texto: ev.texto, nivel: ev.nivel });
    if (ev.notificar) T().pushToast({ nivel: ev.nivel, texto: ev.texto });
  };

  const eventos = {
    'link:created': (p) => { T().aplicarEnlace(p.link); registrar('link:created', p); },
    'link:updated': (p) => { T().aplicarEnlace(p.link); registrar('link:updated', p); },
    'link:deleted': (p) => { T().quitarEnlace(p.id); registrar('link:deleted', p); },
    'node:created': (p) => { T().aplicarNodo(p.node); registrar('node:created', p); },
    'node:updated': (p) => T().aplicarNodo(p.node),
    'node:moved': (p) => T().moverNodoLocal(p.id_nodo, p.posicion),
    'node:layout': (p) => p.nodos.forEach((n) => T().moverNodoLocal(n.id_nodo, n.posicion)),
    'linktype:changed': () => T().cargar({ silencioso: true }), // cambian nombres/colores que viajan dentro de cada enlace
    'zonal:changed': () => T().cargar({ silencioso: true }),
    'alarmtype:changed': () => T().cargar({ silencioso: true }), // cambia el significado/procedimiento que viaja con cada alarma
    'maintenance:changed': (p) => { T().cargarMantenimientos(); registrar('maintenance:changed', p); }, // todos se enteran en el momento
    'item:changed': (p) => { T().cargarItems(); registrar('item:changed', p); }, // un ítem de atención nuevo o resuelto lo ven todos al instante
    'services:changed': (p) => { T().cargarServicios(); registrar('services:changed', p); }, // cambian los servicios de los enlaces
    'shift:opened': (p) => registrar('shift:opened', p),
    'shift:closed': (p) => registrar('shift:closed', p),
    'node:deleted': (p) => { T().quitarNodo(p.id_nodo); registrar('node:deleted', p); },
  };

  conectarSocket(token, {
    alConectar: () => {
      T().setConectado(true);
      // tras una reconexión pudimos perder eventos: se vuelve a leer el estado completo
      if (!primeraConexion) T().cargar({ silencioso: true });
      primeraConexion = false;
    },
    alDesconectar: () => T().setConectado(false),
    alRechazar: () => useAuth.getState().logout(),
    eventos,
  });

  return () => {
    desconectarSocket();
    T().setConectado(false);
  };
}
