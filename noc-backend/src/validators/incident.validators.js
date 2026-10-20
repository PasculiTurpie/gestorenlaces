import { z } from 'zod';
import { SEVERIDADES } from '../models/IncidenceLog.js';

const bool = z
  .enum(['true', 'false'])
  .optional()
  .transform((v) => (v === undefined ? undefined : v === 'true'));

export const listIncidentsQuerySchema = z.object({
  enlace: z.string().trim().min(1).max(40).optional(), // ObjectId o id_enlace
  severidad: z.enum(SEVERIDADES).optional(),
  abierta: bool,
  desde: z.coerce.date().optional(), // incidencias que se solapan con [desde, hasta]
  hasta: z.coerce.date().optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(200).default(50),
});

// Tras el cierre suele conocerse la causa raíz (post-mortem): se permite completarla/corregirla.
export const patchIncidentSchema = z
  .object({
    causa_raiz: z.string().trim().max(1000).optional(),
    ticket: z.string().trim().max(60).optional(),
  })
  .strict()
  .refine((v) => Object.keys(v).length > 0, { message: 'Envíe causa_raiz y/o ticket' });
