import { z } from 'zod';
import { ESTADOS_ENLACE } from '../models/Link.js';

const estado = z.enum(ESTADOS_ENLACE, { errorMap: () => ({ message: `Estado inválido. Valores: ${ESTADOS_ENLACE.join(', ')}` }) });
const nodoRef = z.string().trim().min(1, 'Requerido'); // ObjectId o id_nodo (ej. "VLDV")
const ticket = z.string().trim().max(60);
const tipoRef = z.string().trim().min(1).max(30);

export const createLinkSchema = z
  .object({
    id_enlace: z.string().trim().min(3).max(40),
    origen_nodo: nodoRef,
    destino_nodo: nodoRef,
    estado: estado.default('OK'),
    proveedor: z.string().trim().max(120).default(''),
    ticket_actual: ticket.default(''),
    tipo_enlace: tipoRef.optional(), // clave (ej. WOM) u ObjectId; por defecto, la red propia
  })
  .strict();

// El estado NO se cambia aquí: PATCH /:id/status es el único camino (auditoría + incidencias + tiempo real).
export const updateLinkSchema = z
  .object({
    origen_nodo: nodoRef.optional(),
    destino_nodo: nodoRef.optional(),
    proveedor: z.string().trim().max(120).optional(),
    ticket_actual: ticket.optional(),
    tipo_enlace: tipoRef.optional(),
  })
  .strict()
  .refine((v) => Object.keys(v).length > 0, { message: 'Debe enviar al menos un campo a modificar' });

export const statusSchema = z
  .object({
    estado,
    // Qué filamento(s) cambian de estado. Sin este campo, ambos (comportamiento anterior).
    filamentos: z
      .array(z.enum(['ida', 'vuelta'], { errorMap: () => ({ message: 'Cada filamento debe ser "ida" o "vuelta"' }) }))
      .min(1, 'Indique al menos un filamento')
      .max(2)
      .refine((v) => new Set(v).size === v.length, { message: 'Filamentos repetidos' })
      .optional(),
    tipificacion: z.string().trim().min(1).max(30).nullable().optional(), // código del tipo de alarma (ej. LOS) u ObjectId
    observacion: z.string().trim().max(2000).optional(),
    ticket: ticket.optional(),
    causa_raiz: z.string().trim().max(1000).optional(), // se registra al CERRAR una incidencia
  })
  .strict();

export const timelineEntrySchema = z
  .object({
    accion: z.string().trim().min(1, 'Requerido').max(200),
    observacion: z.string().trim().max(2000).default(''),
    ticket: ticket.default(''),
  })
  .strict();

export const listQuerySchema = z.object({
  estado: z
    .string()
    .optional()
    .transform((s) => (s ? s.split(',').map((x) => x.trim()) : undefined))
    .pipe(z.array(estado).optional()), // ?estado=Caido,Degradado
  proveedor: z.string().trim().max(120).optional(),
  nodo: z.string().trim().max(32).optional(), // id_nodo: enlaces que tocan ese nodo
  tipo: z.string().trim().max(24).optional(), // clave del tipo de línea (ej. WOM)
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(500).default(200),
});

export const metricsQuerySchema = z.object({
  year: z.coerce.number().int().min(2000).max(2100).optional(),
  month: z.coerce.number().int().min(1).max(12).optional(),
  incluirDegradado: z
    .enum(['true', 'false'])
    .optional()
    .transform((v) => v === 'true'),
});

export const deleteQuerySchema = z.object({
  force: z
    .enum(['true', 'false'])
    .optional()
    .transform((v) => v === 'true'),
});

export const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email(),
  password: z.string().min(1),
});

// ---------------------------------------------------------------- levantamiento de potencias por filamento
const potencia = z
  .number({ invalid_type_error: 'Debe ser un número' })
  .finite()
  .min(-60, 'Mínimo -60 dBm')
  .max(40, 'Máximo +40 dBm')
  .nullable(); // null = borrar el valor

export const sentidoSchema = z.enum(['ida', 'vuelta'], { errorMap: () => ({ message: 'El sentido debe ser "ida" o "vuelta"' }) });

export const levantamientoSchema = z
  .object({
    potencia_tx_dbm: potencia.optional(),
    potencia_rx_dbm: potencia.optional(),
    fecha: z.preprocess((v) => (v === '' ? null : v), z.coerce.date().nullable()).optional(),
    observacion: z.string().trim().max(500).optional(),
  })
  .strict()
  .refine((v) => Object.keys(v).length > 0, { message: 'Envíe al menos un parámetro del levantamiento' });

// ---------------------------------------------------------------- tramos por zonal
const km = z.number({ invalid_type_error: 'Debe ser un número' }).finite().min(0, 'No puede ser negativo').max(20000, 'Máximo 20.000 km');

// Reemplaza el reparto completo del enlace: es más simple y atómico que editar tramo por tramo.
export const tramosSchema = z
  .object({
    longitud_km: z.number().finite().positive('Debe ser mayor a 0').max(20000, 'Máximo 20.000 km').nullable().optional(), // null = sin longitud
    tramos: z
      .array(z.object({ zonal: z.string().trim().min(1).max(30), km_desde: km, km_hasta: km }).strict())
      .max(20, 'Máximo 20 tramos por enlace'),
  })
  .strict();
