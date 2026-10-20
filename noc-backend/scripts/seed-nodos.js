/**
 * Carga (o actualiza) el catálogo de nodos SIN tocar usuarios, enlaces ni historial.
 *
 *   npm run seed:nodos                 -> upsert por id_nodo; nodos nuevos con posición inicial,
 *                                         los existentes conservan la posición que ya tengan
 *   npm run seed:nodos -- --reset-pos  -> además reaplica las posiciones del catálogo
 *   npm run seed:nodos -- --prune      -> además borra los nodos que ya no están en el catálogo
 *                                         (los que tengan enlaces se conservan y se avisa)
 *   npm run seed:nodos -- --dry-run    -> valida y muestra el resumen sin conectar a la BD
 *
 * Idempotente: se puede ejecutar cuantas veces haga falta sin duplicar nodos.
 */
import mongoose from 'mongoose';
import { ESCALA, NODOS } from '../data/nodos.catalogo.js';
import { NodeDoc } from '../src/models/Node.js';

const RESET_POS = process.argv.includes('--reset-pos');
const DRY_RUN = process.argv.includes('--dry-run');
const PRUNE = process.argv.includes('--prune');

// ---------------------------------------------------------------- validación previa (sin BD)
const candidatos = NODOS.map((n) => ({
  id_nodo: n.id_nodo,
  nombre: n.nombre ?? n.id_nodo,
  tipo: n.tipo,
  posicion: { x: Math.round(n.x * ESCALA), y: Math.round(n.y * ESCALA) },
}));

const repetidos = candidatos.map((n) => n.id_nodo).filter((id, i, arr) => arr.indexOf(id) !== i);
if (repetidos.length) {
  console.error(`Catálogo con id_nodo repetidos: ${[...new Set(repetidos)].join(', ')}`);
  process.exit(1);
}

const invalidos = candidatos
  .map((n) => ({ n, err: new NodeDoc(n).validateSync() }))
  .filter(({ err }) => err);
if (invalidos.length) {
  for (const { n, err } of invalidos) console.error(`✗ ${n.id_nodo}: ${Object.values(err.errors).map((e) => e.message).join('; ')}`);
  process.exit(1);
}

const porTipo = candidatos.reduce((acc, n) => ({ ...acc, [n.tipo]: (acc[n.tipo] ?? 0) + 1 }), {});
const dudosos = NODOS.filter((n) => n.verificar);

function resumen() {
  console.log(`Catálogo válido: ${candidatos.length} nodos`, porTipo);
  if (dudosos.length) {
    console.log(`\nPendientes de verificar (${dudosos.length}):`);
    console.table(dudosos.map((n) => ({ id_nodo: n.id_nodo, tipo: n.tipo, motivo: n.verificar })));
  }
}

if (DRY_RUN) {
  resumen();
  console.log('\n[dry-run] no se escribió nada.');
  process.exit(0);
}

// ---------------------------------------------------------------- escritura
const { connectDB } = await import('../src/config/db.js');
await connectDB();
await NodeDoc.syncIndexes();

const ops = candidatos.map((n) => ({
  updateOne: {
    filter: { id_nodo: n.id_nodo },
    update: {
      $set: { nombre: n.nombre, tipo: n.tipo, ...(RESET_POS && { posicion: n.posicion }) },
      $setOnInsert: { ...(!RESET_POS && { posicion: n.posicion }) },
    },
    upsert: true,
  },
}));

const r = await NodeDoc.bulkWrite(ops, { ordered: false });
resumen();
console.log(`\nResultado: ${r.upsertedCount} creados · ${r.modifiedCount} actualizados · ${r.matchedCount - r.modifiedCount} sin cambios${RESET_POS ? ' · posiciones reaplicadas' : ''}`);

if (PRUNE) {
  const { Link } = await import('../src/models/Link.js');
  const sobrantes = await NodeDoc.find({ id_nodo: { $nin: candidatos.map((n) => n.id_nodo) } }).select('_id id_nodo').lean();
  let borrados = 0;
  const conservados = [];
  for (const n of sobrantes) {
    if (await Link.exists({ $or: [{ origen_nodo: n._id }, { destino_nodo: n._id }] })) conservados.push(n.id_nodo);
    else { await NodeDoc.deleteOne({ _id: n._id }); borrados++; }
  }
  console.log(`Prune: ${borrados} nodos obsoletos eliminados${conservados.length ? ` · conservados por tener enlaces: ${conservados.join(', ')}` : ''}`);
}
console.log(`Total de nodos en la BD: ${await NodeDoc.countDocuments()}`);

await mongoose.connection.close();
