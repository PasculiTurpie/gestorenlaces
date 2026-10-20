import { z } from 'zod';

const estado = z.enum(['Caido', 'Degradado', 'Mantenimiento'], { errorMap: () => ({ message: 'Estado inválido. Valores: Caido, Degradado, Mantenimiento' }) });
const paso = z.string().trim().min(1, 'Un paso no puede estar vacío').max(600, 'Un paso admite hasta 600 caracteres');
const tiempo = z.number().int('Debe ser un número entero de minutos').min(1, 'Al menos 1 minuto').max(10080, 'Máximo 7 días').nullable();

export const createAlarmTypeSchema = z
  .object({
    codigo: z.string().trim().min(2).max(24),
    nombre: z.string().trim().min(2).max(80),
    estado_sugerido: estado.optional(),
    significado: z.string().trim().max(2000).optional(),
    procedimiento: z.array(paso).max(20, 'Máximo 20 pasos').optional(),
    escalamiento: z.string().trim().max(600).optional(),
    tiempo_respuesta_min: tiempo.optional(),
    activo: z.boolean().optional(),
  })
  .strict();

// El código es inmutable: las incidencias y los reportes lo usan como identificador estable.
export const updateAlarmTypeSchema = z
  .object({
    nombre: z.string().trim().min(2).max(80).optional(),
    estado_sugerido: estado.optional(),
    significado: z.string().trim().max(2000).optional(),
    procedimiento: z.array(paso).max(20, 'Máximo 20 pasos').optional(),
    escalamiento: z.string().trim().max(600).optional(),
    tiempo_respuesta_min: tiempo.optional(),
    activo: z.boolean().optional(),
  })
  .strict()
  .refine((v) => Object.keys(v).length > 0, { message: 'Debe enviar al menos un campo a modificar' });
