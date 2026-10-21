import { Link } from '../models/Link.js';
import { Service } from '../models/Service.js';
import { aplicarPlan, cargarCatalogoEnlaces, cargarExistentes, resolverEnlacesEnOrden } from '../services/servicios.service.js';
import { emitToNoc } from '../sockets/index.js';
import { usuarioResumen } from '../sockets/linkEvents.js';
import { AppError, asyncHandler } from '../utils/errors.js';
import { esObjectId } from '../utils/ids.js';
import { claveServicio, indexarEnlaces, planificarImportacion } from '../utils/servicios.js';
import { detectarEncabezado, leerTabla, sugerirMapeo } from '../utils/tabla.js';
import { normalizar } from '../utils/texto.js';

const POPULATE = { path: 'enlaces', select: 'id_enlace' };
const escapar = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const avisar = (accion, usuario, extra = {}) => emitToNoc('services:changed', { accion, por: usuarioResumen(usuario), ts: new Date().toISOString(), ...extra });

async function buscar(id) {
  if (!esObjectId(id)) throw new AppError(400, 'Id de servicio inválido');
  const s = await Service.findById(id);
  if (!s) throw new AppError(404, 'Servicio no encontrado');
  return s;
}

// GET /api/services?q=&enlace=   (para un enlace: los servicios que pasan por él)
export const listar = asyncHandler(async (req, res) => {
  const { q, enlace, page, limit } = req.query;
  const filtro = {};
  if (enlace) {
    const l = await Link.findOne(esObjectId(enlace) ? { _id: enlace } : { id_enlace: String(enlace).toUpperCase() }).select('_id');
    if (!l) return res.json({ ok: true, data: [], meta: { total: 0, page, limit, paginas: 0 } });
    filtro.enlaces = l._id;
  }
  if (q) {
    const rx = { $regex: escapar(q), $options: 'i' };
    filtro.$or = [{ clave: { $regex: escapar(normalizar(q)) } }, { cliente: rx }, { codigo: rx }, { tipo: rx }];
  }
  const [datos, total] = await Promise.all([
    Service.find(filtro).collation({ locale: 'es' }).sort({ nombre: 1 }).skip((page - 1) * limit).limit(limit).populate(POPULATE).lean(),
    Service.countDocuments(filtro),
  ]);
  res.json({ ok: true, data: datos, meta: { total, page, limit, paginas: Math.ceil(total / limit) } });
});

// GET /api/services/resumen → cuántos servicios pasan por cada enlace (para marcarlo en el mapa y en las alarmas)
export const resumen = asyncHandler(async (_req, res) => {
  const [filas, total] = await Promise.all([
    Service.aggregate([{ $unwind: '$enlaces' }, { $group: { _id: '$enlaces', n: { $sum: 1 } } }]),
    Service.countDocuments(),
  ]);
  res.json({ ok: true, data: { servicios: total, por_enlace: Object.fromEntries(filas.map((f) => [String(f._id), f.n])) } });
});

export const detalle = asyncHandler(async (req, res) => {
  const s = await buscar(req.params.id);
  res.json({ ok: true, data: await Service.findById(s._id).populate(POPULATE).lean() });
});

async function duplicadoComoConflicto(promesa) {
  try { return await promesa; } catch (err) {
    if (err.code === 11000) throw new AppError(409, 'Ya existe un servicio con ese nombre');
    throw err;
  }
}

export const crear = asyncHandler(async (req, res) => {
  const { enlaces, ...datos } = req.body;
  const s = await duplicadoComoConflicto(Service.create({ ...datos, enlaces: await resolverEnlacesEnOrden(enlaces), actualizado_por: req.user._id }));
  avisar('creado', req.user, { nombre: s.nombre });
  res.status(201).json({ ok: true, data: await Service.findById(s._id).populate(POPULATE).lean() });
});

export const actualizar = asyncHandler(async (req, res) => {
  const s = await buscar(req.params.id);
  const { enlaces, ...datos } = req.body;
  if (enlaces) s.enlaces = await resolverEnlacesEnOrden(enlaces);
  Object.assign(s, datos, { actualizado_por: req.user._id });
  await duplicadoComoConflicto(s.save());
  avisar('editado', req.user, { nombre: s.nombre });
  res.json({ ok: true, data: await Service.findById(s._id).populate(POPULATE).lean() });
});

export const eliminar = asyncHandler(async (req, res) => {
  const s = await buscar(req.params.id);
  await s.deleteOne();
  avisar('eliminado', req.user, { nombre: s.nombre });
  res.json({ ok: true, data: { id: String(s._id), nombre: s.nombre } });
});

/**
 * POST /api/services/import   (multipart: archivo + mapeo? + modo + confirmar + hoja? + fila_encabezado?)
 * Tres fases con el MISMO archivo (el navegador lo vuelve a enviar):
 *   1. sin `mapeo`            → fase "columnas": hojas, columnas con una muestra y el mapeo sugerido;
 *   2. con `mapeo`            → fase "vista_previa": qué pasaría y qué filas tienen problemas (no se guarda nada);
 *   3. con `confirmar=true`   → fase "aplicado": se guardan los servicios; las filas con problemas se omiten y se informan.
 */
export const importar = asyncHandler(async (req, res) => {
  if (!req.file) throw new AppError(400, 'Adjunte un archivo en el campo "archivo"');
  const { mapeo, modo, confirmar, hoja, fila_encabezado: filaEnc } = req.body;
  const tabla = await leerTabla({ buffer: req.file.buffer, nombre: req.file.originalname, hoja });
  const filaEncabezado = filaEnc !== undefined ? Math.min(filaEnc - 1, tabla.filas.length - 1) : detectarEncabezado(tabla.filas);
  const encabezados = tabla.filas[filaEncabezado];
  const base = { formato: tabla.formato, hojas: tabla.hojas, hoja: tabla.hoja, delimitador: tabla.delimitador, fila_encabezado: filaEncabezado + 1 };

  if (!mapeo) {
    const datos = tabla.filas.slice(filaEncabezado + 1);
    return res.json({
      ok: true, fase: 'columnas', ...base, filas_datos: datos.filter((f) => f.some((x) => x !== '')).length,
      muestra_filas: datos.filter((f) => f.some((x) => x !== '')).slice(0, 4), // las primeras filas, tal cual, para reconocer el archivo
      columnas: encabezados.map((nombre, indice) => ({ indice, nombre, muestra: datos.map((f) => f[indice]).filter(Boolean).slice(0, 3) })),
      sugerido: sugerirMapeo(encabezados),
    });
  }

  const fuera = Object.entries(mapeo).find(([, i]) => i >= encabezados.length);
  if (fuera) throw new AppError(400, `La columna ${fuera[1] + 1} («${fuera[0]}») no existe en el archivo`);

  const catalogo = await cargarCatalogoEnlaces();
  const claves = [...new Set(tabla.filas.slice(filaEncabezado + 1).map((f) => claveServicio(f[mapeo.servicio])).filter(Boolean))];
  const plan = planificarImportacion({ filas: tabla.filas, filaEncabezado, mapeo, indice: indexarEnlaces(catalogo), existentes: await cargarExistentes(claves), modo });
  const codigoDe = new Map(catalogo.map((l) => [l._id, l.id_enlace]));
  const salida = {
    ...base, modo, resumen: plan.resumen,
    problemas: plan.problemas.slice(0, 200), problemas_total: plan.problemas.length,
    advertencias: plan.advertencias.slice(0, 100), advertencias_total: plan.advertencias.length,
    ejemplo: plan.servicios.slice(0, 12).map((s) => ({ nombre: s.nombre, accion: s.accion, enlaces: s.enlaces_finales.slice(0, 6).map((id) => codigoDe.get(id) ?? id), enlaces_total: s.enlaces_finales.length, agregados: s.agregados, quitados: s.quitados, cambios_campos: s.cambios_campos })),
  };
  if (!confirmar) return res.json({ ok: true, fase: 'vista_previa', ...salida });

  if (!plan.servicios.length) throw new AppError(400, 'No hay servicios para importar: revise la columna del servicio');
  const aplicado = await aplicarPlan(plan, req.user);
  avisar('importado', req.user, { creados: aplicado.creados, actualizados: aplicado.actualizados });
  res.json({ ok: true, fase: 'aplicado', ...salida, aplicado });
});
