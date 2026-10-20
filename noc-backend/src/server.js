import http from 'node:http';
import mongoose from 'mongoose';
import { createApp } from './app.js';
import { connectDB } from './config/db.js';
import { env } from './config/env.js';
import { verificarCarpetaDocumentos } from './services/sistema.service.js';
import { rellenarFechaTurno } from './services/turnos.service.js';
import { getIO, initSocket } from './sockets/index.js';

await connectDB();

const server = http.createServer(createApp());
// Detrás de un proxy (Vite en desarrollo, nginx/ALB en producción) el servidor debe mantener abiertas las conexiones inactivas
// más tiempo que el proxy; con el valor por defecto de Node (5 s) pueden producirse cortes esporádicos («socket hang up» / 500).
server.keepAliveTimeout = 65_000;
server.headersTimeout = 66_000;
initSocket(server);

await verificarCarpetaDocumentos();
// Actas anteriores al campo `fecha_turno`: se rellena una vez y luego no hace nada (idempotente). No impide arrancar si falla.
await rellenarFechaTurno()
  .then((n) => n && console.log(`[turnos] fecha de turno asignada a ${n} acta(s) anteriores`))
  .catch((err) => console.error('[turnos] no se pudo asignar la fecha de turno a las actas anteriores:', err.message));

server.listen(env.port, () => {
  console.log(`[http] NOC API escuchando en :${env.port} (${env.nodeEnv})`);
});

async function apagar(signal) {
  console.log(`[sys] ${signal} recibido, cerrando...`);
  getIO()?.close();
  server.close(async () => {
    await mongoose.connection.close();
    process.exit(0);
  });
  setTimeout(() => process.exit(1), 10_000).unref();
}
process.on('SIGINT', () => apagar('SIGINT'));
process.on('SIGTERM', () => apagar('SIGTERM'));
process.on('unhandledRejection', (err) => console.error('[sys] unhandledRejection', err));
