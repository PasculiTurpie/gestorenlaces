import { env } from '../config/env.js';
import { Link } from '../models/Link.js';
import { AppError } from '../utils/errors.js';
import { SENTIDOS, esFalla, etiquetaFilamentos, materializarFilamentos, peorEstado } from '../utils/filamentos.js';
import { sincronizarIncidencia } from './incidence.service.js';

export const POPULATE_NODOS = [
  { path: 'origen_nodo', select: 'id_nodo nombre tipo posicion' },
  { path: 'destino_nodo', select: 'id_nodo nombre tipo posicion' },
  { path: 'tipo_enlace', select: 'clave nombre color propio' },
  { path: 'tramos.zonal', select: 'clave nombre color' },
  { path: 'filamentos.alarma.tipificacion', select: 'codigo nombre estado_sugerido' },
];

export const pushTimeline = (entry) => ({
  $push: { timeline: { $each: [entry], $slice: -env.timelineMax } },
});

/**
 * Cambia el estado de uno o ambos filamentos de un enlace, de forma atómica y auditable:
 *  1) cada filamento seleccionado pasa al nuevo estado (y registra su alarma: la tipificación);
 *  2) el estado del ENLACE se recalcula como el peor de sus dos filamentos;
 *  3) update condicionado a que nadie haya modificado el enlace entretanto (409 si cambió);
 *  4) entrada en el timeline e incidencia (apertura/cierre/actualización) coherentes con el estado resultante.
 * Sin `filamentos` se aplica a ambos, que es el comportamiento anterior.
 */
export async function cambiarEstado({ link, nuevoEstado, filamentos = SENTIDOS, tipificacion = null, usuario, observacion = '', ticket, causa_raiz = '' }) {
  const previo = link.estado;
  const ahora = new Date();
  const fibras = materializarFilamentos(link);
  const cambian = fibras.filter((f) => filamentos.includes(f.sentido) && f.estado !== nuevoEstado);

  if (!cambian.length) {
    throw new AppError(409, `El ${etiquetaFilamentos(filamentos)} ya está en estado "${nuevoEstado}"`);
  }

  const sentidosQueCambian = cambian.map((f) => f.sentido);
  const estadosPrevios = [...new Set(cambian.map((f) => f.estado))].join('/');
  const nuevas = fibras.map((f) => {
    if (!sentidosQueCambian.includes(f.sentido)) return f; // el otro filamento conserva su estado y su alarma
    const { alarma: _anterior, ...resto } = f;
    return {
      ...resto,
      estado: nuevoEstado,
      estado_desde: ahora,
      // al volver a OK la alarma termina; en cualquier otro estado queda registrada su tipificación
      ...(nuevoEstado !== 'OK' && { alarma: { tipificacion: tipificacion?._id ?? null, observacion } }),
    };
  });

  const estadoEnlace = peorEstado(nuevas.map((f) => f.estado));
  const cambiaEnlace = estadoEnlace !== previo;
  const ticketEfectivo = ticket ?? link.ticket_actual ?? '';

  const set = { filamentos: nuevas, estado: estadoEnlace };
  if (cambiaEnlace) set.estado_desde = ahora;
  if (estadoEnlace === 'OK') set.ticket_actual = ''; // el ticket queda registrado en timeline e incidencia
  else if (ticket !== undefined) set.ticket_actual = ticket;

  const codigo = tipificacion ? ` [${tipificacion.codigo}]` : '';
  const accion = sentidosQueCambian.length === 2 && cambiaEnlace
    ? `Cambio de estado: ${previo} → ${estadoEnlace}${codigo}`
    : `${etiquetaFilamentos(sentidosQueCambian)[0].toUpperCase()}${etiquetaFilamentos(sentidosQueCambian).slice(1)}: ${estadosPrevios} → ${nuevoEstado}${codigo}`;

  const entry = { fecha: ahora, operador: usuario._id, accion: accion.slice(0, 200), observacion, ticket: ticketEfectivo };

  const actualizado = await Link.findOneAndUpdate(
    { _id: link._id, updatedAt: link.updatedAt }, // bloqueo optimista: nadie lo tocó desde que se leyó
    { $set: set, ...pushTimeline(entry) },
    { new: true, runValidators: true },
  ).populate(POPULATE_NODOS);

  if (!actualizado) {
    throw new AppError(409, 'El enlace cambió mientras lo editabas. Recarga e inténtalo de nuevo.');
  }

  await sincronizarIncidencia({
    enlaceId: actualizado._id,
    nuevoEstado: estadoEnlace,
    ahora,
    ticket: ticketEfectivo,
    causa_raiz,
    tipificacion: tipificacion?._id ?? null,
    // los filamentos que sostienen el estado actual del enlace (solo tiene sentido en fallas)
    filamentosAfectados: esFalla(estadoEnlace) ? nuevas.filter((f) => f.estado === estadoEnlace).map((f) => f.sentido) : [],
  });

  return { link: actualizado, de: previo, a: estadoEnlace, filamentos: sentidosQueCambian, fibraDe: estadosPrevios, fibraA: nuevoEstado };
}
