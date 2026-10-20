import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import mongoose from 'mongoose';
import { env } from '../config/env.js';

/** Crea la carpeta si falta y comprueba que se puede ESCRIBIR, LEER y BORRAR en ella (lo mismo que hace una subida). */
export async function probarEscritura(dir = env.uploadsDir) {
  await fs.mkdir(dir, { recursive: true });
  const archivo = path.join(dir, `.prueba-${crypto.randomUUID()}.tmp`);
  await fs.writeFile(archivo, 'ok', { flag: 'wx' });
  try {
    if ((await fs.readFile(archivo, 'utf8')) !== 'ok') throw new Error('el contenido leído no coincide con lo escrito');
  } finally {
    await fs.rm(archivo, { force: true });
  }
}

/** Mensaje legible de un error de sistema de archivos (EACCES, ENOSPC...). */
export function describirErrorDisco(err) {
  const motivos = {
    EACCES: 'sin permisos de escritura',
    EPERM: 'operación no permitida (permisos o antivirus)',
    ENOENT: 'la ruta no existe',
    ENOTDIR: 'una parte de la ruta no es una carpeta',
    ENOSPC: 'no queda espacio en disco',
    EROFS: 'el disco es de solo lectura',
    EBUSY: 'el archivo o la carpeta está en uso',
    EMFILE: 'demasiados archivos abiertos',
  };
  return motivos[err?.code] ?? err?.message ?? 'error desconocido';
}

async function comprobar(nombre, fn) {
  try {
    const r = await fn();
    return { nombre, nivel: r?.nivel ?? 'ok', detalle: r?.detalle ?? r };
  } catch (err) {
    return { nombre, nivel: 'error', detalle: `${describirErrorDisco(err)}${err?.code ? ` (${err.code})` : ''}` };
  }
}

/** Estado de lo que el sistema necesita para funcionar. Lo consulta un Admin desde Administración → Sistema. */
export async function diagnostico() {
  const checks = [];

  checks.push(await comprobar('Base de datos', async () => {
    if (mongoose.connection.readyState !== 1) throw new Error(`la conexión no está activa (estado ${mongoose.connection.readyState})`);
    await mongoose.connection.db.admin().ping();
    return `Conectada a «${mongoose.connection.name}»`;
  }));

  checks.push(await comprobar('Carpeta de documentos', async () => {
    await probarEscritura(env.uploadsDir);
    return `${env.uploadsDir} · lectura y escritura correctas`;
  }));

  checks.push(await comprobar('Espacio libre en disco', async () => {
    const s = await fs.statfs(env.uploadsDir);
    const libreMb = Math.floor((s.bavail * s.bsize) / 1024 / 1024);
    const texto = libreMb >= 1024 ? `${(libreMb / 1024).toFixed(1)} GB libres` : `${libreMb} MB libres`;
    return { nivel: libreMb < 500 ? 'aviso' : 'ok', detalle: libreMb < 500 ? `${texto}: queda poco para nuevos documentos` : texto };
  }));

  checks.push({ nombre: 'Límite por documento', nivel: 'ok', detalle: `${env.maxUploadMb} MB (variable MAX_UPLOAD_MB)` });
  checks.push({ nombre: 'Entorno', nivel: 'ok', detalle: `Node ${process.version} · NODE_ENV=${env.nodeEnv} · zona horaria ${env.appTimezone}` });

  return { ok: checks.every((c) => c.nivel !== 'error'), generado: new Date().toISOString(), checks };
}

/** Al arrancar: deja en la consola del backend si la carpeta de documentos es utilizable. No impide que el servidor arranque. */
export async function verificarCarpetaDocumentos() {
  try {
    await probarEscritura(env.uploadsDir);
    console.log(`[docs] Carpeta de documentos lista: ${env.uploadsDir}`);
    return true;
  } catch (err) {
    console.error(`[docs] ⚠ NO se puede usar la carpeta de documentos (${env.uploadsDir}): ${describirErrorDisco(err)} [${err.code ?? 'sin código'}]. Las subidas fallarán hasta corregirlo.`);
    return false;
  }
}
