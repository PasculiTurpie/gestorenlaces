import { esFalla } from './estados.js';

export const OPCIONES_FILAMENTOS = [
  ['ambos', 'Ambos filamentos'],
  ['ida', 'Solo la ida'],
  ['vuelta', 'Solo la vuelta'],
];
export const sentidosDe = (opcion) => (opcion === 'ambos' ? ['ida', 'vuelta'] : [opcion]);
const ETIQUETA = { ida: 'Ida', vuelta: 'Vuelta' };

/**
 * Tipos de alarma ofrecidos al registrar un estado: solo los activos, primero los que corresponden a ese estado
 * (p. ej. al marcar Caído, LOS y CORTE antes que ATEN) y luego el resto por nombre.
 */
export function alarmasParaEstado(alarmas, estado) {
  return alarmas
    .filter((a) => a.activo)
    .sort((x, y) => Number(y.estado_sugerido === estado) - Number(x.estado_sugerido === estado) || x.nombre.localeCompare(y.nombre));
}

const GRAVEDAD = { Caido: 3, Degradado: 2, Mantenimiento: 1 };

/** Catálogo por gravedad (Caído, Degradado, Mantenimiento) y luego por nombre: lo más urgente primero. */
export const ordenarAlarmas = (alarmas) =>
  [...alarmas].sort((a, b) => (GRAVEDAD[b.estado_sugerido] ?? 0) - (GRAVEDAD[a.estado_sugerido] ?? 0) || a.nombre.localeCompare(b.nombre));

/**
 * El tipo es obligatorio al pasar a Caído, Degradado o Mantenimiento (así todos saben de qué se trata), siempre que exista
 * al menos uno que elegir. Al volver a OK no se pide.
 */
export const requiereTipificacion = (estado, opciones) => estado !== 'OK' && opciones.length > 0;

/** Filamentos de un enlace que NO están en OK. */
export const filamentosAlarmados = (enlace) => enlace.filamentos.filter((f) => f.estado !== 'OK');

/** ¿Alarma solo en un filamento? (el enlace está en falla/mantenimiento pero el otro sigue bien) */
export const esAlarmaParcial = (enlace) => filamentosAlarmados(enlace).length === 1;

/**
 * Texto corto de qué filamentos están alarmados y por qué: "Solo ida · LOS", "Ambos · CORTE",
 * "Ida · LOS, Vuelta · ATEN". null si todos están en OK.
 */
export function resumenAlarmas(enlace) {
  const a = filamentosAlarmados(enlace);
  if (!a.length) return null;
  const codigo = (f) => f.alarma?.tipificacion?.codigo ?? null;
  const con = (txt, c) => (c ? `${txt} · ${c}` : txt);
  if (a.length === 1) return con(`Solo ${a[0].sentido === 'ida' ? 'ida' : 'vuelta'}`, codigo(a[0]));
  if (codigo(a[0]) === codigo(a[1]) && a[0].estado === a[1].estado) return con('Ambos', codigo(a[0]));
  return a.map((f) => con(ETIQUETA[f.sentido], codigo(f))).join(', ');
}

/** "Actuar dentro de 15 min" / "dentro de 1 h" / "dentro de 1 h 30 min" */
export function textoTiempoRespuesta(min) {
  if (!min) return null;
  const h = Math.floor(min / 60), m = min % 60;
  return h ? `${h} h${m ? ` ${m} min` : ''}` : `${min} min`;
}

/** Alarmas con tipificación conocida de un enlace, para mostrar su procedimiento: [{ sentido, estado, desde, alarma }] */
export function alarmasConProcedimiento(enlace, catalogo) {
  return filamentosAlarmados(enlace)
    .filter((f) => f.alarma?.tipificacion)
    .map((f) => ({ sentido: f.sentido, estado: f.estado, desde: f.estado_desde, observacion: f.alarma.observacion, alarma: catalogo.find((a) => a._id === f.alarma.tipificacion._id) ?? null, resumen: f.alarma.tipificacion }));
}
