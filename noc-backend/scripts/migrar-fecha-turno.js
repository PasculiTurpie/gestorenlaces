/**
 * Asigna la fecha de turno (el turno noche pertenece al día en que termina) a las actas que no la tienen.
 *   npm run migrar:fecha-turno            aplica los cambios
 *   npm run migrar:fecha-turno -- --dry   solo cuenta cuántas actas faltan
 * Idempotente. El servidor ya lo hace solo al arrancar; este script sirve para ejecutarlo a mano.
 */
import mongoose from 'mongoose';
import { connectDB } from '../src/config/db.js';
import { rellenarFechaTurno } from '../src/services/turnos.service.js';

const dryRun = process.argv.includes('--dry');
await connectDB();
const n = await rellenarFechaTurno({ dryRun });
console.log(dryRun ? `Actas sin fecha de turno: ${n} (no se modificó nada)` : `Actas actualizadas: ${n}`);
await mongoose.connection.close();
