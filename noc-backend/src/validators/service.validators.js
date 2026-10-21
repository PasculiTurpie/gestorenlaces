import { z } from 'zod';
import { LIMITES } from '../utils/servicios.js';

const enlaceRef = z.string().trim().min(1).max(60); // ObjectId o id_enlace
const texto = (max) => z.string().trim().max(max);

const base = {
  nombre: texto(LIMITES.nombre).min(2, 'Nombre demasiado corto'),
  codigo: texto(LIMITES.codigo),
  cliente: texto(LIMITES.cliente),
  tipo: texto(LIMITES.tipo),
  capacidad: texto(LIMITES.capacidad),
  observacion: texto(LIMITES.observacion),
  enlaces: z.array(enlaceRef).max(LIMITES.enlaces, `Un servicio admite hasta ${LIMITES.enlaces} enlaces`),
};

export const createServiceSchema = z
  .object({ ...base, codigo: base.codigo.default(''), cliente: base.cliente.default(''), tipo: base.tipo.default(''), capacidad: base.capacidad.default(''), observacion: base.observacion.default(''), enlaces: base.enlaces.default([]) })
  .strict();

export const updateServiceSchema = z.object(base).partial().strict().refine((v) => Object.keys(v).length > 0, { message: 'Envíe al menos un campo' });

export const listServicesQuerySchema = z.object({
  q: z.string().trim().max(80).optional(),
  enlace: enlaceRef.optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(500).default(100),
});

const columna = z.coerce.number().int().min(0).max(39);
export const mapeoSchema = z
  .object({ servicio: columna, codigo: columna.optional(), cliente: columna.optional(), tipo: columna.optional(), capacidad: columna.optional(), observacion: columna.optional(), enlace: columna.optional(), origen: columna.optional(), destino: columna.optional() })
  .strict()
  .refine((m) => m.enlace !== undefined || (m.origen !== undefined && m.destino !== undefined), { message: 'Indique la columna del enlace, o las columnas de origen y destino' });

// Los campos de un formulario multipart llegan como texto
const json = z.string().transform((v, ctx) => { try { return JSON.parse(v); } catch { ctx.addIssue({ code: 'custom', message: 'El mapeo no es un JSON válido' }); return z.NEVER; } });
export const importServicesBodySchema = z.object({
  mapeo: json.pipe(mapeoSchema).optional(),
  modo: z.enum(['agregar', 'reemplazar']).default('agregar'),
  confirmar: z.enum(['true', 'false']).default('false').transform((v) => v === 'true'),
  hoja: z.string().trim().max(100).optional(),
  fila_encabezado: z.coerce.number().int().min(1).max(1000).optional(),
});
