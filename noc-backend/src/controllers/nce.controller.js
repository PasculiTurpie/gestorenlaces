import { env } from '../config/env.js';
import { obtenerGestor, recargarGestor } from '../integraciones/nce/index.js';
import { AppError, asyncHandler } from '../utils/errors.js';

async function gestor() {
  try { return await obtenerGestor(); } catch (err) { throw new AppError(409, err.message); }
}

let ultimaPrueba = 0;

// GET /api/integraciones/nce/estado
export const estado = asyncHandler(async (_req, res) => {
  try {
    res.json({ ok: true, data: (await obtenerGestor()).estado() });
  } catch (err) {
    // perfil o correspondencias inválidos: se informa en la pantalla en vez de fallar
    res.json({ ok: true, data: { habilitado: env.nce.habilitado, configurado: Boolean(env.nce.baseUrl), error_configuracion: err.message } });
  }
});

// GET /api/integraciones/nce/alarmas → la última lectura de NCE, ya relacionada con los enlaces
export const alarmas = asyncHandler(async (_req, res) => {
  try {
    const g = await obtenerGestor();
    const e = g.estado();
    res.json({ ok: true, data: g.alarmas(), meta: { habilitado: e.habilitado, ultima_ok: e.ultima_ok, ultimo_error: e.ultimo_error } });
  } catch {
    res.json({ ok: true, data: [], meta: { habilitado: false, ultima_ok: null, ultimo_error: null } });
  }
});

// POST /api/integraciones/nce/probar → prueba paso a paso, sin guardar nada
export const probar = asyncHandler(async (_req, res) => {
  if (Date.now() - ultimaPrueba < 3000) throw new AppError(429, 'Espere unos segundos antes de volver a probar la conexión');
  ultimaPrueba = Date.now();
  res.json({ ok: true, data: await (await gestor()).probar() });
});

// POST /api/integraciones/nce/sincronizar → lee las alarmas ahora
export const sincronizar = asyncHandler(async (_req, res) => {
  const g = await gestor();
  await g.sincronizar();
  res.json({ ok: true, data: g.estado() });
});

// POST /api/integraciones/nce/recargar → relee perfil y correspondencias
export const recargar = asyncHandler(async (_req, res) => {
  try { res.json({ ok: true, data: (await recargarGestor()).estado() }); } catch (err) { throw new AppError(409, err.message); }
});
