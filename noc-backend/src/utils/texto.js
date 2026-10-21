/** Minúsculas, sin tildes y sin signos: sirve para comparar nombres («Ñandú» = «nandu»). */
export const normalizar = (s) => String(s ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
