import { z } from 'zod';

const color = z.string().trim().regex(/^#[0-9a-fA-F]{6}$/, 'Use el formato #RRGGBB');

export const createLinkTypeSchema = z
  .object({
    clave: z.string().trim().min(2).max(24),
    nombre: z.string().trim().min(2).max(60),
    color: color.optional(),
    descripcion: z.string().trim().max(300).optional(),
    activo: z.boolean().optional(),
  })
  .strict(); // "propio" no se puede fijar por API

// La clave es inmutable: los catálogos y reportes la usan como identificador estable.
export const updateLinkTypeSchema = z
  .object({
    nombre: z.string().trim().min(2).max(60).optional(),
    color: color.optional(),
    descripcion: z.string().trim().max(300).optional(),
    activo: z.boolean().optional(),
  })
  .strict()
  .refine((v) => Object.keys(v).length > 0, { message: 'Debe enviar al menos un campo a modificar' });
