import { IncidenceLog, SEVERIDADES } from '../models/IncidenceLog.js';

/**
 * Mantiene el invariante "enlace en Caido/Degradado  <=>  existe una incidencia abierta de esa severidad".
 *  - Si hay una abierta de otra severidad (o el enlace ya no está en falla) -> se cierra.
 *  - Si el nuevo estado es una falla y no hay abierta de esa severidad -> se abre una nueva.
 * Caido -> Degradado cierra la incidencia Caido y abre una Degradado (cada tramo se mide por separado).
 *
 * `tipificacion` (id del tipo de alarma) y `filamentosAfectados` (los filamentos que están en ese estado) se registran
 * al abrir y se mantienen al día mientras la incidencia siga abierta con la misma severidad.
 */
export async function sincronizarIncidencia({ enlaceId, nuevoEstado, ahora = new Date(), ticket = '', causa_raiz = '', tipificacion = null, filamentosAfectados = [] }) {
  const abierta = await IncidenceLog.findOne({ enlace: enlaceId, abierta: true });
  const esFalla = SEVERIDADES.includes(nuevoEstado);

  if (abierta?.severidad === nuevoEstado) {
    let cambio = false;
    if (ticket && abierta.ticket !== ticket) { abierta.ticket = ticket; cambio = true; }
    if (tipificacion && !abierta.tipificacion) { abierta.tipificacion = tipificacion; cambio = true; }
    const actuales = [...(abierta.filamentos_afectados ?? [])].sort().join();
    if (filamentosAfectados.length && [...filamentosAfectados].sort().join() !== actuales) { abierta.filamentos_afectados = filamentosAfectados; cambio = true; }
    if (cambio) await abierta.save();
    return abierta;
  }

  if (abierta) {
    abierta.fin = ahora; // el hook calcula duracion_minutos y abierta=false
    if (causa_raiz) abierta.causa_raiz = causa_raiz;
    if (ticket) abierta.ticket = ticket;
    await abierta.save();
  }

  if (!esFalla) return null;

  try {
    return await IncidenceLog.create({ enlace: enlaceId, severidad: nuevoEstado, inicio: ahora, ticket, tipificacion, filamentos_afectados: filamentosAfectados });
  } catch (err) {
    // Carrera: otra petición abrió la incidencia entre medias (índice parcial único)
    if (err.code === 11000) return IncidenceLog.findOne({ enlace: enlaceId, abierta: true });
    throw err;
  }
}
