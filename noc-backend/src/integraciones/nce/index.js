import fs from 'node:fs/promises';
import { env } from '../../config/env.js';
import { emitToNoc } from '../../sockets/index.js';
import { cargarCorrespondencias } from './correspondencia.js';
import { crearGestorNCE } from './gestor.js';
import { cargarPerfil } from './perfil.js';

let gestor = null;
let promesa = null;

async function construir() {
  const c = env.nce;
  const [perfil, reglas] = await Promise.all([cargarPerfil(c.perfil), cargarCorrespondencias(c.correspondencias)]);
  let ca;
  if (c.caFile) {
    try { ca = await fs.readFile(c.caFile); } catch (err) { throw new Error(`No se pudo leer NCE_CA_FILE (${c.caFile}): ${err.code ?? err.message}`); }
  }
  return crearGestorNCE({ config: { habilitado: c.habilitado, baseUrl: c.baseUrl, usuario: c.usuario, clave: c.clave, tlsVerify: c.tlsVerify, ca, timeoutMs: c.timeoutMs, pollSeg: c.pollSeg }, perfil, reglas, emitir: emitToNoc });
}

/** El gestor único de la integración. Si el perfil o las correspondencias son inválidos, rechaza con el motivo (y se reintenta en la próxima llamada). */
export function obtenerGestor() {
  promesa ??= construir().then((g) => (gestor = g)).catch((err) => { promesa = null; throw err; });
  return promesa;
}

/** Vuelve a leer el perfil y las correspondencias (útil tras editar los JSON) sin reiniciar el servidor. Las credenciales sí requieren reiniciar. */
export async function recargarGestor() {
  gestor?.detener();
  gestor = null;
  promesa = null;
  const g = await obtenerGestor();
  g.iniciar();
  return g;
}

export async function iniciarNCE() {
  if (!env.nce.habilitado) { console.log('[nce] Integración con iMaster NCE desactivada (NCE_ENABLED=false)'); return; }
  try {
    const g = await obtenerGestor();
    g.iniciar();
    console.log(`[nce] Integración activa: ${env.nce.baseUrl} cada ${env.nce.pollSeg} s (solo lectura)`);
  } catch (err) {
    console.error(`[nce] ⚠ No se pudo iniciar la integración: ${err.message}`);
  }
}
