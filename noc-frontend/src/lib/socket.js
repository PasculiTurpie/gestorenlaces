import { io } from 'socket.io-client';

const BASE = import.meta.env?.VITE_API_URL ?? '';
let socket = null;

export function conectarSocket(token, { alConectar, alDesconectar, alRechazar, eventos }) {
  desconectarSocket();
  const opciones = { auth: { token }, reconnectionDelayMax: 5000 };
  socket = BASE ? io(BASE, opciones) : io(opciones); // sin BASE: mismo origen (proxy de Vite)

  socket.on('connect', alConectar);
  socket.on('disconnect', alDesconectar);
  socket.on('connect_error', (err) => {
    if (err.message === 'UNAUTHORIZED') alRechazar();
    else alDesconectar();
  });
  for (const [evento, fn] of Object.entries(eventos)) socket.on(evento, fn);
  return socket;
}

export function desconectarSocket() {
  if (!socket) return;
  socket.removeAllListeners();
  socket.disconnect();
  socket = null;
}
