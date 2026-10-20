/**
 * Crea los tipos de línea base (Propio, WOM, Tigo, Claro, Entel) si no existen.
 *   npm run seed:tipos
 * Idempotente: no modifica los que ya existan (un Admin pudo editarlos desde el panel).
 */
import mongoose from 'mongoose';
import { connectDB } from '../src/config/db.js';
import { LinkType } from '../src/models/LinkType.js';
import { TIPOS_BASE, cargarTiposEnlace } from './lib/tiposEnlace.js';

await connectDB();
await LinkType.syncIndexes();
const r = await cargarTiposEnlace();
console.log(`Tipos de línea: ${r.creados} creados · ${r.total - r.creados} ya existían (${TIPOS_BASE.map((t) => t.clave).join(', ')})`);
await mongoose.connection.close();
