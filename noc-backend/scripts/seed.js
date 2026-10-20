/**
 * Seed completo para desarrollo: usuarios, tipos de línea, los 89 nodos y 118 enlaces del catálogo, historial de incidencias
 * y un acta de turno de ejemplo.
 *   npm run seed            (borra y recrea las colecciones)
 *   npm run seed -- --force (necesario si NODE_ENV=production)
 *
 * Las fechas son relativas a "ahora", así las métricas mensuales siempre tienen datos.
 */
import mongoose from 'mongoose';
import { ESCALA, NODOS } from '../data/nodos.catalogo.js';
import { connectDB } from '../src/config/db.js';
import { env } from '../src/config/env.js';
import { IncidenceLog } from '../src/models/IncidenceLog.js';
import { Link } from '../src/models/Link.js';
import { NodeDoc } from '../src/models/Node.js';
import { ShiftReport } from '../src/models/ShiftReport.js';
import { User } from '../src/models/User.js';
import { AlarmType } from '../src/models/AlarmType.js';
import { LinkType } from '../src/models/LinkType.js';
import { cargarAlarmasBase } from './lib/alarmasBase.js';
import { cargarEnlaces } from './lib/cargarEnlaces.js';
import { cargarTiposEnlace } from './lib/tiposEnlace.js';

if (env.nodeEnv === 'production' && !process.argv.includes('--force')) {
  console.error('Seed bloqueado en producción (borra datos). Use --force si es intencional.');
  process.exit(1);
}

const ahora = new Date();
const MIN = 60_000;
const DIA = 1440; // minutos
const hace = (minutos) => new Date(ahora.getTime() - minutos * MIN);

await connectDB();

console.log('[seed] limpiando colecciones...');
const modelos = [User, NodeDoc, Link, IncidenceLog, ShiftReport, LinkType, AlarmType];
await Promise.all(modelos.map((m) => m.deleteMany({})));
await Promise.all(modelos.map((m) => m.syncIndexes()));

// ------------------------------------------------------------------ usuarios
const password = process.env.SEED_PASSWORD ?? 'ChangeMe123!';
const [admin, supervisor, opManana, opNoche] = await User.create([
  { nombre: 'Admin NOC', email: 'admin@noc.local', password, rol: 'Admin', turno: 'Mañana' },
  { nombre: 'Sofía Supervisora', email: 'supervisor@noc.local', password, rol: 'Supervisor', turno: 'Tarde' },
  { nombre: 'Marcos Operador', email: 'operador.manana@noc.local', password, rol: 'Operador', turno: 'Mañana' },
  { nombre: 'Nicolás Operador', email: 'operador.noche@noc.local', password, rol: 'Operador', turno: 'Noche' },
]);

// ------------------------------------------------------------------ nodos (catálogo real, layout de la captura del NMS)
await NodeDoc.insertMany(
  NODOS.map((n) => ({
    id_nodo: n.id_nodo,
    nombre: n.nombre ?? n.id_nodo,
    tipo: n.tipo,
    posicion: { x: Math.round(n.x * ESCALA), y: Math.round(n.y * ESCALA) },
  })),
);

// ------------------------------------------------------------------ tipos de línea (Propio, WOM, Tigo, Claro, Entel)
await cargarTiposEnlace();

// ------------------------------------------------------------------ tipificación de alarmas (guía de procedimientos de partida)
await cargarAlarmasBase();

// ------------------------------------------------------------------ enlaces (catálogo real)
const { creados, incidenciasAbiertas, docs } = await cargarEnlaces({ operador: admin, ahora });
const enlace = (id) => {
  const l = docs.get(id);
  if (!l) throw new Error(`El seed referencia un enlace que no existe en el catálogo: ${id}`);
  return l;
};

// ------------------------------------------------------------------ historial de incidencias (cerradas)
// [id_enlace, severidad, hace X min (inicio), duración min, causa, ticket]
const historicas = [
  ['ENL-CHIL1-BULN-01', 'Caido',     3 * DIA,  95,  'Corte de fibra por obras viales',      'INC0012102'],
  ['ENL-LANG1-MLCH-01', 'Caido',     12 * DIA, 210, 'Falla de energía en repetidor',        'INC0011987'],
  ['ENL-VLDV-LANC-01',  'Degradado', 5 * DIA,  180, 'Atenuación alta por conector sucio',   'INC0012140'],
  ['ENL-OSRN-RBNO-01',  'Caido',     25 * DIA, 45,  'Maniobra no coordinada del proveedor', 'INC0011790'],
  ['ENL-LUNN-LAMS-01',  'Caido',     8 * DIA,  30,  'Reinicio de equipo DWDM',              'INC0012010'],
  ['ENL-PMTT-PRRQ-01',  'Caido',     15 * DIA, 130, 'Daño en cámara de empalme',            'INC0011955'],
];
await IncidenceLog.create(
  historicas.map(([id, severidad, atras, dur, causa, ticket]) => ({
    enlace: enlace(id)._id, severidad, inicio: hace(atras), fin: hace(atras - dur), causa_raiz: causa, ticket,
  })),
); // create() ejecuta los hooks (duración, abierta)

// ------------------------------------------------------------------ acta de turno de ejemplo (cerrada)
const degradados = (await Link.find({ estado: 'Degradado' }).sort({ id_enlace: 1 }).limit(2).select('_id').lean());
await ShiftReport.create({
  operador: opManana._id,
  tipo_turno: 'Mañana',
  fecha_inicio: hace(14 * 60),
  fecha_fin: hace(6 * 60),
  checklist_enlaces: degradados.map((l, i) => ({
    enlace: l._id,
    estado_recibido: 'Degradado',
    gestionado: true,
    accion_tomada: i === 0 ? 'Se solicita revisión de conectores al proveedor; en seguimiento.' : 'Sin cambios; se mantiene en observación.',
  })),
  bitacora_general: 'Turno sin novedades adicionales. Se mantienen enlaces degradados en seguimiento.',
  cerrado: true,
});

// ------------------------------------------------------------------ resumen
const fuera = await Link.find({ estado: { $ne: 'OK' } }).sort({ id_enlace: 1 }).select('id_enlace estado').lean();
console.log(`\n[seed] listo: ${NODOS.length} nodos · ${creados} enlaces (${incidenciasAbiertas} con incidencia abierta) · ${historicas.length} incidencias históricas`);
console.table(fuera.map((l) => ({ enlace: l.id_enlace, estado: l.estado })));
console.log(`\nUsuarios (password: ${password})`);
console.table([admin, supervisor, opManana, opNoche].map((u) => ({ email: u.email, rol: u.rol, turno: u.turno })));

await mongoose.connection.close();
