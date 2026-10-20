import { Link } from '../models/Link.js';
import { LinkType } from '../models/LinkType.js';
import { emitToNoc } from '../sockets/index.js';
import { AppError, asyncHandler } from '../utils/errors.js';
import { esObjectId } from '../utils/ids.js';

const filtroPorId = (id) => (esObjectId(id) ? { _id: id } : { clave: String(id).toUpperCase() });
const quien = (u) => ({ id: u.id, nombre: u.nombre, rol: u.rol });
const avisar = (u) => emitToNoc('linktype:changed', { por: quien(u), ts: new Date().toISOString() });

async function buscarOr404(id) {
  const tipo = await LinkType.findOne(filtroPorId(id));
  if (!tipo) throw new AppError(404, `Tipo de línea no encontrado: ${id}`);
  return tipo;
}

export const listar = asyncHandler(async (_req, res) => {
  const [tipos, usos] = await Promise.all([
    LinkType.find().collation({ locale: 'es' }).sort({ propio: -1, nombre: 1 }).lean(),
    Link.aggregate([{ $group: { _id: '$tipo_enlace', n: { $sum: 1 } } }]),
  ]);
  const enUso = new Map(usos.map((u) => [String(u._id), u.n]));
  res.json({ ok: true, data: tipos.map((t) => ({ ...t, enlaces: enUso.get(String(t._id)) ?? 0 })) });
});

export const crear = asyncHandler(async (req, res) => {
  const tipo = await LinkType.create(req.body);
  avisar(req.user);
  res.status(201).json({ ok: true, data: tipo });
});

export const actualizar = asyncHandler(async (req, res) => {
  const tipo = await buscarOr404(req.params.id);
  if (tipo.propio && req.body.activo === false) throw new AppError(409, 'La red propia no se puede desactivar');
  Object.assign(tipo, req.body);
  await tipo.save();
  avisar(req.user);
  res.json({ ok: true, data: tipo });
});

export const eliminar = asyncHandler(async (req, res) => {
  const tipo = await buscarOr404(req.params.id);
  if (tipo.propio) throw new AppError(409, 'La red propia no se puede eliminar');
  const enlaces = await Link.countDocuments({ tipo_enlace: tipo._id });
  if (enlaces) {
    throw new AppError(409, `No se puede eliminar: ${enlaces} enlace(s) usan este tipo. Reasígnelos o desactive el tipo.`);
  }
  await tipo.deleteOne();
  avisar(req.user);
  res.json({ ok: true, data: { id: tipo.id, clave: tipo.clave } });
});
