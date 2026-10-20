import crypto from 'node:crypto';
import { createReadStream } from 'node:fs';
import fs from 'node:fs/promises';
import path from 'node:path';
import mongoose from 'mongoose';
import { env } from '../config/env.js';
import { Adjunto } from '../models/Adjunto.js';
import { AppError } from '../utils/errors.js';
import { MAX_ADJUNTOS_POR_ALARMA, validarArchivo } from '../utils/archivos.js';
import { describirErrorDisco } from './sistema.service.js';

/** Ruta absoluta dentro de UPLOADS_DIR. Nunca se construye con texto del usuario, y se comprueba que no escape de la carpeta. */
export function rutaSegura(almacen, dir = env.uploadsDir) {
  const base = path.resolve(dir);
  const ruta = path.resolve(base, almacen);
  if (path.dirname(ruta) !== base) throw new Error('Ruta de almacenamiento inválida');
  return ruta;
}

/** Valida el archivo, lo guarda en disco con un nombre generado y registra sus metadatos. Si el registro falla, borra el archivo. */
export async function guardarAdjunto({ alarmaId, archivo, usuario, descripcion = '', dir = env.uploadsDir, maxBytes = env.maxUploadMb * 1024 * 1024 }) {
  const { extension, mime, nombre } = validarArchivo({ buffer: archivo.buffer, nombre: archivo.originalname, maxBytes });

  const existentes = await Adjunto.countDocuments({ alarma: alarmaId });
  if (existentes >= MAX_ADJUNTOS_POR_ALARMA) throw new AppError(409, `Una alarma admite hasta ${MAX_ADJUNTOS_POR_ALARMA} documentos. Elimine alguno para subir otro.`);

  const _id = new mongoose.Types.ObjectId();
  const almacen = `${_id}.${extension}`;
  const ruta = rutaSegura(almacen, dir);
  try {
    await fs.mkdir(dir, { recursive: true });
    await fs.writeFile(ruta, archivo.buffer, { flag: 'wx', mode: 0o640 });
  } catch (err) {
    // Problema del servidor (no del archivo): se explica y queda en el log; el detalle de la ruta está en Administración → Sistema
    console.error(`[docs] No se pudo escribir ${ruta}:`, err);
    const e = new AppError(500, `No se pudo guardar el archivo en el servidor: ${describirErrorDisco(err)}. Revise la carpeta de documentos en Administración → Sistema.`);
    e.code = err.code;
    throw e;
  }

  try {
    return await Adjunto.create({
      _id, alarma: alarmaId, nombre, extension, mime, almacen,
      tamano_bytes: archivo.buffer.length,
      sha256: crypto.createHash('sha256').update(archivo.buffer).digest('hex'),
      descripcion: String(descripcion ?? '').trim().slice(0, 200),
      subido_por: usuario?._id,
    });
  } catch (err) {
    await fs.rm(ruta, { force: true });
    throw err;
  }
}

export async function eliminarAdjunto(adjunto, dir = env.uploadsDir) {
  await adjunto.deleteOne();
  await fs.rm(rutaSegura(adjunto.almacen, dir), { force: true });
}

/** Stream de lectura; si el archivo ya no está en disco (volumen restaurado sin él) se explica claramente. */
export async function abrirAdjunto(adjunto, dir = env.uploadsDir) {
  const ruta = rutaSegura(adjunto.almacen, dir);
  try {
    await fs.access(ruta);
  } catch {
    throw new AppError(410, 'El archivo ya no está disponible en el servidor. Vuelva a subirlo.');
  }
  return createReadStream(ruta);
}

/** Forma pública de un adjunto (sin ruta interna ni huella). */
export const adjuntoPublico = (a) => ({
  _id: String(a._id),
  alarma: String(a.alarma),
  nombre: a.nombre,
  extension: a.extension,
  tamano_bytes: a.tamano_bytes,
  descripcion: a.descripcion ?? '',
  createdAt: a.createdAt,
  subido_por: a.subido_por?.nombre ? { nombre: a.subido_por.nombre } : null,
});
