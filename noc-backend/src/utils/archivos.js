import path from 'node:path';
import { AppError } from './errors.js';

/** Únicos formatos admitidos para los documentos de procedimiento. */
export const TIPOS_ARCHIVO = {
  pdf: { mime: 'application/pdf', etiqueta: 'PDF' },
  docx: { mime: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', etiqueta: 'Word' },
  xlsx: { mime: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', etiqueta: 'Excel' },
};
export const MAX_ADJUNTOS_POR_ALARMA = 10;

export const extensionDe = (nombre) => path.extname(String(nombre ?? '')).slice(1).toLowerCase();

/** Nombre apto para mostrar y para cabeceras HTTP: sin rutas, sin caracteres de control ni saltos de línea. */
export function nombreLimpio(nombre) {
  const base = String(nombre ?? '').split(/[\\/]/).pop();
  return base.replace(/[\u0000-\u001f\u007f]/g, '').replace(/\s+/g, ' ').trim().slice(0, 200);
}

const tiene = (buf, texto) => buf.includes(Buffer.from(texto, 'latin1'));

/**
 * Valida un archivo subido por su NOMBRE y por su CONTENIDO (no basta con la extensión: un .exe renombrado a .pdf
 * debe rechazarse). No ejecuta ni descomprime nada: solo inspecciona firmas.
 *  - pdf:  cabecera %PDF- al comienzo.
 *  - docx/xlsx: contenedor ZIP (PK\x03\x04) con las partes propias de Word/Excel.
 *  - se rechazan los documentos con macros (vbaProject.bin).
 * Devuelve { extension, mime, nombre } o lanza AppError (413/415/400).
 */
export function validarArchivo({ buffer, nombre, maxBytes }) {
  const limpio = nombreLimpio(nombre);
  if (!limpio) throw new AppError(400, 'El archivo no tiene nombre');

  const extension = extensionDe(limpio);
  if (!TIPOS_ARCHIVO[extension]) throw new AppError(415, 'Solo se admiten archivos .docx, .pdf y .xlsx');

  if (!buffer?.length) throw new AppError(400, 'El archivo está vacío');
  if (maxBytes && buffer.length > maxBytes) throw new AppError(413, `El archivo supera el tamaño máximo de ${Math.round(maxBytes / 1024 / 1024)} MB`);

  const incorrecto = () => new AppError(415, `El contenido no corresponde a un archivo .${extension} válido`);
  if (extension === 'pdf') {
    if (!buffer.subarray(0, 1024).includes(Buffer.from('%PDF-', 'latin1'))) throw incorrecto();
  } else {
    if (buffer.length < 4 || buffer[0] !== 0x50 || buffer[1] !== 0x4b || buffer[2] !== 0x03 || buffer[3] !== 0x04) throw incorrecto();
    const parte = extension === 'docx' ? 'word/document.xml' : 'xl/workbook.xml';
    if (!tiene(buffer, '[Content_Types].xml') || !tiene(buffer, parte)) throw incorrecto();
    if (tiene(buffer, 'vbaProject.bin')) throw new AppError(415, 'No se admiten documentos con macros');
  }
  return { extension, mime: TIPOS_ARCHIVO[extension].mime, nombre: limpio };
}

/** Content-Disposition seguro (con nombre ASCII de respaldo y filename* UTF-8 para tildes y ñ). */
export function contentDisposition(nombre, tipo = 'attachment') {
  const ascii = nombreLimpio(nombre).replace(/[^\x20-\x7e]/g, '_').replace(/["\\]/g, '_');
  const utf8 = encodeURIComponent(nombreLimpio(nombre)).replace(/['()*]/g, (c) => `%${c.charCodeAt(0).toString(16).toUpperCase()}`);
  return `${tipo}; filename="${ascii}"; filename*=UTF-8''${utf8}`;
}
