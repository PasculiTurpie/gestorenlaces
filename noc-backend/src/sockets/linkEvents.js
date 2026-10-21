import { emitToNoc } from './index.js';

export const usuarioResumen = (u) => ({ id: u.id, nombre: u.nombre, rol: u.rol });

/**
 * Contrato del evento hacia el frontend. Se omite el timeline completo (pesado) y se envía solo
 * el último evento; el detalle se obtiene con GET /api/links/:id.
 */
export function emitirEnlace(evento, linkDoc, { usuario, cambio } = {}) {
  const { timeline = [], ...resto } = linkDoc.toJSON();
  emitToNoc(evento, {
    link: { ...resto, ultimo_evento: timeline.at(-1) ?? null },
    cambio: cambio ?? null, // { de, a } | { campos: [...] }
    por: usuario ? usuarioResumen(usuario) : null,
    ts: new Date().toISOString(),
  });
}
