import { Link } from '../models/Link.js';
import { NodeDoc } from '../models/Node.js';
import { emitToNoc } from '../sockets/index.js';
import { AppError, asyncHandler } from '../utils/errors.js';
import { esObjectId } from '../utils/ids.js';

const filtroPorId = (id) => (esObjectId(id) ? { _id: id } : { id_nodo: String(id).toUpperCase() });
const quien = (u) => ({ id: u.id, nombre: u.nombre, rol: u.rol });

async function buscarNodoOr404(id) {
  const nodo = await NodeDoc.findOne(filtroPorId(id));
  if (!nodo) throw new AppError(404, `Nodo no encontrado: ${id}`);
  return nodo;
}

export const listar = asyncHandler(async (_req, res) => {
  const data = await NodeDoc.find().sort({ id_nodo: 1 }).lean();
  res.json({ ok: true, data, meta: { total: data.length } });
});

export const obtener = asyncHandler(async (req, res) => {
  const nodo = await buscarNodoOr404(req.params.id);
  const enlaces = await Link.find({ $or: [{ origen_nodo: nodo._id }, { destino_nodo: nodo._id }] })
    .select('id_enlace estado origen_nodo destino_nodo')
    .sort({ id_enlace: 1 })
    .lean();
  res.json({ ok: true, data: { ...nodo.toJSON(), enlaces } });
});

export const crear = asyncHandler(async (req, res) => {
  const nodo = await NodeDoc.create(req.body);
  emitToNoc('node:created', { node: nodo.toJSON(), por: quien(req.user), ts: new Date().toISOString() });
  res.status(201).json({ ok: true, data: nodo });
});

export const actualizar = asyncHandler(async (req, res) => {
  const nodo = await buscarNodoOr404(req.params.id);
  const { nombre, tipo, posicion } = req.body;
  if (nombre !== undefined) nodo.nombre = nombre;
  if (tipo !== undefined) nodo.tipo = tipo;
  if (posicion) nodo.posicion = posicion;
  await nodo.save();
  emitToNoc('node:updated', { node: nodo.toJSON(), por: quien(req.user), ts: new Date().toISOString() });
  res.json({ ok: true, data: nodo });
});

/**
 * Persistencia al soltar un nodo en el canvas (onNodeDragStop de React Flow).
 * Se guarda UNA vez al soltar, no en cada movimiento. Update atómico de x/y.
 */
export const moverPosicion = asyncHandler(async (req, res) => {
  const { x, y } = req.body;
  const nodo = await NodeDoc.findOneAndUpdate(
    filtroPorId(req.params.id),
    { $set: { 'posicion.x': x, 'posicion.y': y } },
    { new: true, runValidators: true },
  );
  if (!nodo) throw new AppError(404, `Nodo no encontrado: ${req.params.id}`);

  emitToNoc('node:moved', {
    id: nodo.id,
    id_nodo: nodo.id_nodo,
    posicion: nodo.posicion,
    por: quien(req.user),
    ts: new Date().toISOString(),
  });
  res.json({ ok: true, data: nodo });
});

// Guardar el layout completo de una vez (botón "Guardar disposición")
export const moverPosiciones = asyncHandler(async (req, res) => {
  const { nodos } = req.body;
  const ids = nodos.map((n) => n.id.toUpperCase());
  if (new Set(ids).size !== ids.length) throw new AppError(400, 'Hay nodos repetidos en la petición');

  const existentes = await NodeDoc.countDocuments({ $or: nodos.map((n) => filtroPorId(n.id)) });
  if (existentes !== nodos.length) throw new AppError(404, 'Uno o más nodos no existen; no se guardó ningún cambio');

  await NodeDoc.bulkWrite(
    nodos.map((n) => ({
      updateOne: { filter: filtroPorId(n.id), update: { $set: { 'posicion.x': n.x, 'posicion.y': n.y } } },
    })),
    { ordered: false },
  );

  const actualizados = await NodeDoc.find({ $or: nodos.map((n) => filtroPorId(n.id)) }).select('id_nodo posicion').lean();
  emitToNoc('node:layout', { nodos: actualizados, por: quien(req.user), ts: new Date().toISOString() });
  res.json({ ok: true, data: actualizados });
});

export const eliminar = asyncHandler(async (req, res) => {
  const nodo = await buscarNodoOr404(req.params.id);
  const enlaces = await Link.countDocuments({ $or: [{ origen_nodo: nodo._id }, { destino_nodo: nodo._id }] });
  if (enlaces) {
    throw new AppError(409, `No se puede eliminar: el nodo participa en ${enlaces} enlace(s). Elimine o reasigne esos enlaces primero.`);
  }
  await nodo.deleteOne();
  emitToNoc('node:deleted', { id: nodo.id, id_nodo: nodo.id_nodo, por: quien(req.user), ts: new Date().toISOString() });
  res.json({ ok: true, data: { id: nodo.id, id_nodo: nodo.id_nodo } });
});
