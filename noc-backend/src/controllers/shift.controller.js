import { env } from '../config/env.js';
import { descripcionHorarios, fechaDelTurno } from '../config/turnos.js';
import { IncidenceLog } from '../models/IncidenceLog.js';
import { Link } from '../models/Link.js';
import { ShiftReport } from '../models/ShiftReport.js';
import { emitToNoc } from '../sockets/index.js';
import { AppError, asyncHandler } from '../utils/errors.js';
import { esObjectId } from '../utils/ids.js';
import { renderShiftHtml } from '../views/shiftPrint.js';

const esGestor = (u) => u.rol === 'Supervisor' || u.rol === 'Admin';

const POPULATE_OPERADOR = { path: 'operador', select: 'nombre rol turno' };
const POPULATE_CHECKLIST = {
  path: 'checklist_enlaces.enlace',
  select: 'id_enlace estado estado_desde ticket_actual proveedor origen_nodo destino_nodo',
  populate: [
    { path: 'origen_nodo', select: 'id_nodo' },
    { path: 'destino_nodo', select: 'id_nodo' },
  ],
};

const poblar = (query) => query.populate(POPULATE_OPERADOR).populate(POPULATE_CHECKLIST);
const recargar = (id) => poblar(ShiftReport.findById(id));

/** Carga el acta aplicando propiedad: un Operador solo accede a las suyas; Supervisor/Admin a todas. */
async function cargarActa(id, user) {
  if (!esObjectId(id)) throw new AppError(400, 'Id de acta inválido');
  const acta = await ShiftReport.findById(id);
  if (!acta) throw new AppError(404, 'Acta de turno no encontrada');
  if (!esGestor(user) && !acta.operador.equals(user._id)) throw new AppError(403, 'No puedes acceder al acta de otro operador');
  return acta;
}

const exigirAbierta = (acta) => {
  if (acta.cerrado) throw new AppError(409, 'El acta ya está cerrada y no puede modificarse');
};

const idsDelChecklist = (acta) => acta.checklist_enlaces.map((i) => i.enlace);

/** Enlaces != OK que todavía no figuran en el checklist (cambiaron después de abrir el turno). */
const pendientesNuevos = (acta) =>
  Link.find({ estado: { $ne: 'OK' }, _id: { $nin: idsDelChecklist(acta) } })
    .select('id_enlace estado estado_desde ticket_actual')
    .sort({ id_enlace: 1 })
    .lean();

// ---------------------------------------------------------------- apertura / consulta
export const abrir = asyncHandler(async (req, res) => {
  const existente = await ShiftReport.findOne({ operador: req.user._id, cerrado: false }).select('_id');
  if (existente) {
    throw new AppError(409, `Ya tienes un turno abierto (${existente.id}). Ciérralo antes de abrir otro.`);
  }

  const acta = await ShiftReport.create({
    operador: req.user._id,
    tipo_turno: req.body.tipo_turno ?? req.user.turno,
    bitacora_general: req.body.bitacora_general ?? '',
    checklist_enlaces: await ShiftReport.checklistInicial(), // detección automática de enlaces != OK
  });

  emitToNoc('shift:opened', {
    id: acta.id,
    operador: { id: req.user.id, nombre: req.user.nombre },
    tipo_turno: acta.tipo_turno,
    pendientes: acta.checklist_enlaces.length,
    ts: new Date().toISOString(),
  });
  res.status(201).json({ ok: true, data: await recargar(acta._id) });
});

export const actual = asyncHandler(async (req, res) => {
  const acta = await poblar(ShiftReport.findOne({ operador: req.user._id, cerrado: false }));
  if (!acta) return res.json({ ok: true, data: null });
  res.json({ ok: true, data: { ...acta.toJSON(), pendientes_nuevos: await pendientesNuevos(acta) } });
});

/**
 * Traspaso de turno: el último turno CERRADO de cualquier operador, para que quien entra lea su bitácora y lo que se hizo
 * con cada enlace. Cualquier usuario autenticado puede consultarlo (es el propósito del traspaso); el resto de las actas
 * sigue restringido a su dueño. `?antes=<fecha>` limita a los turnos que terminaron antes de esa fecha (p. ej. el inicio
 * del turno propio, para no tomar como "anterior" a un compañero que cerró mientras tanto).
 */
export const anterior = asyncHandler(async (req, res) => {
  const filtro = { cerrado: true };
  if (req.query.antes) filtro.fecha_fin = { $lte: req.query.antes };
  const acta = await poblar(ShiftReport.findOne(filtro).sort({ fecha_fin: -1 }));
  res.json({ ok: true, data: acta ?? null });
});

// GET /api/shifts/schedule: horario de los turnos, cuál está en curso y cuál proponer al abrir
export const horarios = asyncHandler(async (_req, res) => {
  res.json({ ok: true, data: descripcionHorarios(env.appTimezone) });
});

export const listar = asyncHandler(async (req, res) => {
  const { operador, tipo_turno, cerrado, desde, hasta, page, limit } = req.query;
  const filtro = {};
  if (!esGestor(req.user)) filtro.operador = req.user._id;
  else if (operador) filtro.operador = operador;
  if (tipo_turno) filtro.tipo_turno = tipo_turno;
  if (cerrado !== undefined) filtro.cerrado = cerrado;
  // por FECHA DE TURNO (no por la hora de apertura): el turno noche que empezó el 19 a las 23:00 aparece en el día 20
  if (desde || hasta) filtro.fecha_turno = { ...(desde && { $gte: desde }), ...(hasta && { $lte: hasta }) };

  const [actas, total] = await Promise.all([
    ShiftReport.find(filtro).populate(POPULATE_OPERADOR).sort({ fecha_inicio: -1 }).skip((page - 1) * limit).limit(limit).lean(),
    ShiftReport.countDocuments(filtro),
  ]);

  // Listado liviano: resumen del checklist en lugar del detalle
  const data = actas.map(({ checklist_enlaces = [], ...resto }) => ({
    ...resto,
    fecha_turno: resto.fecha_turno ?? fechaDelTurno(resto.tipo_turno, resto.fecha_inicio, env.appTimezone),
    checklist_total: checklist_enlaces.length,
    checklist_pendientes: checklist_enlaces.filter((i) => i.estado_recibido !== 'OK' && !i.gestionado).length,
  }));
  res.json({ ok: true, data, meta: { total, page, limit, paginas: Math.ceil(total / limit) } });
});

export const obtener = asyncHandler(async (req, res) => {
  const acta = await cargarActa(req.params.id, req.user);
  const poblada = await recargar(acta._id);
  const extra = acta.cerrado ? {} : { pendientes_nuevos: await pendientesNuevos(acta) };
  res.json({ ok: true, data: { ...poblada.toJSON(), ...extra } });
});

// ---------------------------------------------------------------- edición
export const actualizarBitacora = asyncHandler(async (req, res) => {
  const acta = await cargarActa(req.params.id, req.user);
  exigirAbierta(acta);
  acta.bitacora_general = req.body.bitacora_general;
  await acta.save();
  res.json({ ok: true, data: await recargar(acta._id) });
});

export const actualizarChecklist = asyncHandler(async (req, res) => {
  const acta = await cargarActa(req.params.id, req.user);
  exigirAbierta(acta);

  // :enlaceId admite ObjectId o id_enlace
  const param = req.params.enlaceId;
  const link = await Link.findOne(esObjectId(param) ? { _id: param } : { id_enlace: param.toUpperCase() }).select('_id');
  const item = link && acta.checklist_enlaces.find((i) => i.enlace.equals(link._id));
  if (!item) throw new AppError(404, 'Ese enlace no está en el checklist de este turno');

  const { gestionado, accion_tomada } = req.body;
  if (gestionado !== undefined) item.gestionado = gestionado;
  if (accion_tomada !== undefined) item.accion_tomada = accion_tomada;
  await acta.save();

  res.json({ ok: true, data: await recargar(acta._id) });
});

// Incorpora al checklist los enlaces que cayeron DESPUÉS de abrir el turno
export const sincronizarChecklist = asyncHandler(async (req, res) => {
  const acta = await cargarActa(req.params.id, req.user);
  exigirAbierta(acta);

  const nuevos = await pendientesNuevos(acta);
  if (nuevos.length) {
    acta.checklist_enlaces.push(...nuevos.map((l) => ({ enlace: l._id, estado_recibido: l.estado })));
    await acta.save();
  }
  res.json({ ok: true, data: await recargar(acta._id), meta: { agregados: nuevos.length } });
});

export const cerrar = asyncHandler(async (req, res) => {
  const acta = await cargarActa(req.params.id, req.user);
  exigirAbierta(acta);

  if (req.body.bitacora_general !== undefined) acta.bitacora_general = req.body.bitacora_general;
  acta.cerrado = true; // el hook valida que todo lo recibido con falla esté gestionado y fija fecha_fin
  await acta.save(); // si falla -> 400 con el detalle de qué enlaces faltan por gestionar

  emitToNoc('shift:closed', { id: acta.id, operador: acta.operador, fecha_fin: acta.fecha_fin, ts: new Date().toISOString() });
  res.json({ ok: true, data: await recargar(acta._id) });
});

// ---------------------------------------------------------------- impresión
/**
 * HTML limpio para "Imprimir / Guardar como PDF". Requiere el header Authorization, por lo que el
 * frontend debe hacer fetch con el token y mostrar el resultado (blob URL / iframe) en lugar de
 * abrir esta URL directamente en una pestaña.
 */
export const imprimible = asyncHandler(async (req, res) => {
  const acta = await cargarActa(req.params.id, req.user);
  const poblada = await recargar(acta._id);
  const ahora = new Date();
  const hasta = acta.fecha_fin ?? ahora;

  const incidencias = await IncidenceLog.find({
    inicio: { $lt: hasta },
    $or: [{ abierta: true }, { fin: { $gt: acta.fecha_inicio } }],
  })
    .populate({ path: 'enlace', select: 'id_enlace' })
    .sort({ inicio: 1 })
    .lean();

  const html = renderShiftHtml({ acta: poblada.toJSON(), incidencias, tz: env.appTimezone, ahora });
  res
    .status(200)
    .set('Content-Type', 'text/html; charset=utf-8')
    .set('Content-Security-Policy', "default-src 'none'; style-src 'unsafe-inline'; img-src data:")
    .send(html);
});
