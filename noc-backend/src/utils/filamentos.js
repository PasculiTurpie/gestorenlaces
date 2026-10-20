export const SENTIDOS = ['ida', 'vuelta'];
const PESO = { OK: 0, Mantenimiento: 1, Degradado: 2, Caido: 3 };

export const pesoEstado = (estado) => PESO[estado] ?? 0;
export const esFalla = (estado) => estado === 'Caido' || estado === 'Degradado';

/** El estado del enlace es el PEOR de sus filamentos: Caído > Degradado > Mantenimiento > OK. */
export const peorEstado = (estados) => estados.reduce((a, b) => (pesoEstado(b) > pesoEstado(a) ? b : a), 'OK');

const plano = (f) => (typeof f?.toObject === 'function' ? f.toObject() : { ...f });

/**
 * Devuelve SIEMPRE los dos filamentos (ida, vuelta) con estado explícito. Los enlaces anteriores a las alarmas por
 * filamento no tienen estado propio: heredan el del enlace, que es lo que valía hasta entonces.
 */
export function materializarFilamentos(link) {
  return SENTIDOS.map((sentido) => {
    const f = plano((link.filamentos ?? []).find((x) => x.sentido === sentido) ?? { sentido });
    return { ...f, sentido, estado: f.estado ?? link.estado, estado_desde: f.estado_desde ?? link.estado_desde };
  });
}

export const etiquetaFilamentos = (sentidos) => (sentidos.length >= 2 ? 'ambos filamentos' : `filamento de ${sentidos[0]}`);

/** Para un enlace que nace ya en falla/mantenimiento: sus filamentos nacen en ese estado. */
export const filamentosIniciales = (estado, desde = new Date()) =>
  estado === 'OK' ? [{ sentido: 'ida' }, { sentido: 'vuelta' }] : SENTIDOS.map((sentido) => ({ sentido, estado, estado_desde: desde }));
