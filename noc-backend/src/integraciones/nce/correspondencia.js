import fs from 'node:fs/promises';
import { z } from 'zod';
import { contiene, igual } from './util.js';

/**
 * Qué enlace (y qué filamento) corresponde a cada equipo/puerto de NCE. NCE habla de equipos y puertos; la app, de enlaces.
 * Una regla: { ne: "VLDV-DWDM-01", puerto: "Slot 3/Port 1", enlace: "ENL-VLDV-LANC-01", sentido: "ida" }.
 * `puerto` es opcional y se busca dentro de la ubicación de la alarma. `sentido` también (sin él, afecta al enlace).
 */
const regla = z.object({ ne: z.string().min(1), puerto: z.string().min(1).optional(), enlace: z.string().min(3), sentido: z.enum(['ida', 'vuelta']).optional() }).strict();

export function validarCorrespondencias(lista) {
  const r = z.array(regla).safeParse(lista);
  if (!r.success) throw new Error(`La tabla de correspondencias no es válida: ${r.error.issues.map((i) => `#${Number(i.path[0]) + 1} ${i.path.slice(1).join('.')}: ${i.message}`).join('; ')}`);
  return r.data;
}

export async function cargarCorrespondencias(archivo) {
  let t;
  try { t = await fs.readFile(archivo, 'utf8'); } catch (err) { if (err.code === 'ENOENT') return []; throw new Error(`No se pudo leer las correspondencias (${archivo}): ${err.code}`); }
  try { return validarCorrespondencias(JSON.parse(t)); } catch (err) { if (err instanceof SyntaxError) throw new Error(`Las correspondencias (${archivo}) no son un JSON válido: ${err.message}`); throw err; }
}

/**
 * Busca la regla que corresponde a una alarma: mismo equipo y, si la regla indica puerto, que la ubicación lo contenga.
 * Gana la más específica (con puerto). Devuelve { enlace, sentido } o null si no hay regla.
 */
export function asociar(alarma, reglas) {
  const delEquipo = reglas.filter((r) => igual(r.ne, alarma.equipo));
  const r = delEquipo.find((x) => x.puerto && contiene(alarma.ubicacion, x.puerto)) ?? delEquipo.find((x) => !x.puerto);
  return r ? { enlace: r.enlace.toUpperCase(), sentido: r.sentido ?? null } : null;
}
