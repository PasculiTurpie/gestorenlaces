import mongoose from 'mongoose';
import { ZodError } from 'zod';
import { env } from '../config/env.js';
import { AppError } from '../utils/errors.js';

export function notFound(req, _res, next) {
  next(new AppError(404, `Ruta no encontrada: ${req.method} ${req.originalUrl}`));
}

// eslint-disable-next-line no-unused-vars
export function errorHandler(err, req, res, _next) {
  let status = err.status ?? err.statusCode ?? 500;
  let message = err.message;
  let details = err.details;

  if (err instanceof ZodError) {
    status = 400;
    message = 'Datos inválidos';
    details = err.issues.map((i) => ({ campo: i.path.join('.'), mensaje: i.message }));
  } else if (err instanceof mongoose.Error.ValidationError) {
    status = 400;
    message = 'Error de validación';
    details = Object.values(err.errors).map((e) => ({ campo: e.path, mensaje: e.message }));
  } else if (err instanceof mongoose.Error.CastError) {
    status = 400;
    message = `Valor inválido para "${err.path}"`;
  } else if (err.name === 'MulterError') {
    // errores de la subida de archivos (tamaño, campo inesperado...)
    status = err.code === 'LIMIT_FILE_SIZE' ? 413 : 400;
    message = err.code === 'LIMIT_FILE_SIZE'
      ? `El archivo supera el tamaño máximo de ${env.maxUploadMb} MB`
      : err.code === 'LIMIT_UNEXPECTED_FILE' ? 'Adjunte un solo archivo en el campo "archivo"' : 'No se pudo procesar el archivo enviado';
  } else if (err instanceof mongoose.Error.VersionError) {
    status = 409;
    message = 'El documento fue modificado por otro usuario. Recarga e inténtalo de nuevo.';
  } else if (err.code === 11000) {
    status = 409;
    message = `Valor duplicado en: ${Object.keys(err.keyPattern ?? {}).join(', ') || 'campo único'}`;
  } else if (err.name === 'JsonWebTokenError' || err.name === 'TokenExpiredError') {
    status = 401;
    message = 'Token inválido o expirado';
  }

  let ref;
  let codigo;
  if (status >= 500) {
    // Referencia corta para localizar este error en la consola/logs del backend
    ref = Math.random().toString(36).slice(2, 8).toUpperCase();
    codigo = err.code && typeof err.code === 'string' ? err.code : undefined;
    console.error(`[error ${ref}] ${req.method} ${req.originalUrl}`, err);
    if (env.nodeEnv === 'production') message = 'Error interno del servidor';
  }

  res.status(status).json({ ok: false, error: { message, details, ...(ref && { ref }), ...(codigo && { codigo }) } });
}
