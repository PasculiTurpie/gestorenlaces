import { z } from 'zod';
import { ROLES, TURNOS } from '../models/User.js';

const password = z.string().min(8, 'La contraseña debe tener al menos 8 caracteres').max(128);

export const createUserSchema = z
  .object({
    nombre: z.string().trim().min(2).max(120),
    email: z.string().trim().toLowerCase().email('Correo inválido'),
    password,
    rol: z.enum(ROLES).default('Operador'),
    turno: z.enum(TURNOS),
  })
  .strict();

export const updateUserSchema = z
  .object({
    nombre: z.string().trim().min(2).max(120).optional(),
    email: z.string().trim().toLowerCase().email('Correo inválido').optional(),
    rol: z.enum(ROLES).optional(),
    turno: z.enum(TURNOS).optional(),
    activo: z.boolean().optional(),
  })
  .strict()
  .refine((v) => Object.keys(v).length > 0, { message: 'Debe enviar al menos un campo a modificar' });

export const resetPasswordSchema = z.object({ password }).strict();
