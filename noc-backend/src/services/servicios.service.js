import { Link } from '../models/Link.js';
import { Service } from '../models/Service.js';
import { AppError } from '../utils/errors.js';
import { esObjectId } from '../utils/ids.js';

/** Enlaces en la forma que usa el reconocimiento: { _id, id_enlace, origen, destino } (los nodos por su id_nodo). */
export async function cargarCatalogoEnlaces() {
  const ls = await Link.find().select('id_enlace origen_nodo destino_nodo').populate([{ path: 'origen_nodo', select: 'id_nodo' }, { path: 'destino_nodo', select: 'id_nodo' }]).lean();
  return ls.map((l) => ({ _id: String(l._id), id_enlace: l.id_enlace, origen: l.origen_nodo?.id_nodo, destino: l.destino_nodo?.id_nodo }));
}

/** Servicios que ya existen entre los nombres del archivo: Map(clave → servicio). */
export async function cargarExistentes(claves) {
  const docs = claves.length ? await Service.find({ clave: { $in: claves } }).lean() : [];
  return new Map(docs.map((d) => [d.clave, { ...d, _id: String(d._id), enlaces: (d.enlaces ?? []).map(String) }]));
}

const TANDA = 500;

/**
 * Aplica el plan: crea los servicios nuevos y actualiza los que cambian (los "sin_cambios" no se tocan).
 * Por tandas y sin ordenar: si un servicio falla (p. ej. otro usuario creó el mismo nombre a la vez), el resto se guarda y se informa.
 */
export async function aplicarPlan(plan, usuario) {
  const ops = [];
  for (const s of plan.servicios) {
    if (s.accion === 'crear') {
      ops.push({ insertOne: { document: { nombre: s.nombre, clave: s.clave, ...s.campos, enlaces: s.enlaces_finales, actualizado_por: usuario?._id } } });
    } else if (s.accion === 'actualizar') {
      ops.push({ updateOne: { filter: { _id: s.existente }, update: { $set: { ...s.campos, enlaces: s.enlaces_finales, actualizado_por: usuario?._id } } } });
    }
  }
  const resultado = { creados: 0, actualizados: 0, errores: [] };
  for (let i = 0; i < ops.length; i += TANDA) {
    const tanda = ops.slice(i, i + TANDA);
    try {
      const r = await Service.bulkWrite(tanda, { ordered: false });
      resultado.creados += r.insertedCount ?? 0;
      resultado.actualizados += r.modifiedCount ?? 0;
    } catch (err) {
      const r = err.result ?? err;
      resultado.creados += r.insertedCount ?? r.nInserted ?? 0;
      resultado.actualizados += r.modifiedCount ?? r.nModified ?? 0;
      for (const e of err.writeErrors ?? []) resultado.errores.push({ servicio: tanda[e.index ?? e.err?.index]?.insertOne?.document?.nombre ?? '(actualización)', motivo: e.errmsg ?? e.err?.errmsg ?? 'error al guardar' });
      if (!err.writeErrors?.length) throw err;
    }
  }
  return resultado;
}

/**
 * Resuelve referencias (ObjectId o código de enlace) CONSERVANDO el orden indicado: en un servicio el orden es el recorrido.
 * Sin repetidos. Falla (404) si alguna no existe.
 */
export async function resolverEnlacesEnOrden(refs) {
  const unicos = [...new Set(refs.map((r) => String(r).trim()))];
  const encontrados = await Link.find({ $or: [{ _id: { $in: unicos.filter(esObjectId) } }, { id_enlace: { $in: unicos.filter((r) => !esObjectId(r)).map((r) => r.toUpperCase()) } }] }).select('_id id_enlace');
  const porRef = new Map();
  for (const l of encontrados) { porRef.set(String(l._id), l._id); porRef.set(String(l.id_enlace).toUpperCase(), l._id); }
  const faltan = unicos.filter((r) => !porRef.has(esObjectId(r) ? r : r.toUpperCase()));
  if (faltan.length) throw new AppError(404, `Enlace(s) no encontrado(s): ${faltan.join(', ')}`);
  const ids = unicos.map((r) => porRef.get(esObjectId(r) ? r : r.toUpperCase()));
  return [...new Map(ids.map((i) => [String(i), i])).values()];
}
