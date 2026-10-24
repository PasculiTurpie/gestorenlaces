import { ESTADO_META } from './estados.js';

const nivelPorEstado = { Caido: 'critico', Degradado: 'warn', Mantenimiento: 'info', OK: 'ok' };
const quien = (por, miId) => (!por ? 'sistema' : por.id === miId ? 'tú' : por.nombre);

/**
 * Traduce un evento Socket.io a { texto, nivel, notificar }.
 * `notificar` = mostrar toast: solo cambios hechos por OTROS usuarios (los propios ya se confirman en la UI).
 */
export function describirEvento(tipo, p, miId) {
  switch (tipo) {
    case 'link:updated': {
      const id = p.link?.id_enlace ?? '?';
      if (p.cambio?.de && p.cambio?.a) {
        const label = (e) => ESTADO_META[e]?.label ?? e;
        const c = p.cambio;
        const parcial = Array.isArray(c.filamentos) && c.filamentos.length === 1;
        const codigo = c.tipificacion ? ` [${c.tipificacion}]` : '';
        // Si cambió un solo filamento (o el estado del enlace no varió) se explica qué filamento fue
        const detalle = parcial || c.de === c.a
          ? `${id}: ${c.filamentos?.length === 2 ? 'ida y vuelta' : (c.filamentos?.[0] ?? 'filamento')} ${label(c.fibraDe ?? c.de)} → ${label(c.fibraA ?? c.a)}${codigo}`
          : `${id}: ${label(c.de)} → ${label(c.a)}${codigo}`;
        return {
          texto: `${detalle} (${quien(p.por, miId)})${parcial && c.de !== c.a ? ` · enlace ${label(c.a)}` : ''}`,
          nivel: nivelPorEstado[c.fibraA ?? c.a] ?? 'info',
          notificar: p.por?.id !== miId,
        };
      }
      const campos = p.cambio?.campos?.join(', ');
      return { texto: `${id} actualizado${campos ? ` (${campos})` : ''} · ${quien(p.por, miId)}`, nivel: 'info', notificar: false };
    }
    case 'link:created':
      return { texto: `Nuevo enlace ${p.link?.id_enlace} · ${quien(p.por, miId)}`, nivel: 'info', notificar: p.por?.id !== miId };
    case 'link:deleted':
      return { texto: `Enlace ${p.id_enlace} eliminado · ${quien(p.por, miId)}`, nivel: 'warn', notificar: p.por?.id !== miId };
    case 'node:created':
      return { texto: `Nuevo nodo ${p.node?.id_nodo} · ${quien(p.por, miId)}`, nivel: 'info', notificar: false };
    case 'node:deleted':
      return { texto: `Nodo ${p.id_nodo} eliminado · ${quien(p.por, miId)}`, nivel: 'warn', notificar: false };
    case 'maintenance:changed': {
      const verbo = { programado: 'programó', editado: 'editó', iniciado: 'inició', finalizado: 'finalizó', cancelado: 'canceló' }[p.accion] ?? 'actualizó';
      const enlaces = `${p.enlaces} enlace${p.enlaces === 1 ? '' : 's'}`;
      return { texto: `${quien(p.por, miId)} ${verbo} el mantenimiento «${p.titulo}» (${enlaces})`, nivel: p.accion === 'iniciado' ? 'warn' : 'info', notificar: p.por?.id !== miId };
    }
    case 'item:changed': {
      const frase = { creado: 'ingresó el', editado: 'editó el', seguimiento: 'agregó seguimiento al', resuelto: 'resolvió el', reabierto: 'reabrió el' }[p.accion] ?? 'actualizó el';
      return { texto: `${quien(p.por, miId)} ${frase} ítem «${p.titulo}» (ticket ${p.ticket})`, nivel: p.accion === 'creado' || p.accion === 'reabierto' ? 'warn' : 'info', notificar: p.por?.id !== miId };
    }
    case 'services:changed': {
      const base = { creado: 'creó un servicio', editado: 'editó un servicio', eliminado: 'eliminó un servicio', importado: `importó servicios (${p.creados ?? 0} nuevos, ${p.actualizados ?? 0} actualizados)`, 'enlace-eliminado': 'actualizó los servicios por un enlace eliminado' }[p.accion] ?? 'actualizó los servicios';
      return { texto: `${quien(p.por, miId)} ${base}`, nivel: 'info', notificar: false };
    }
    case 'shift:opened':
      return { texto: `${p.operador?.nombre ?? 'Un operador'} abrió el turno ${p.tipo_turno?.toLowerCase() ?? ''} (${p.pendientes} enlace(s) por revisar)`, nivel: 'info', notificar: false };
    case 'shift:closed':
      return { texto: `Turno cerrado por ${p.operador?.nombre ?? 'un operador'}`, nivel: 'ok', notificar: false };
    default:
      return null; // node:moved, node:updated... no generan ruido en la actividad
  }
}
