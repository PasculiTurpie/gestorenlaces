import { IncidenceLog } from '../models/IncidenceLog.js';
import { Link } from '../models/Link.js';
import { AppError, asyncHandler } from '../utils/errors.js';
import { esObjectId } from '../utils/ids.js';

const POPULATE_ENLACE = [{ path: 'enlace', select: 'id_enlace estado proveedor' }, { path: 'tipificacion', select: 'codigo nombre' }];

export const listar = asyncHandler(async (req, res) => {
  const { enlace, severidad, abierta, desde, hasta, page, limit } = req.query;
  const and = [];

  if (enlace) {
    const l = await Link.findOne(esObjectId(enlace) ? { _id: enlace } : { id_enlace: enlace.toUpperCase() }).select('_id').lean();
    and.push({ enlace: l ? l._id : null });
  }
  if (severidad) and.push({ severidad });
  if (abierta !== undefined) and.push({ abierta });
  // Solape con la ventana [desde, hasta]
  if (desde) and.push({ $or: [{ abierta: true }, { fin: { $gt: desde } }] });
  if (hasta) and.push({ inicio: { $lt: hasta } });
  const filtro = and.length ? { $and: and } : {};

  const [data, total] = await Promise.all([
    IncidenceLog.find(filtro).populate(POPULATE_ENLACE).sort({ inicio: -1 }).skip((page - 1) * limit).limit(limit).lean(),
    IncidenceLog.countDocuments(filtro),
  ]);
  res.json({ ok: true, data, meta: { total, page, limit, paginas: Math.ceil(total / limit) } });
});

export const obtener = asyncHandler(async (req, res) => {
  if (!esObjectId(req.params.id)) throw new AppError(400, 'Id de incidencia inválido');
  const inc = await IncidenceLog.findById(req.params.id).populate(POPULATE_ENLACE).lean();
  if (!inc) throw new AppError(404, 'Incidencia no encontrada');
  res.json({ ok: true, data: inc });
});

// Solo causa raíz y ticket: inicio/fin son el registro de auditoría y los gestiona el cambio de estado.
export const actualizar = asyncHandler(async (req, res) => {
  if (!esObjectId(req.params.id)) throw new AppError(400, 'Id de incidencia inválido');
  const inc = await IncidenceLog.findById(req.params.id);
  if (!inc) throw new AppError(404, 'Incidencia no encontrada');

  if (req.body.causa_raiz !== undefined) inc.causa_raiz = req.body.causa_raiz;
  if (req.body.ticket !== undefined) inc.ticket = req.body.ticket;
  await inc.save();

  res.json({ ok: true, data: await IncidenceLog.findById(inc._id).populate(POPULATE_ENLACE).lean() });
});
