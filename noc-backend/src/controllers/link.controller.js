import { env } from '../config/env.js';
import { Link, SENTIDOS } from '../models/Link.js';
import { LinkType } from '../models/LinkType.js';
import { AlarmType } from '../models/AlarmType.js';
import { Zonal } from '../models/Zonal.js';
import { filamentosIniciales } from '../utils/filamentos.js';
import { ordenarTramos, redondearKm, validarTramos } from '../utils/tramos.js';
import { NodeDoc } from '../models/Node.js';
import { IncidenceLog } from '../models/IncidenceLog.js';
import { sincronizarIncidencia } from '../services/incidence.service.js';
import { POPULATE_NODOS, cambiarEstado, pushTimeline } from '../services/link.service.js';
import { anioMesEnZona, metricasMensuales, rangoMes } from '../services/metrics.service.js';
import { emitToNoc } from '../sockets/index.js';
import { AppError, asyncHandler } from '../utils/errors.js';
import { escapeRegex, esObjectId } from '../utils/ids.js';

// ---------------------------------------------------------------- helpers
const filtroPorId = (id) => (esObjectId(id) ? { _id: id } : { id_enlace: String(id).toUpperCase() });

async function buscarEnlaceOr404(id) {
  const link = await Link.findOne(filtroPorId(id));
  if (!link) throw new AppError(404, `Enlace no encontrado: ${id}`);
  return link;
}

async function resolverNodo(ref, campo) {
  const nodo = esObjectId(ref)
    ? await NodeDoc.findById(ref)
    : await NodeDoc.findOne({ id_nodo: String(ref).toUpperCase() });
  if (!nodo) throw new AppError(404, `Nodo no encontrado (${campo}): ${ref}`);
  return nodo;
}

/** Resuelve un tipo de línea por clave (ej. "WOM") u ObjectId. */
async function resolverTipo(ref) {
  const tipo = await LinkType.findOne(esObjectId(ref) ? { _id: ref } : { clave: String(ref).toUpperCase() });
  if (!tipo) throw new AppError(404, `Tipo de línea no encontrado: ${ref}`);
  return tipo;
}

/** Resuelve un tipo de alarma por código (ej. "LOS") u ObjectId. Debe existir y estar activo. */
async function resolverTipificacion(ref) {
  const tipo = await AlarmType.findOne(esObjectId(ref) ? { _id: ref } : { codigo: String(ref).toUpperCase() });
  if (!tipo) throw new AppError(404, `Tipo de alarma no encontrado: ${ref}`);
  if (!tipo.activo) throw new AppError(409, `El tipo de alarma "${tipo.nombre}" está desactivado`);
  return tipo;
}

const usuarioResumen = (u) => ({ id: u.id, nombre: u.nombre, rol: u.rol });

/**
 * Contrato del evento hacia el frontend. Se omite el timeline completo (pesado) y se envía solo
 * el último evento; el detalle se obtiene con GET /api/links/:id.
 */
function emitirEnlace(evento, linkDoc, { usuario, cambio } = {}) {
  const { timeline = [], ...resto } = linkDoc.toJSON();
  emitToNoc(evento, {
    link: { ...resto, ultimo_evento: timeline.at(-1) ?? null },
    cambio: cambio ?? null, // { de, a } | { campos: [...] }
    por: usuario ? usuarioResumen(usuario) : null,
    ts: new Date().toISOString(),
  });
}

const recargar = (id) => Link.findById(id).populate(POPULATE_NODOS);

// ---------------------------------------------------------------- handlers
export const listar = asyncHandler(async (req, res) => {
  const { estado, proveedor, nodo, tipo, page, limit } = req.query;
  const filtro = {};

  if (estado) filtro.estado = { $in: estado };
  if (proveedor) filtro.proveedor = new RegExp(`^${escapeRegex(proveedor)}$`, 'i');
  if (nodo) {
    const n = await NodeDoc.findOne({ id_nodo: nodo.toUpperCase() }).select('_id').lean();
    if (n) filtro.$or = [{ origen_nodo: n._id }, { destino_nodo: n._id }];
    else filtro._id = { $in: [] }; // nodo inexistente -> resultado vacío
  }

  if (tipo) {
    const t = await LinkType.findOne({ clave: tipo.toUpperCase() }).select('_id').lean();
    if (t) filtro.tipo_enlace = t._id;
    else filtro._id = { $in: [] }; // tipo inexistente -> resultado vacío
  }

  const [data, total] = await Promise.all([
    Link.find(filtro)
      .select('-timeline') // el listado alimenta el canvas: sin bitácora
      .populate(POPULATE_NODOS)
      .sort({ id_enlace: 1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean(),
    Link.countDocuments(filtro),
  ]);

  res.json({ ok: true, data, meta: { total, page, limit, paginas: Math.ceil(total / limit) } });
});

export const obtener = asyncHandler(async (req, res) => {
  const link = await Link.findOne(filtroPorId(req.params.id))
    .populate(POPULATE_NODOS)
    .populate({ path: 'timeline.operador', select: 'nombre rol' });
  if (!link) throw new AppError(404, `Enlace no encontrado: ${req.params.id}`);

  const incidencia_abierta = await IncidenceLog.findOne({ enlace: link._id, abierta: true }).lean();
  res.json({ ok: true, data: { ...link.toJSON(), incidencia_abierta } }); // timeline en orden cronológico
});

export const crear = asyncHandler(async (req, res) => {
  const { id_enlace, origen_nodo, destino_nodo, estado, proveedor, ticket_actual, tipo_enlace } = req.body;
  const [origen, destino] = await Promise.all([
    resolverNodo(origen_nodo, 'origen_nodo'),
    resolverNodo(destino_nodo, 'destino_nodo'),
  ]);

  // sin tipo explícito: red propia (si existe en el catálogo)
  const tipo = tipo_enlace ? await resolverTipo(tipo_enlace) : await LinkType.findOne({ propio: true });
  if (tipo && !tipo.activo) throw new AppError(409, `El tipo de línea "${tipo.nombre}" está desactivado`);

  const ahora = new Date();
  const link = await Link.create({
    id_enlace,
    tipo_enlace: tipo?._id ?? null,
    origen_nodo: origen._id,
    destino_nodo: destino._id,
    estado,
    estado_desde: ahora,
    filamentos: filamentosIniciales(estado, ahora),
    proveedor,
    ticket_actual,
    timeline: [
      { fecha: ahora, operador: req.user._id, accion: 'Enlace creado', observacion: `Estado inicial: ${estado}`, ticket: ticket_actual },
    ],
  });

  // Si nace en falla, debe abrir su incidencia
  await sincronizarIncidencia({ enlaceId: link._id, nuevoEstado: estado, ahora, ticket: ticket_actual });

  const populado = await recargar(link._id);
  emitirEnlace('link:created', populado, { usuario: req.user });
  res.status(201).json({ ok: true, data: populado });
});

export const actualizar = asyncHandler(async (req, res) => {
  const link = await buscarEnlaceOr404(req.params.id);
  const { origen_nodo, destino_nodo, proveedor, ticket_actual, tipo_enlace } = req.body;
  const campos = [];

  if (origen_nodo) {
    link.origen_nodo = (await resolverNodo(origen_nodo, 'origen_nodo'))._id;
    campos.push('origen_nodo');
  }
  if (destino_nodo) {
    link.destino_nodo = (await resolverNodo(destino_nodo, 'destino_nodo'))._id;
    campos.push('destino_nodo');
  }
  if (tipo_enlace) {
    const tipo = await resolverTipo(tipo_enlace);
    if (String(link.tipo_enlace) !== String(tipo._id)) {
      if (!tipo.activo) throw new AppError(409, `El tipo de línea "${tipo.nombre}" está desactivado`);
      link.tipo_enlace = tipo._id;
      campos.push('tipo_enlace');
    }
  }
  if (proveedor !== undefined && proveedor !== link.proveedor) {
    link.proveedor = proveedor;
    campos.push('proveedor');
  }
  if (ticket_actual !== undefined && ticket_actual !== link.ticket_actual) {
    link.ticket_actual = ticket_actual;
    campos.push('ticket_actual');
  }

  if (campos.length) {
    await link.save(); // dispara validaciones (origen != destino)
    await Link.updateOne(
      { _id: link._id },
      pushTimeline({
        fecha: new Date(),
        operador: req.user._id,
        accion: 'Datos del enlace actualizados',
        observacion: `Campos: ${campos.join(', ')}`,
        ticket: link.ticket_actual,
      }),
    );
    if (campos.includes('ticket_actual') && link.ticket_actual) {
      await IncidenceLog.updateOne({ enlace: link._id, abierta: true }, { $set: { ticket: link.ticket_actual } });
    }
  }

  const populado = await recargar(link._id);
  if (campos.length) emitirEnlace('link:updated', populado, { usuario: req.user, cambio: { campos } });
  res.json({ ok: true, data: populado });
});

export const actualizarEstado = asyncHandler(async (req, res) => {
  const link = await buscarEnlaceOr404(req.params.id);
  const { estado, observacion, ticket, causa_raiz, filamentos, tipificacion } = req.body;
  const tipo = tipificacion ? await resolverTipificacion(tipificacion) : null;

  const { link: actualizado, de, a, filamentos: afectados, fibraDe, fibraA } = await cambiarEstado({
    link,
    nuevoEstado: estado,
    filamentos,
    tipificacion: tipo,
    usuario: req.user,
    observacion,
    ticket,
    causa_raiz,
  });

  emitirEnlace('link:updated', actualizado, {
    usuario: req.user,
    // de/a = estado del ENLACE; filamentos/fibraDe/fibraA = lo que cambió en los filamentos (pueden diferir)
    cambio: { de, a, filamentos: afectados, fibraDe, fibraA, tipificacion: tipo?.codigo ?? null },
  });
  res.json({ ok: true, data: actualizado });
});

export const agregarTimeline = asyncHandler(async (req, res) => {
  const link = await buscarEnlaceOr404(req.params.id);
  const { accion, observacion, ticket } = req.body;

  const actualizado = await Link.findOneAndUpdate(
    { _id: link._id },
    pushTimeline({ fecha: new Date(), operador: req.user._id, accion, observacion, ticket: ticket || link.ticket_actual }),
    { new: true, runValidators: true },
  ).populate(POPULATE_NODOS);

  emitirEnlace('link:updated', actualizado, { usuario: req.user, cambio: { campos: ['timeline'] } });
  res.status(201).json({ ok: true, data: actualizado.timeline.at(-1) });
});

export const eliminar = asyncHandler(async (req, res) => {
  const link = await buscarEnlaceOr404(req.params.id);
  const tieneHistorial = await IncidenceLog.exists({ enlace: link._id });

  if (tieneHistorial && !req.query.force) {
    throw new AppError(
      409,
      'El enlace tiene historial de incidencias (registro de auditoría). Use ?force=true para eliminarlo junto con su historial.',
    );
  }
  if (tieneHistorial) await IncidenceLog.deleteMany({ enlace: link._id });
  await link.deleteOne();

  emitToNoc('link:deleted', { id: link.id, id_enlace: link.id_enlace, por: usuarioResumen(req.user), ts: new Date().toISOString() });
  res.json({ ok: true, data: { id: link.id, id_enlace: link.id_enlace } });
});

/**
 * Guarda el levantamiento (potencias medidas al poner en servicio) de UN filamento: ida o vuelta.
 * Un valor null borra el dato. Si se informa una potencia y no hay fecha, se asume hoy.
 */
export const guardarLevantamiento = asyncHandler(async (req, res) => {
  const sentido = req.params.sentido;
  if (!SENTIDOS.includes(sentido)) throw new AppError(400, 'El sentido debe ser "ida" o "vuelta"');

  const link = await buscarEnlaceOr404(req.params.id);
  if (link.filamentos.length !== 2) link.filamentos = [{ sentido: 'ida' }, { sentido: 'vuelta' }]; // enlaces anteriores a esta función
  const fil = link.filamentos.find((f) => f.sentido === sentido);
  fil.levantamiento ??= {};
  const lev = fil.levantamiento;

  const { potencia_tx_dbm, potencia_rx_dbm, fecha, observacion } = req.body;
  if (potencia_tx_dbm !== undefined) lev.potencia_tx_dbm = potencia_tx_dbm ?? undefined;
  if (potencia_rx_dbm !== undefined) lev.potencia_rx_dbm = potencia_rx_dbm ?? undefined;
  if (observacion !== undefined) lev.observacion = observacion;
  if (fecha !== undefined) lev.fecha = fecha ?? undefined;
  else if ((potencia_tx_dbm != null || potencia_rx_dbm != null) && !lev.fecha) lev.fecha = new Date();
  lev.registrado_por = req.user._id;

  await link.save(); // valida rangos de potencia

  const fmt = (n) => (Number.isFinite(n) ? `${n > 0 ? '+' : ''}${n} dBm` : '—');
  await Link.updateOne(
    { _id: link._id },
    pushTimeline({
      fecha: new Date(),
      operador: req.user._id,
      accion: `Levantamiento actualizado (${sentido})`,
      observacion: `Tx ${fmt(lev.potencia_tx_dbm)} · Rx ${fmt(lev.potencia_rx_dbm)}`,
      ticket: link.ticket_actual,
    }),
  );

  const populado = await recargar(link._id);
  emitirEnlace('link:updated', populado, { usuario: req.user, cambio: { campos: ['filamentos'] } });
  res.json({ ok: true, data: populado });
});

/**
 * Reemplaza el reparto del enlace por zonal: { longitud_km?, tramos: [{ zonal, km_desde, km_hasta }] }.
 * Los km se miden desde el nodo origen (km 0). Los tramos no pueden solaparse ni exceder la longitud;
 * pueden quedar huecos sin asignar. Una zonal desactivada solo se admite si el enlace ya la usaba.
 */
export const guardarTramos = asyncHandler(async (req, res) => {
  const link = await buscarEnlaceOr404(req.params.id);
  const { tramos } = req.body;
  const longitud = req.body.longitud_km === undefined ? link.longitud_km : req.body.longitud_km === null ? null : redondearKm(req.body.longitud_km);

  // Resolver las zonales (clave u ObjectId) en una sola consulta
  const refs = [...new Set(tramos.map((t) => t.zonal))];
  const encontradas = await Zonal.find({ $or: [{ _id: { $in: refs.filter(esObjectId) } }, { clave: { $in: refs.filter((r) => !esObjectId(r)).map((r) => r.toUpperCase()) } }] });
  const porRef = new Map(encontradas.flatMap((z) => [[String(z._id), z], [z.clave, z]]));
  const yaUsadas = new Set(link.tramos.map((t) => String(t.zonal)));

  const normalizados = tramos.map((t) => {
    const zonal = porRef.get(esObjectId(t.zonal) ? t.zonal : t.zonal.toUpperCase());
    if (!zonal) throw new AppError(404, `Zonal no encontrada: ${t.zonal}`);
    if (!zonal.activo && !yaUsadas.has(String(zonal._id))) throw new AppError(409, `La zonal "${zonal.nombre}" está desactivada`);
    return { zonal: zonal._id, km_desde: redondearKm(t.km_desde), km_hasta: redondearKm(t.km_hasta) };
  });

  const errores = validarTramos(normalizados, longitud);
  if (errores.length) throw new AppError(400, 'Tramos inválidos', errores.map((mensaje) => ({ campo: 'tramos', mensaje })));

  link.longitud_km = longitud;
  link.tramos = ordenarTramos(normalizados);
  await link.save();

  const resumen = longitud != null ? `${longitud} km` : 'sin longitud';
  await Link.updateOne(
    { _id: link._id },
    pushTimeline({
      fecha: new Date(),
      operador: req.user._id,
      accion: 'Tramos por zonal actualizados',
      observacion: `${normalizados.length} tramo(s) · ${resumen}`,
      ticket: link.ticket_actual,
    }),
  );

  const populado = await recargar(link._id);
  emitirEnlace('link:updated', populado, { usuario: req.user, cambio: { campos: ['tramos'] } });
  res.json({ ok: true, data: populado });
});

// ---------------------------------------------------------------- métricas
const periodo = ({ year, month }) => {
  const actual = anioMesEnZona(new Date(), env.appTimezone);
  return { year: year ?? actual.year, month: month ?? actual.month };
};

export const metricasGlobales = asyncHandler(async (req, res) => {
  const filas = await metricasMensuales({ ...periodo(req.query), incluirDegradado: req.query.incluirDegradado });
  const conTiempo = filas.filter((f) => f.total_minutos > 0);
  const uptimePromedio = conTiempo.length
    ? Math.round((conTiempo.reduce((a, f) => a + f.uptime_pct, 0) / conTiempo.length) * 1000) / 1000
    : null;
  // La ventana exacta (en la zona horaria de la operación) permite al frontend consultar incidencias del mismo período
  const { desde, hasta, corte } = rangoMes(periodo(req.query).year, periodo(req.query).month);
  res.json({ ok: true, data: filas, meta: { enlaces: filas.length, uptime_promedio_pct: uptimePromedio, desde, hasta, corte, zona_horaria: env.appTimezone } });
});

export const metricasEnlace = asyncHandler(async (req, res) => {
  const link = await buscarEnlaceOr404(req.params.id);
  const [fila] = await metricasMensuales({
    ...periodo(req.query),
    enlaceIds: [link._id],
    incluirDegradado: req.query.incluirDegradado,
  });
  res.json({ ok: true, data: fila });
});
