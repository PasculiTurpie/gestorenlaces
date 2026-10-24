import { env } from '../config/env.js';
import { fechaDelTurno, turnoDeFecha } from '../config/turnos.js';
import { ShiftItem } from '../models/ShiftItem.js';
import { ShiftReport } from '../models/ShiftReport.js';
import { emitToNoc } from '../sockets/index.js';
import { usuarioResumen } from '../sockets/linkEvents.js';
import { AppError, asyncHandler } from '../utils/errors.js';
import { esObjectId } from '../utils/ids.js';

const escapar = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const avisar = (accion, item, usuario) =>
  emitToNoc('item:changed', { id: String(item._id), accion, estado: item.estado, titulo: item.titulo, ticket: item.ticket, por: usuarioResumen(usuario), ts: new Date().toISOString() });
const anotar = (item, usuario, accion) => item.historial.push({ fecha: new Date(), nombre: usuario.nombre, accion });

async function buscar(id) {
  if (!esObjectId(id)) throw new AppError(400, 'Id de ítem inválido');
  const item = await ShiftItem.findById(id);
  if (!item) throw new AppError(404, 'Ítem no encontrado');
  return item;
}

/** El turno en que se ingresa: el que el usuario tiene abierto; si no tiene ninguno, el que corresponde a la hora. */
async function turnoDe(usuario, ahora = new Date()) {
  const acta = await ShiftReport.findOne({ operador: usuario._id, cerrado: false }).select('tipo_turno fecha_turno');
  const tipo = acta?.tipo_turno ?? turnoDeFecha(ahora, env.appTimezone);
  return { tipo_turno: tipo, fecha_turno: acta?.fecha_turno ?? fechaDelTurno(tipo, ahora, env.appTimezone) };
}

// GET /api/shift-items?estado=Abierto|Resuelto|todos&q=
export const listar = asyncHandler(async (req, res) => {
  const { estado, q, page, limit } = req.query;
  const filtro = {};
  if (estado !== 'todos') filtro.estado = estado;
  if (q) { const rx = { $regex: escapar(q), $options: 'i' }; filtro.$or = [{ titulo: rx }, { ticket: rx }, { descripcion: rx }]; }
  const orden = estado === 'Resuelto' ? { resuelto_en: -1 } : { createdAt: -1 };
  const [data, total] = await Promise.all([ShiftItem.find(filtro).sort(orden).skip((page - 1) * limit).limit(limit).lean(), ShiftItem.countDocuments(filtro)]);
  res.json({ ok: true, data, meta: { total, page, limit, paginas: Math.ceil(total / limit) } });
});

export const detalle = asyncHandler(async (req, res) => res.json({ ok: true, data: await buscar(req.params.id) }));

export const crear = asyncHandler(async (req, res) => {
  const ahora = new Date();
  const item = new ShiftItem({ ...req.body, creado_por: req.user._id, creado_por_nombre: req.user.nombre, turno_ingreso: await turnoDe(req.user, ahora) });
  anotar(item, req.user, 'Ingresado');
  await item.save();
  avisar('creado', item, req.user);
  res.status(201).json({ ok: true, data: item });
});

export const actualizar = asyncHandler(async (req, res) => {
  const item = await buscar(req.params.id);
  if (item.estado === 'Resuelto') throw new AppError(409, 'Un ítem resuelto no se edita: reábralo primero');
  const cambios = Object.keys(req.body).filter((k) => item[k] !== req.body[k]);
  if (!cambios.length) return res.json({ ok: true, data: item });
  Object.assign(item, req.body);
  anotar(item, req.user, `Editado (${cambios.join(', ')})`);
  await item.save();
  avisar('editado', item, req.user);
  res.json({ ok: true, data: item });
});

export const agregarSeguimiento = asyncHandler(async (req, res) => {
  const item = await buscar(req.params.id);
  if (item.estado === 'Resuelto') throw new AppError(409, 'El ítem está resuelto: reábralo para agregar seguimiento');
  item.seguimiento.push({ fecha: new Date(), usuario: req.user._id, nombre: req.user.nombre, texto: req.body.texto });
  await item.save();
  avisar('seguimiento', item, req.user);
  res.status(201).json({ ok: true, data: item });
});

export const resolver = asyncHandler(async (req, res) => {
  // se "reclama" de forma atómica: dos operadores que lo resuelven a la vez no lo resuelven dos veces
  const item = await ShiftItem.findOneAndUpdate(
    { _id: esObjectId(req.params.id) ? req.params.id : null, estado: 'Abierto' },
    { $set: { estado: 'Resuelto', resuelto_por: req.user._id, resuelto_por_nombre: req.user.nombre, resuelto_en: new Date(), resolucion: req.body.resolucion } },
    { new: true },
  );
  if (!item) { await buscar(req.params.id); throw new AppError(409, 'El ítem ya estaba resuelto'); }
  anotar(item, req.user, 'Resuelto');
  await item.save();
  avisar('resuelto', item, req.user);
  res.json({ ok: true, data: item });
});

export const reabrir = asyncHandler(async (req, res) => {
  const item = await buscar(req.params.id);
  if (item.estado !== 'Resuelto') throw new AppError(409, 'El ítem ya está abierto');
  item.estado = 'Abierto';
  item.resuelto_por = undefined; item.resuelto_por_nombre = undefined; item.resuelto_en = undefined; item.resolucion = undefined;
  anotar(item, req.user, 'Reabierto');
  await item.save();
  avisar('reabierto', item, req.user);
  res.json({ ok: true, data: item });
});
