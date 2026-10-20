/**
 * Crea las tipificaciones de alarma de partida (LOS, LOF, CORTE, ATEN, SD, ENERGIA, EQUIPO, TERCEROS, MANT).
 *   npm run seed:alarmas
 * Idempotente: no modifica las que ya existan. El contenido es GENÉRICO: revíselo y ajústelo a sus
 * procedimientos reales desde Administración → Alarmas.
 */
import mongoose from 'mongoose';
import { connectDB } from '../src/config/db.js';
import { AlarmType } from '../src/models/AlarmType.js';
import { ALARMAS_BASE, cargarAlarmasBase } from './lib/alarmasBase.js';

await connectDB();
await AlarmType.syncIndexes();
const r = await cargarAlarmasBase();
console.log(`Tipificaciones: ${r.creados} creadas · ${r.total - r.creados} ya existían (${ALARMAS_BASE.map((a) => a.codigo).join(', ')})`);
await mongoose.connection.close();
