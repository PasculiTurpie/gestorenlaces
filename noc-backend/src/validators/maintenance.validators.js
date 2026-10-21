import { z } from 'zod';
import { ESTADOS_MANTENIMIENTO } from '../models/Maintenance.js';

const fecha = z.coerce.date({ errorMap: () => ({ message: 'Fecha inválida' }) });
const enlaceRef = z.string().trim().min(1).max(60); // ObjectId o id_enlace
const objectId = z.string().regex(/^[a-f\d]{24}$/i, 'Id inválido');

const base = {
  titulo: z.string().trim().min(3, 'Título demasiado corto').max(120),
  descripcion: z.string().trim().max(2000),
  enlaces: z.array(enlaceRef).min(1, 'Seleccione al menos un enlace').max(50, 'Máximo 50 enlaces'),
  tipificacion: z.string().trim().min(1).max(30), // código (ej. MANT_PROG) u ObjectId
  ticket: z.string().trim().max(60),
  inicio: fecha,
  fin: fecha,
  con_corte: z.boolean(),
};

export const createMaintenanceSchema = z
  .object({ ...base, descripcion: base.descripcion.default(''), ticket: base.ticket.default(''), con_corte: base.con_corte.default(false) })
  .strict()
  .refine((v) => v.fin > v.inicio, { message: 'El fin debe ser posterior al inicio', path: ['fin'] });

// Qué campos se pueden cambiar según el estado lo decide el servicio (un mantenimiento en curso no cambia de enlaces ni de inicio)
export const updateMaintenanceSchema = z
  .object({ titulo: base.titulo, descripcion: base.descripcion, enlaces: base.enlaces, tipificacion: base.tipificacion, ticket: base.ticket, inicio: base.inicio, fin: base.fin, con_corte: base.con_corte })
  .partial()
  .strict()
  .refine((v) => Object.keys(v).length > 0, { message: 'Envíe al menos un campo' });

export const accionMaintenanceSchema = z.object({ observacion: z.string().trim().max(500).optional() }).strict();
export const cancelMaintenanceSchema = z.object({ motivo: z.string().trim().min(3, 'Indique el motivo').max(500) }).strict();

const estados = z
  .string()
  .transform((v) => v.split(',').map((x) => x.trim()).filter(Boolean))
  .pipe(z.array(z.enum(ESTADOS_MANTENIMIENTO)).min(1));

export const listMaintenanceQuerySchema = z.object({
  estado: estados.optional(), // lista separada por comas; por defecto, los activos (Programado y En curso)
  enlace: enlaceRef.optional(),
  desde: fecha.optional(), // la ventana del mantenimiento se solapa con [desde, hasta]
  hasta: fecha.optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(200).default(100),
});

export const maintenanceIdParam = z.object({ id: objectId });
