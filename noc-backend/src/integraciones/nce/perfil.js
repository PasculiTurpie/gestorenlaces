import fs from 'node:fs/promises';
import { z } from 'zod';

/**
 * PERFIL de conexión: describe CÓMO habla la API de NCE (rutas, autenticación, nombres de campos) sin tocar el código.
 * Cada versión de NCE puede variar: se ajusta este archivo según la guía de la interfaz de su versión.
 */
const ruta = z.string().startsWith('/', 'La ruta debe empezar con /');
const params = z.record(z.union([z.string(), z.number(), z.boolean()]));

const autenticacion = z.discriminatedUnion('tipo', [
  z.object({
    tipo: z.literal('token'), // se pide un token con usuario y clave y se envía en una cabecera
    metodo: z.enum(['POST', 'PUT']).default('POST'),
    ruta,
    formato: z.enum(['json', 'form']).default('json'),
    cuerpo: z.record(z.any()).default({ usuario: '{usuario}', clave: '{clave}' }), // {usuario} y {clave} se sustituyen
    token_en_respuesta: z.string().min(1),
    expira_en_respuesta: z.string().optional(), // segundos de vida del token
    expira_seg_por_defecto: z.number().int().min(30).default(1800),
    cabecera: z.string().min(1).default('Authorization'),
    prefijo: z.string().default('Bearer '),
  }).strict(),
  z.object({ tipo: z.literal('basic') }).strict(), // usuario y clave en cada petición
  z.object({ tipo: z.literal('ninguna') }).strict(), // solo pruebas
]);

export const perfilSchema = z.object({
  nombre: z.string().min(1),
  verificado: z.boolean().default(false), // true = contrastado contra la guía real de la versión instalada
  notas: z.string().optional(),
  autenticacion,
  alarmas: z.object({
    metodo: z.enum(['GET', 'POST']).default('GET'),
    ruta,
    consulta: params.default({}),
    cuerpo: z.record(z.any()).optional(),
    lista_en_respuesta: z.string().default(''), // ruta de la lista dentro de la respuesta; vacío = la respuesta es la lista
    paginacion: z.object({
      parametro_inicio: z.string().min(1),
      parametro_limite: z.string().min(1),
      tamano: z.number().int().min(1).max(1000).default(200),
      total_en_respuesta: z.string().optional(),
    }).strict().optional(),
  }).strict(),
  campos: z.object({
    id: z.string().min(1), nombre: z.string().min(1), severidad: z.string().min(1), equipo: z.string().min(1),
    ubicacion: z.string().optional(), inicio: z.string().optional(), texto: z.string().optional(),
  }).strict(),
  formato_fecha: z.enum(['auto', 'iso', 'epoch_ms', 'epoch_s']).default('auto'),
  // severidad de NCE → estado sugerido en la app. «Ignorar» descarta esas alarmas.
  severidad: z.record(z.enum(['Caido', 'Degradado', 'Mantenimiento', 'Ignorar'])).default({}),
}).strict();

/** Valida un perfil; si es inválido lanza un Error con la lista de problemas, campo por campo. */
export function validarPerfil(obj) {
  const r = perfilSchema.safeParse(obj);
  if (r.success) return r.data;
  const detalle = r.error.issues.map((i) => `${i.path.join('.') || '(raíz)'}: ${i.message}`).join('; ');
  throw new Error(`El perfil de NCE no es válido: ${detalle}`);
}

export async function cargarPerfil(archivo) {
  let texto;
  try { texto = await fs.readFile(archivo, 'utf8'); } catch (err) { throw new Error(`No se pudo leer el perfil de NCE (${archivo}): ${err.code ?? err.message}`); }
  let json;
  try { json = JSON.parse(texto); } catch (err) { throw new Error(`El perfil de NCE (${archivo}) no es un JSON válido: ${err.message}`); }
  return validarPerfil(json);
}
