import jwt from 'jsonwebtoken';
import { Server } from 'socket.io';
import { env } from '../config/env.js';
import { User } from '../models/User.js';

let io;

export const getIO = () => io;

export function initSocket(httpServer) {
  io = new Server(httpServer, {
    cors: { origin: env.corsOrigins, credentials: true },
  });

  // Handshake autenticado: io(url, { auth: { token } })
  io.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth?.token;
      if (!token) throw new Error('sin token');
      const payload = jwt.verify(token, env.jwtSecret);
      const user = await User.findById(payload.sub).select('nombre rol turno activo');
      if (!user?.activo) throw new Error('usuario inválido');
      socket.data.user = { id: user.id, nombre: user.nombre, rol: user.rol };
      next();
    } catch {
      next(new Error('UNAUTHORIZED'));
    }
  });

  io.on('connection', (socket) => {
    socket.join('noc'); // sala común de la consola
    console.log(`[socket] +${socket.data.user.nombre} (${socket.id})`);
    socket.on('disconnect', () => console.log(`[socket] -${socket.data.user.nombre} (${socket.id})`));
  });

  return io;
}

// socket.io detecta binarios recorriendo el objeto: un ObjectId de bson contiene un Buffer y
// provocaría un envío binario. Pasamos por JSON para enviar strings/fechas ISO limpios.
const plano = (doc) => JSON.parse(JSON.stringify(doc));

export function emitToNoc(event, payload) {
  io?.to('noc').emit(event, plano(payload));
}
