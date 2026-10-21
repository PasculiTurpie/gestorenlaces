import multer from 'multer';
import { env } from '../config/env.js';

/**
 * Recibe UN archivo en el campo "archivo" (multipart/form-data), en memoria y con tope de tamaño.
 * La validación real (extensión + firma del contenido) la hace validarArchivo() en el servicio.
 */
export const subirArchivo = multer({
  storage: multer.memoryStorage(),
  defParamCharset: 'utf8', // sin esto los nombres con tildes o «ñ» llegan corruptos (se leen como latin1)
  limits: { fileSize: env.maxUploadMb * 1024 * 1024, files: 1, fields: 4, parts: 6 },
}).single('archivo');

/**
 * Importación de tablas (Excel/texto): un archivo en "archivo" y hasta 5 campos de formulario (mapeo, modo, confirmar...).
 * El tope de tamaño propio de las tablas (5 MB) lo valida validarArchivoTabla().
 */
export const subirTabla = multer({
  storage: multer.memoryStorage(),
  defParamCharset: 'utf8',
  limits: { fileSize: env.maxUploadMb * 1024 * 1024, files: 1, fields: 8, parts: 10 },
}).single('archivo');
