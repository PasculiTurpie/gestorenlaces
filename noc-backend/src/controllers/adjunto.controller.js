import { AlarmType } from '../models/AlarmType.js';
import { Adjunto } from '../models/Adjunto.js';
import { abrirAdjunto, adjuntoPublico, eliminarAdjunto, guardarAdjunto } from '../services/adjuntos.service.js';
import { emitToNoc } from '../sockets/index.js';
import { contentDisposition } from '../utils/archivos.js';
import { AppError, asyncHandler } from '../utils/errors.js';
import { esObjectId } from '../utils/ids.js';

const avisar = (u) => emitToNoc('alarmtype:changed', { por: { id: u.id, nombre: u.nombre, rol: u.rol }, ts: new Date().toISOString() });

// POST /api/alarm-types/:id/adjuntos  (multipart, campo "archivo")
export const subir = asyncHandler(async (req, res) => {
  const alarma = await AlarmType.findOne(esObjectId(req.params.id) ? { _id: req.params.id } : { codigo: String(req.params.id).toUpperCase() });
  if (!alarma) throw new AppError(404, `Tipo de alarma no encontrado: ${req.params.id}`);
  if (!req.file) throw new AppError(400, 'Adjunte un archivo en el campo "archivo"');

  const adjunto = await guardarAdjunto({ alarmaId: alarma._id, archivo: req.file, usuario: req.user, descripcion: req.body?.descripcion });
  avisar(req.user);
  res.status(201).json({ ok: true, data: adjuntoPublico(adjunto) });
});

// GET /api/adjuntos/:id/archivo?disposicion=inline   (inline solo para PDF; el resto siempre se descarga)
export const descargar = asyncHandler(async (req, res) => {
  if (!esObjectId(req.params.id)) throw new AppError(400, 'Id de documento inválido');
  const adjunto = await Adjunto.findById(req.params.id);
  if (!adjunto) throw new AppError(404, 'Documento no encontrado');

  const stream = await abrirAdjunto(adjunto);
  const inline = req.query.disposicion === 'inline' && adjunto.extension === 'pdf';
  res.set({
    'Content-Type': adjunto.mime,
    'Content-Length': String(adjunto.tamano_bytes),
    'Content-Disposition': contentDisposition(adjunto.nombre, inline ? 'inline' : 'attachment'),
    'X-Content-Type-Options': 'nosniff',
    'Cache-Control': 'private, no-store',
  });
  stream.on('error', () => res.destroy());
  stream.pipe(res);
});

// DELETE /api/adjuntos/:id
export const eliminar = asyncHandler(async (req, res) => {
  if (!esObjectId(req.params.id)) throw new AppError(400, 'Id de documento inválido');
  const adjunto = await Adjunto.findById(req.params.id);
  if (!adjunto) throw new AppError(404, 'Documento no encontrado');
  await eliminarAdjunto(adjunto);
  avisar(req.user);
  res.json({ ok: true, data: { id: String(adjunto._id), nombre: adjunto.nombre } });
});
