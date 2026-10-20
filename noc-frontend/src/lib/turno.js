import { ESTADO_META, esFalla } from './estados.js';

/** Acta del backend -> forma que usa la interfaz. Cada ítem conserva el enlace (puede haberse eliminado después). */
export function normalizarActa(raw) {
  return {
    _id: raw._id,
    operador: raw.operador,
    tipo_turno: raw.tipo_turno,
    fecha_turno: raw.fecha_turno ?? null, // día al que pertenece el turno (el turno noche que empieza el 19 a las 23:00 es del 20)
    fecha_inicio: raw.fecha_inicio,
    fecha_fin: raw.fecha_fin ?? null,
    cerrado: Boolean(raw.cerrado),
    bitacora_general: raw.bitacora_general ?? '',
    items: (raw.checklist_enlaces ?? []).map((i) => ({
      enlaceId: i.enlace?._id ?? null,
      id_enlace: i.enlace?.id_enlace ?? '(enlace eliminado)',
      origen: i.enlace?.origen_nodo?.id_nodo ?? '?',
      destino: i.enlace?.destino_nodo?.id_nodo ?? '?',
      eliminado: !i.enlace,
      estado_recibido: i.estado_recibido,
      gestionado: Boolean(i.gestionado),
      accion_tomada: i.accion_tomada ?? '',
    })),
    // solo el listado (historial) trae estos totales ya calculados
    checklist_total: raw.checklist_total,
    checklist_pendientes: raw.checklist_pendientes,
  };
}

/** Un ítem está resuelto cuando se marcó como gestionado Y se describió la acción tomada (regla del cierre). */
export const itemResuelto = (item) => item.estado_recibido === 'OK' || (item.gestionado && item.accion_tomada.trim() !== '');

/** Ítems que impiden cerrar el turno, con el motivo. */
export function pendientesDeCierre(acta) {
  return acta.items
    .filter((i) => !itemResuelto(i))
    .map((i) => ({ item: i, motivo: !i.gestionado ? 'Falta marcarlo como gestionado' : 'Falta describir la acción tomada' }));
}

/**
 * Enlaces que están en falla/mantenimiento AHORA y no figuran en el checklist (cayeron después de abrir el turno).
 * `enlaces` es el mapa del store (se actualiza en vivo por Socket.io).
 */
export function enlacesNuevos(acta, enlaces) {
  const enChecklist = new Set(acta.items.map((i) => i.enlaceId).filter(Boolean));
  return Object.values(enlaces)
    .filter((l) => l.estado !== 'OK' && !enChecklist.has(l._id))
    .sort((a, b) => a.id_enlace.localeCompare(b.id_enlace));
}

export function resumenActa(acta) {
  const total = acta.items.length;
  const resueltos = acta.items.filter(itemResuelto).length;
  const gestionados = acta.items.filter((i) => i.gestionado).length;
  return { total, resueltos, gestionados, pendientes: total - resueltos };
}

/** Los 400 de cierre traen campos como "checklist_enlaces.2.gestionado": se traducen al enlace correspondiente. */
export function describirErroresCierre(err, acta) {
  const detalles = Array.isArray(err?.details) ? err.details : [];
  const lineas = detalles.map((d) => {
    const m = /^checklist_enlaces\.(\d+)\./.exec(d.campo ?? '');
    const item = m ? acta.items[Number(m[1])] : null;
    return item ? `${item.id_enlace}: ${d.mensaje}` : d.mensaje;
  });
  return lineas.length ? lineas : [err?.message ?? 'No se pudo cerrar el turno'];
}

/** Minutos -> "3 h 05 min" / "42 min" / "2 d 4 h" */
export function fmtDuracion(minutos) {
  if (minutos == null || Number.isNaN(minutos)) return '—';
  const total = Math.round(minutos);
  if (total < 60) return `${total} min`;
  const h = Math.floor(total / 60);
  if (h < 24) return `${h} h ${String(total % 60).padStart(2, '0')} min`;
  return `${Math.floor(h / 24)} d ${h % 24} h`;
}

export const duracionTurnoMin = (acta, ahora = Date.now()) =>
  ((acta.fecha_fin ? new Date(acta.fecha_fin).getTime() : ahora) - new Date(acta.fecha_inicio).getTime()) / 60_000;

/** ¿Cuántos enlaces hay hoy en falla (lo que se recibiría si se abriera un turno ahora)? */
export const contarARecibir = (enlaces) => Object.values(enlaces).filter((l) => l.estado !== 'OK').length;
export { esFalla };

// ----------------------------------------------------------------------------- traspaso (turno anterior)

/** Lo que se hizo con cada enlace en el turno anterior: { enlaceId: { accion, estado_recibido } }. Solo ítems con acción registrada. */
export function notasPorEnlace(anterior) {
  const notas = {};
  for (const i of anterior?.items ?? []) {
    if (i.enlaceId && i.accion_tomada.trim()) notas[i.enlaceId] = { accion: i.accion_tomada.trim(), estado_recibido: i.estado_recibido };
  }
  return notas;
}

/**
 * Qué quedó pendiente del turno anterior según el estado ACTUAL (en vivo) de cada enlace:
 *  - seguimiento: siguen sin estar en OK (lo más grave primero);
 *  - recuperados: ya volvieron a OK desde entonces.
 * Los enlaces eliminados se ignoran.
 */
export function resumenTurnoAnterior(anterior, enlaces) {
  const seguimiento = [];
  const recuperados = [];
  for (const i of anterior?.items ?? []) {
    const l = i.enlaceId ? enlaces[i.enlaceId] : null;
    if (!l) continue;
    (l.estado === 'OK' ? recuperados : seguimiento).push({ ...i, estadoActual: l.estado, desdeActual: l.estado_desde });
  }
  const peso = (e) => ESTADO_META[e]?.peso ?? 0;
  seguimiento.sort((a, b) => peso(b.estadoActual) - peso(a.estadoActual) || a.id_enlace.localeCompare(b.id_enlace));
  recuperados.sort((a, b) => a.id_enlace.localeCompare(b.id_enlace));
  return { seguimiento, recuperados, total: anterior?.items?.length ?? 0 };
}

/** Horas transcurridas desde una fecha (para avisar que un traspaso puede estar desactualizado). */
export const horasDesde = (fecha, ahora = Date.now()) => (ahora - new Date(fecha).getTime()) / 3_600_000;
export const TRASPASO_VIGENTE_HORAS = 24;
