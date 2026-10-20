import { z } from 'zod';
import { TIPOS_NODO } from '../models/Node.js';

const coord = z.number({ invalid_type_error: 'Debe ser numérico' }).finite().min(-1e6).max(1e6);
const tipo = z.string().trim().toUpperCase().pipe(z.enum(TIPOS_NODO, { errorMap: () => ({ message: `Tipo inválido. Valores: ${TIPOS_NODO.join(', ')}` }) }));

export const createNodeSchema = z
  .object({
    id_nodo: z.string().trim().min(2).max(32),
    nombre: z.string().trim().min(1).max(120),
    tipo,
    posicion: z.object({ x: coord, y: coord }).strict().optional(),
  })
  .strict();

// id_nodo es inmutable: los enlaces y el histórico lo referencian de forma lógica.
export const updateNodeSchema = z
  .object({
    nombre: z.string().trim().min(1).max(120).optional(),
    tipo: tipo.optional(),
    posicion: z.object({ x: coord, y: coord }).strict().optional(),
  })
  .strict()
  .refine((v) => Object.keys(v).length > 0, { message: 'Debe enviar al menos un campo a modificar' });

export const positionSchema = z.object({ x: coord, y: coord }).strict();

export const bulkPositionsSchema = z
  .object({
    nodos: z.array(z.object({ id: z.string().trim().min(1), x: coord, y: coord }).strict()).min(1).max(500),
  })
  .strict();
