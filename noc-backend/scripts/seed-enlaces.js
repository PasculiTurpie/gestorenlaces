/**
 * Carga (o sincroniza) el catálogo de enlaces SIN tocar usuarios, nodos ni historial.
 *
 *   npm run seed:enlaces              -> crea los enlaces que falten; los existentes conservan su estado
 *   npm run seed:enlaces -- --dry-run -> valida el catálogo contra el de nodos, sin conectar a la BD
 *
 * Requiere que los nodos ya estén cargados (npm run seed:nodos) y que exista al menos un usuario
 * (se usa un Admin como autor de la entrada inicial del timeline).
 */
import mongoose from 'mongoose';
import { ENLACES } from '../data/enlaces.catalogo.js';
import { NODOS } from '../data/nodos.catalogo.js';
import { cargarEnlaces, validarCatalogoEnlaces } from './lib/cargarEnlaces.js';
import { TIPOS_BASE, cargarTiposEnlace } from './lib/tiposEnlace.js';

const DRY_RUN = process.argv.includes('--dry-run');

const errores = validarCatalogoEnlaces(new Set(NODOS.map((n) => n.id_nodo)), ENLACES, new Set(TIPOS_BASE.map((t) => t.clave)));
const porEstado = ENLACES.reduce((acc, e) => ({ ...acc, [e.estado]: (acc[e.estado] ?? 0) + 1 }), {});

if (errores.length) {
  console.error(`Catálogo de enlaces inválido:\n  - ${errores.join('\n  - ')}`);
  process.exit(1);
}
console.log(`Catálogo válido: ${ENLACES.length} enlaces`, porEstado);

if (DRY_RUN) {
  console.log('[dry-run] no se escribió nada.');
  process.exit(0);
}

const { connectDB } = await import('../src/config/db.js');
const { Link } = await import('../src/models/Link.js');
const { User } = await import('../src/models/User.js');

await connectDB();
await Link.syncIndexes();

await cargarTiposEnlace(); // idempotente: los enlaces necesitan los tipos base
const operador = (await User.findOne({ rol: 'Admin' })) ?? (await User.findOne());
if (!operador) {
  console.error('No hay usuarios en la BD. Ejecute primero "npm run seed" para crearlos.');
  process.exit(1);
}

const r = await cargarEnlaces({ operador });
console.log(`Resultado: ${r.creados} creados (${r.incidenciasAbiertas} con incidencia abierta) · ${r.actualizados} completados · ${r.sinCambios} sin cambios`);
console.log(`Total de enlaces en la BD: ${await Link.countDocuments()}`);
await mongoose.connection.close();
