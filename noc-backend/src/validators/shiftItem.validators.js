import { z } from 'zod';

const titulo = z.string().trim().min(3, 'Título demasiado corto').max(120);
const ticket = z.string().trim().min(1, 'El número de ticket es obligatorio').max(60);
const descripcion = z.string().trim().min(3, 'Descripción demasiado corta').max(2000);

// Solo estos campos los entrega el cliente. Quién lo ingresa, cuándo y en qué turno los decide el servidor.
export const createItemSchema = z.object({ titulo, ticket, descripcion }).strict();
export const updateItemSchema = z.object({ titulo, ticket, descripcion }).partial().strict().refine((v) => Object.keys(v).length > 0, { message: 'Envíe al menos un campo' });
export const seguimientoSchema = z.object({ texto: z.string().trim().min(1, 'Escriba el seguimiento').max(1000) }).strict();
export const resolverSchema = z.object({ resolucion: z.string().trim().min(3, 'Indique cómo se resolvió').max(1000) }).strict();

export const listItemsQuerySchema = z.object({
  estado: z.enum(['Abierto', 'Resuelto', 'todos']).default('Abierto'),
  q: z.string().trim().max(80).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(200).default(100),
});
