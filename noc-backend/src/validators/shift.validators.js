import { z } from 'zod';
import { env } from '../config/env.js';
import { fechaLocal } from '../config/turnos.js';
import { TURNOS } from '../models/User.js';

const objectId = z.string().regex(/^[0-9a-fA-F]{24}$/, 'ObjectId inválido');
const bool = z
  .enum(['true', 'false'])
  .optional()
  .transform((v) => (v === undefined ? undefined : v === 'true'));

export const openShiftSchema = z
  .object({
    tipo_turno: z.enum(TURNOS).optional(), // por defecto, el turno asignado al usuario
    bitacora_general: z.string().trim().max(10_000).optional(),
  })
  .strict();

export const patchShiftSchema = z
  .object({ bitacora_general: z.string().trim().max(10_000) })
  .strict();

export const checklistItemSchema = z
  .object({
    gestionado: z.boolean().optional(),
    accion_tomada: z.string().trim().max(1000).optional(),
  })
  .strict()
  .refine((v) => Object.keys(v).length > 0, { message: 'Envíe gestionado y/o accion_tomada' });

export const closeShiftSchema = z
  .object({ bitacora_general: z.string().trim().max(10_000).optional() })
  .strict();

/**
 * Filtro por FECHA DE TURNO ("AAAA-MM-DD"). Acepta también una fecha-hora ISO (clientes anteriores) y la convierte al día local.
 */
const diaDeTurno = z.string().trim().transform((v, ctx) => {
  if (/^\d{4}-\d{2}-\d{2}$/.test(v)) {
    const d = new Date(`${v}T00:00:00Z`);
    if (!Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === v) return v; // fecha real (rechaza 2026-02-31 y 2026-13-01)
  } else if (!Number.isNaN(new Date(v).getTime())) {
    return fechaLocal(new Date(v), env.appTimezone);
  }
  ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Fecha inválida (use AAAA-MM-DD)' });
  return z.NEVER;
});

export const listShiftsQuerySchema = z.object({
  operador: objectId.optional(), // solo Supervisor/Admin; un Operador siempre ve únicamente lo suyo
  tipo_turno: z.enum(TURNOS).optional(),
  cerrado: bool,
  desde: diaDeTurno.optional(), // fecha del turno (el turno noche que empieza el 19 a las 23:00 es del 20)
  hasta: diaDeTurno.optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(25),
});

// GET /api/shifts/previous?antes=<fecha>: último turno CERRADO que terminó antes de esa fecha (por defecto, el más reciente)
export const previousQuerySchema = z.object({ antes: z.coerce.date().optional() });
