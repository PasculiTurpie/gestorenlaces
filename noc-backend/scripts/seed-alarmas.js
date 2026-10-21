/**
 * Deja la tipificación de alarmas según el catálogo DWDM (Huawei).
 *   npm run seed:alarmas                         crea las que falten, renombra SPAN_LOSS y desactiva las genéricas anteriores
 *   npm run seed:alarmas -- --conservar-genericas  no desactiva LOS, LOF, CORTE, ATEN, SD, ENERGIA, EQUIPO, TERCEROS ni MANT
 * Idempotente: no modifica el contenido de las alarmas que ya existen (un Admin pudo editarlas desde el panel).
 * Los procedimientos, escalamientos y documentos se cargan en Administración → Alarmas.
 */
import mongoose from 'mongoose';
import { connectDB } from '../src/config/db.js';
import { AlarmType } from '../src/models/AlarmType.js';
import { ALARMAS_BASE, ALARMAS_GENERICAS, cargarAlarmasBase } from './lib/alarmasBase.js';

await connectDB();
await AlarmType.syncIndexes();
const r = await cargarAlarmasBase({ retirarGenericas: !process.argv.includes('--conservar-genericas') });
console.log(`Catálogo DWDM: ${r.total} alarmas · ${r.creados} creadas · ${r.total - r.creados} ya existían`);
for (const x of r.renombrados) console.log(`  ↻ ${x.de} → ${x.a} (se conservó su contenido y sus documentos)`);
console.log(r.retiradas ? `  ⏸ ${r.retiradas} genérica(s) desactivada(s) (${ALARMAS_GENERICAS.join(', ')}); su historial se conserva` : '  Sin genéricas que desactivar');
for (const c of r.conflictos) console.log(`  ⚠ ${c}`);
await mongoose.connection.close();
