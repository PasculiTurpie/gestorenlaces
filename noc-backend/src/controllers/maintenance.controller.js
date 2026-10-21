import { Link } from '../models/Link.js';
import { ESTADOS_ACTIVOS, Maintenance } from '../models/Maintenance.js';
import { actualizarMantenimiento, cancelarMantenimiento, crearMantenimiento, finalizarMantenimiento, iniciarMantenimiento } from '../services/maintenance.service.js';
import { emitToNoc } from '../sockets/index.js';
import { usuarioResumen } from '../sockets/linkEvents.js';
import { AppError, asyncHandler } from '../utils/errors.js';
import { esObjectId } from '../utils/ids.js';

const POPULATE = [
  { path: 'enlaces', select: 'id_enlace estado origen_nodo destino_nodo', populate: [{ path: 'origen_nodo', select: 'id_nodo' }, { path: 'destino_nodo', select: 'id_nodo' }] },
  { path: 'tipificacion', select: 'codigo nombre' },
  { path: 'creado_por', select: 'nombre' },
];
const poblar = (q) => POPULATE.reduce((acc, p) => acc.populate(p), q);
const cargar = (id) => poblar(Maintenance.findById(id));

async function buscar(id) {
  if (!esObjectId(id)) throw new AppError(400, 'Id de mantenimiento inválido');
  const m = await Maintenance.findById(id);
  if (!m) throw new AppError(404, 'Mantenimiento no encontrado');
  return m;
}

/** Aviso a todas las consolas: cada una recarga la lista y muestra un aviso. */
const avisar = (accion, m, usuario) =>
  emitToNoc('maintenance:changed', { id: String(m._id), accion, estado: m.estado, titulo: m.titulo, enlaces: m.enlaces.length, por: usuarioResumen(usuario), ts: new Date().toISOString() });

// GET /api/maintenance?estado=Programado,En curso&enlace=&desde=&hasta=
export const listar = asyncHandler(async (req, res) => {
  const { estado = ESTADOS_ACTIVOS, enlace, desde, hasta, page, limit } = req.query;
  const filtro = { estado: { $in: estado } };
  if (enlace) {
    const l = await Link.findOne(esObjectId(enlace) ? { _id: enlace } : { id_enlace: enlace }).select('_id');
    if (!l) return res.json({ ok: true, data: [], meta: { total: 0, page, limit, paginas: 0 } });
    filtro.enlaces = l._id;
  }
  // la ventana del mantenimiento se solapa con [desde, hasta]
  if (desde) filtro.fin = { $gte: desde };
  if (hasta) filtro.inicio = { $lte: hasta };
  const soloActivos = estado.every((e) => ESTADOS_ACTIVOS.includes(e));
  const [datos, total] = await Promise.all([
    poblar(Maintenance.find(filtro).select('-historial').sort(soloActivos ? { inicio: 1 } : { fin: -1 }).skip((page - 1) * limit).limit(limit)).lean(),
    Maintenance.countDocuments(filtro),
  ]);
  res.json({ ok: true, data: datos, meta: { total, page, limit, paginas: Math.ceil(total / limit) } });
});

export const detalle = asyncHandler(async (req, res) => {
  const m = await buscar(req.params.id);
  res.json({ ok: true, data: await poblar(Maintenance.findById(m._id).populate({ path: 'historial.usuario', select: 'nombre' })) });
});

export const crear = asyncHandler(async (req, res) => {
  const m = await crearMantenimiento({ datos: req.body, usuario: req.user });
  avisar('programado', m, req.user);
  res.status(201).json({ ok: true, data: await cargar(m._id) });
});

export const actualizar = asyncHandler(async (req, res) => {
  const m = await actualizarMantenimiento({ m: await buscar(req.params.id), cambios: req.body, usuario: req.user });
  avisar('editado', m, req.user);
  res.json({ ok: true, data: await cargar(m._id) });
});

export const iniciar = asyncHandler(async (req, res) => {
  await buscar(req.params.id);
  const { m, resultado } = await iniciarMantenimiento({ id: req.params.id, usuario: req.user, observacion: req.body.observacion });
  avisar('iniciado', m, req.user);
  res.json({ ok: true, data: await cargar(m._id), resultado });
});

export const finalizar = asyncHandler(async (req, res) => {
  await buscar(req.params.id);
  const { m, resultado, completo } = await finalizarMantenimiento({ id: req.params.id, usuario: req.user, observacion: req.body.observacion });
  if (completo) avisar('finalizado', m, req.user);
  res.json({ ok: true, completo, data: await cargar(m._id), resultado });
});

export const cancelar = asyncHandler(async (req, res) => {
  await buscar(req.params.id);
  const m = await cancelarMantenimiento({ id: req.params.id, usuario: req.user, motivo: req.body.motivo });
  avisar('cancelado', m, req.user);
  res.json({ ok: true, data: await cargar(m._id) });
});
