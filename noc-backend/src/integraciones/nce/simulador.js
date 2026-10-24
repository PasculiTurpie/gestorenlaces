import http from 'node:http';
import https from 'node:https';

/**
 * SIMULADOR de iMaster NCE, solo para pruebas y demostraciones: imita una API que pide un token y entrega alarmas activas.
 * NO es la API real de Huawei: su forma coincide con el perfil de EJEMPLO (config/nce.perfil.ejemplo.json). Para un NCE real
 * hay que usar el perfil que corresponda a la guía de su versión.
 */
export const ALARMAS_EJEMPLO = (ahora = Date.now()) => {
  const hace = (min) => ahora - min * 60_000;
  const base = { neType: 'OSN 9800', sourceDomain: 'Optical', ackState: 'Unacknowledged', probableCause: 'n/a' };
  return [
    { ...base, alarmId: 1001, alarmName: 'R_LOS', severity: 'Critical', neName: 'VLDV-DWDM-01', location: 'Rack 0/Shelf 0/Slot 3/Port 1', occurTime: hace(25), additionalInfo: 'Pérdida de señal recibida en el puerto de línea' },
    { ...base, alarmId: 1002, alarmName: 'SPAN_LOSS_EXCEED_EOL', severity: 'Major', neName: 'LANC-DWDM-01', location: 'Rack 0/Shelf 0/Slot 2/Port 1', occurTime: hace(140), additionalInfo: 'Pérdida del tramo 3 dB sobre el límite EOL' },
    { ...base, alarmId: 1003, alarmName: 'BEFFEC_EXC', severity: 'Minor', neName: 'LANC-DWDM-01', location: 'Rack 0/Shelf 0/Slot 2/Port 2', occurTime: hace(95), additionalInfo: 'BER antes de FEC sobre el umbral' },
    { ...base, alarmId: 1004, alarmName: 'OSC_LOS', severity: 'Minor', neName: 'CHIL1-DWDM-01', location: 'Rack 0/Shelf 0/Slot 1/Port 1', occurTime: hace(310), additionalInfo: 'Sin canal de supervisión' },
    { ...base, alarmId: 1005, alarmName: 'FAN_FAIL', severity: 'Major', neName: 'PMTT-DWDM-02', location: 'Fan Unit 1', occurTime: hace(60), additionalInfo: 'Ventilador detenido' },
    { ...base, alarmId: 1006, alarmName: 'TEMP_ALAM', severity: 'Warning', neName: 'ALJA-DWDM-01', location: 'Slot 4', occurTime: hace(12), additionalInfo: 'Temperatura de tarjeta alta' },
    { ...base, alarmId: 1007, alarmName: 'LINK_DOWN_X', severity: 'Critical', neName: 'RANC-DWDM-01', location: 'Rack 0/Shelf 0/Slot 5/Port 1', occurTime: hace(8), additionalInfo: 'Alarma que la app todavía no tiene tipificada' },
    { ...base, alarmId: 1008, alarmName: 'NTP_SYNC', severity: 'Indeterminate', neName: 'PMTT-DWDM-02', location: 'Clock', occurTime: hace(500), additionalInfo: 'Informativa' },
  ];
};

/**
 * Crea el simulador. Opciones: usuario/clave válidos, vida del token, alarmas iniciales y, para HTTPS, `tls: { key, cert }`.
 * Para pruebas: `fallos.alarmas = n` hace que las próximas n consultas respondan 503; `peticiones` guarda lo que llegó.
 */
export function crearSimuladorNCE({ usuario = 'integracion', clave = 'cambiar-esta-clave', tokenSeg = 1800, alarmas = ALARMAS_EJEMPLO(), tls = null, retardoMs = 0 } = {}) {
  const sim = { usuario, clave, tokenSeg, alarmas, peticiones: [], fallos: { alarmas: 0 }, retardoMs, tokens: new Map(), logins: 0 };

  const responder = (res, estado, cuerpo) => { const t = JSON.stringify(cuerpo); res.writeHead(estado, { 'Content-Type': 'application/json' }); res.end(t); };
  const leer = (req) => new Promise((resolve) => { const t = []; req.on('data', (c) => t.push(c)); req.on('end', () => { try { resolve(JSON.parse(Buffer.concat(t).toString() || '{}')); } catch { resolve({}); } }); });

  const manejador = async (req, res) => {
    const url = new URL(req.url, 'http://x');
    sim.peticiones.push({ metodo: req.method, ruta: url.pathname, consulta: Object.fromEntries(url.searchParams), autorizacion: req.headers['x-access-token'] ? 'token' : 'ninguna' });
    if (sim.retardoMs) await new Promise((r) => setTimeout(r, sim.retardoMs));

    if (req.method === 'POST' && url.pathname === '/api/auth/token') {
      const b = await leer(req);
      if (b.usuario !== sim.usuario || b.clave !== sim.clave) return responder(res, 401, { error: 'Credenciales inválidas' });
      sim.logins += 1;
      const token = `tk-${sim.logins}-${Math.random().toString(36).slice(2, 10)}`;
      sim.tokens.set(token, Date.now() + sim.tokenSeg * 1000);
      return responder(res, 200, { access_token: token, expires_in: sim.tokenSeg, token_type: 'bearer' });
    }

    if (req.method === 'GET' && url.pathname === '/api/alarmas/activas') {
      const t = req.headers['x-access-token'];
      if (!t || !sim.tokens.has(t) || sim.tokens.get(t) < Date.now()) return responder(res, 401, { error: 'Token inválido o vencido' });
      if (sim.fallos.alarmas > 0) { sim.fallos.alarmas -= 1; return responder(res, 503, { error: 'Servicio no disponible' }); }
      const inicio = Number(url.searchParams.get('inicio') ?? 0);
      const limite = Number(url.searchParams.get('limite') ?? 1000);
      return responder(res, 200, { codigo: 0, data: { total: sim.alarmas.length, alarms: sim.alarmas.slice(inicio, inicio + limite) } });
    }

    // utilidades de demostración: agregar / limpiar una alarma sin reiniciar
    if (req.method === 'POST' && url.pathname === '/_sim/alarmas') { const a = await leer(req); sim.alarmas.push(a); return responder(res, 201, a); }
    if (req.method === 'DELETE' && url.pathname.startsWith('/_sim/alarmas/')) { const id = Number(url.pathname.split('/').pop()); sim.alarmas = sim.alarmas.filter((a) => a.alarmId !== id); return responder(res, 200, { ok: true }); }
    return responder(res, 404, { error: 'No encontrado' });
  };

  sim.servidor = tls ? https.createServer(tls, manejador) : http.createServer(manejador);
  sim.iniciar = (puerto = 0) => new Promise((resolve) => sim.servidor.listen(puerto, '127.0.0.1', () => { sim.puerto = sim.servidor.address().port; sim.url = `${tls ? 'https' : 'http'}://127.0.0.1:${sim.puerto}`; resolve(sim); }));
  sim.detener = () => new Promise((resolve) => { sim.servidor.closeAllConnections?.(); sim.servidor.close(() => resolve()); });
  return sim;
}
