import { IncidenceLog } from '../models/IncidenceLog.js';
import { Link } from '../models/Link.js';
import { Adjunto } from '../models/Adjunto.js';
import { AlarmType } from '../models/AlarmType.js';
import { adjuntoPublico, eliminarAdjunto } from '../services/adjuntos.service.js';
import { emitToNoc } from '../sockets/index.js';
import { AppError, asyncHandler } from '../utils/errors.js';
import { esObjectId } from '../utils/ids.js';

const filtroPorId = (id) => (esObjectId(id) ? { _id: id } : { codigo: String(id).toUpperCase() });
const avisar = (u) => emitToNoc('alarmtype:changed', { por: { id: u.id, nombre: u.nombre, rol: u.rol }, ts: new Date().toISOString() });

async function buscarOr404(id) {
  const tipo = await AlarmType.findOne(filtroPorId(id));
  if (!tipo) throw new AppError(404, `Tipo de alarma no encontrado: ${id}`);
  return tipo;
}

export const listar = asyncHandler(async (_req, res) => {
  const [tipos, adjuntos, enIncidencias, enFilamentos] = await Promise.all([
    AlarmType.find().collation({ locale: 'es' }).sort({ nombre: 1 }).lean(),
    Adjunto.find().sort({ createdAt: -1 }).populate('subido_por', 'nombre').lean(),
    IncidenceLog.aggregate([{ $match: { tipificacion: { $ne: null } } }, { $group: { _id: '$tipificacion', n: { $sum: 1 } } }]),
    Link.aggregate([{ $unwind: '$filamentos' }, { $match: { 'filamentos.alarma.tipificacion': { $ne: null } } }, { $group: { _id: '$filamentos.alarma.tipificacion', n: { $sum: 1 } } }]),
  ]);
  const inc = new Map(enIncidencias.map((u) => [String(u._id), u.n]));
  const act = new Map(enFilamentos.map((u) => [String(u._id), u.n]));
  const docs = new Map();
  for (const a of adjuntos) docs.set(String(a.alarma), [...(docs.get(String(a.alarma)) ?? []), adjuntoPublico(a)]);
  res.json({ ok: true, data: tipos.map((t) => ({ ...t, incidencias: inc.get(String(t._id)) ?? 0, alarmas_activas: act.get(String(t._id)) ?? 0, adjuntos: docs.get(String(t._id)) ?? [] })) });
});

export const crear = asyncHandler(async (req, res) => {
  const tipo = await AlarmType.create(req.body);
  avisar(req.user);
  res.status(201).json({ ok: true, data: tipo });
});

export const actualizar = asyncHandler(async (req, res) => {
  const tipo = await buscarOr404(req.params.id);
  Object.assign(tipo, req.body);
  await tipo.save();
  avisar(req.user);
  res.json({ ok: true, data: tipo });
});

export const eliminar = asyncHandler(async (req, res) => {
  const tipo = await buscarOr404(req.params.id);
  const [incidencias, activas] = await Promise.all([
    IncidenceLog.countDocuments({ tipificacion: tipo._id }),
    Link.countDocuments({ 'filamentos.alarma.tipificacion': tipo._id }),
  ]);
  if (incidencias || activas) {
    throw new AppError(409, `No se puede eliminar: ${incidencias} incidencia(s) y ${activas} alarma(s) activa(s) la referencian. Desactívela en su lugar.`);
  }
  // los documentos adjuntos se eliminan junto con la tipificación (BD y disco)
  for (const adjunto of await Adjunto.find({ alarma: tipo._id })) await eliminarAdjunto(adjunto);
  await tipo.deleteOne();
  avisar(req.user);
  res.json({ ok: true, data: { id: tipo.id, codigo: tipo.codigo } });
});
