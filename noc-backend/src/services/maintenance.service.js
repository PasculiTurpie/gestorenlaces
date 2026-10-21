import { Link } from '../models/Link.js';
import { AlarmType } from '../models/AlarmType.js';
import { Maintenance } from '../models/Maintenance.js';
import { emitirEnlace } from '../sockets/linkEvents.js';
import { AppError } from '../utils/errors.js';
import { esObjectId } from '../utils/ids.js';
import { materializarFilamentos } from '../utils/filamentos.js';
import { cambiarEstado } from './link.service.js';

const sinDuplicados = (lista) => [...new Set(lista.map(String))];

/** Resuelve referencias (ObjectId o id_enlace) a enlaces existentes. Falla si alguna no existe. */
export async function resolverEnlaces(refs) {
  const unicos = sinDuplicados(refs);
  const ids = unicos.filter(esObjectId);
  const codigos = unicos.filter((r) => !esObjectId(r));
  const encontrados = await Link.find({ $or: [{ _id: { $in: ids } }, { id_enlace: { $in: codigos } }] }).select('_id id_enlace');
  const conocidos = new Set(encontrados.flatMap((l) => [String(l._id), l.id_enlace]));
  const faltan = unicos.filter((r) => !conocidos.has(r));
  if (faltan.length) throw new AppError(404, `Enlace(s) no encontrado(s): ${faltan.join(', ')}`);
  return encontrados.map((l) => l._id);
}

/** La tipificación debe existir, estar activa y ser de mantenimiento (el catálogo la marca con estado sugerido "Mantenimiento"). */
export async function resolverTipificacionMantenimiento(ref) {
  const tipo = await AlarmType.findOne(esObjectId(ref) ? { _id: ref } : { codigo: String(ref).toUpperCase() });
  if (!tipo) throw new AppError(404, `Tipificación no encontrada: ${ref}`);
  if (!tipo.activo) throw new AppError(409, `La tipificación "${tipo.nombre}" está desactivada`);
  if (tipo.estado_sugerido !== 'Mantenimiento') throw new AppError(400, `"${tipo.nombre}" no es una tipificación de mantenimiento`);
  return tipo;
}

const ahoraOr = (ahora) => ahora ?? new Date();
const anotar = (m, usuario, accion, observacion = '') => m.historial.push({ fecha: new Date(), usuario: usuario._id, accion, observacion });

/** Crea el mantenimiento programado. No modifica ningún enlace: solo anuncia el trabajo. */
export async function crearMantenimiento({ datos, usuario, ahora }) {
  if (datos.fin <= ahoraOr(ahora)) throw new AppError(400, 'El fin del mantenimiento ya pasó: indique una ventana futura o vigente');
  const [enlaces, tipo] = await Promise.all([resolverEnlaces(datos.enlaces), resolverTipificacionMantenimiento(datos.tipificacion)]);
  const m = new Maintenance({ ...datos, enlaces, tipificacion: tipo._id, creado_por: usuario._id });
  anotar(m, usuario, 'Mantenimiento programado');
  await m.save();
  return m;
}

/** Edita un mantenimiento no cerrado. En curso: no se cambian los enlaces, la tipificación ni el inicio (ya se aplicaron). */
export async function actualizarMantenimiento({ m, cambios, usuario, ahora }) {
  if (!['Programado', 'En curso'].includes(m.estado)) throw new AppError(409, `Un mantenimiento ${m.estado.toLowerCase()} no se puede editar`);
  if (m.estado === 'En curso') {
    const bloqueados = ['enlaces', 'tipificacion', 'inicio'].filter((c) => cambios[c] !== undefined);
    if (bloqueados.length) throw new AppError(409, `Con el mantenimiento en curso no se puede cambiar: ${bloqueados.join(', ')}`);
  }
  const { enlaces, tipificacion, ...simples } = cambios;
  if (enlaces) m.enlaces = await resolverEnlaces(enlaces);
  if (tipificacion) m.tipificacion = (await resolverTipificacionMantenimiento(tipificacion))._id;
  Object.assign(m, simples);
  if (m.fin <= m.inicio) throw new AppError(400, 'El fin debe ser posterior al inicio');
  if (cambios.fin !== undefined && m.fin <= ahoraOr(ahora)) throw new AppError(400, 'El fin del mantenimiento ya pasó');
  anotar(m, usuario, `Editado (${Object.keys(cambios).join(', ')})`);
  await m.save();
  return m;
}

/**
 * Inicia el trabajo: los enlaces pasan a "Mantenimiento" (con la tipificación y el ticket del mantenimiento).
 * - Se "reclama" el mantenimiento de forma atómica para que dos clics seguidos no lo apliquen dos veces.
 * - Si algún enlace no pudo cambiar (alguien lo modificó a la vez), el resto sí se aplica y se informa cuáles fallaron.
 * - Si ninguno pudo cambiar, el mantenimiento vuelve a "Programado".
 */
export async function iniciarMantenimiento({ id, usuario, observacion = '', ahora }) {
  const ts = ahoraOr(ahora);
  const m = await Maintenance.findOneAndUpdate({ _id: id, estado: 'Programado' }, { $set: { estado: 'En curso', inicio_real: ts } }, { new: true });
  if (!m) throw new AppError(409, 'Solo se puede iniciar un mantenimiento en estado Programado');
  const tipo = await AlarmType.findById(m.tipificacion);
  const resultado = { aplicados: [], ya_en_mantenimiento: [], fallidos: [] };

  for (const enlaceId of m.enlaces) {
    const link = await Link.findById(enlaceId);
    if (!link) { resultado.fallidos.push({ enlace: String(enlaceId), motivo: 'el enlace ya no existe' }); continue; }
    if (materializarFilamentos(link).every((f) => f.estado === 'Mantenimiento')) { resultado.ya_en_mantenimiento.push(link.id_enlace); continue; }
    try {
      const r = await cambiarEstado({ link, nuevoEstado: 'Mantenimiento', tipificacion: tipo, usuario, observacion: `Mantenimiento: ${m.titulo}`.slice(0, 500), ticket: m.ticket || undefined });
      emitirEnlace('link:updated', r.link, { usuario, cambio: { de: r.de, a: r.a, filamentos: r.filamentos, fibraDe: r.fibraDe, fibraA: r.fibraA, tipificacion: tipo?.codigo ?? null } });
      resultado.aplicados.push(link.id_enlace);
    } catch (err) {
      resultado.fallidos.push({ enlace: link.id_enlace, motivo: err.message });
    }
  }

  if (resultado.aplicados.length + resultado.ya_en_mantenimiento.length === 0) {
    await Maintenance.updateOne({ _id: m._id }, { $set: { estado: 'Programado' }, $unset: { inicio_real: 1 } });
    throw new AppError(409, `No se pudo iniciar: ${resultado.fallidos.map((f) => `${f.enlace} (${f.motivo})`).join('; ')}`);
  }
  anotar(m, usuario, `Iniciado (${resultado.aplicados.length} enlace(s) a Mantenimiento${resultado.fallidos.length ? `, ${resultado.fallidos.length} con error` : ''})`, observacion);
  await m.save();
  return { m, resultado };
}

/**
 * Finaliza el trabajo: los filamentos que siguen en "Mantenimiento" vuelven a OK. Los que ya no estaban en mantenimiento
 * (alguien los cambió) se respetan y se informan. Si algún enlace no pudo actualizarse, el mantenimiento sigue "En curso"
 * para poder reintentar (los ya restablecidos se omiten).
 */
export async function finalizarMantenimiento({ id, usuario, observacion = '', ahora }) {
  const ts = ahoraOr(ahora);
  const m = await Maintenance.findOneAndUpdate({ _id: id, estado: 'En curso' }, { $set: { estado: 'Finalizado', fin_real: ts } }, { new: true });
  if (!m) throw new AppError(409, 'Solo se puede finalizar un mantenimiento En curso');
  const resultado = { restablecidos: [], omitidos: [], fallidos: [] };

  for (const enlaceId of m.enlaces) {
    const link = await Link.findById(enlaceId);
    if (!link) { resultado.omitidos.push({ enlace: String(enlaceId), motivo: 'el enlace ya no existe' }); continue; }
    const enMant = materializarFilamentos(link).filter((f) => f.estado === 'Mantenimiento').map((f) => f.sentido);
    if (!enMant.length) { resultado.omitidos.push({ enlace: link.id_enlace, motivo: 'ya no estaba en mantenimiento' }); continue; }
    try {
      const r = await cambiarEstado({ link, nuevoEstado: 'OK', filamentos: enMant, usuario, observacion: `Fin de mantenimiento: ${m.titulo}`.slice(0, 500) });
      emitirEnlace('link:updated', r.link, { usuario, cambio: { de: r.de, a: r.a, filamentos: r.filamentos, fibraDe: r.fibraDe, fibraA: r.fibraA, tipificacion: null } });
      resultado.restablecidos.push(link.id_enlace);
    } catch (err) {
      resultado.fallidos.push({ enlace: link.id_enlace, motivo: err.message });
    }
  }

  if (resultado.fallidos.length) {
    await Maintenance.updateOne({ _id: m._id }, { $set: { estado: 'En curso' }, $unset: { fin_real: 1 } });
    m.estado = 'En curso';
    m.fin_real = undefined;
    return { m, resultado, completo: false };
  }
  anotar(m, usuario, `Finalizado (${resultado.restablecidos.length} enlace(s) restablecidos a OK)`, observacion);
  await m.save();
  return { m, resultado, completo: true };
}

/** Cancela un mantenimiento aún no iniciado. Uno en curso se finaliza (hay enlaces en mantenimiento que restablecer). */
export async function cancelarMantenimiento({ id, usuario, motivo, ahora }) {
  const m = await Maintenance.findOneAndUpdate({ _id: id, estado: 'Programado' }, { $set: { estado: 'Cancelado', motivo_cancelacion: motivo } }, { new: true });
  if (!m) throw new AppError(409, 'Solo se puede cancelar un mantenimiento Programado. Si ya está en curso, finalícelo.');
  anotar(m, usuario, 'Cancelado', motivo);
  await m.save();
  return m;
}
