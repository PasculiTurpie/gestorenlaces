import http from 'node:http';
import https from 'node:https';
import { leerRuta, redactar, sustituir } from './util.js';

/** Error de la integración con un código estable (para mostrarlo y para decidir si se reintenta) y un mensaje en español. */
export class ErrorNCE extends Error {
  constructor(codigo, mensaje, detalle) {
    super(mensaje);
    this.name = 'ErrorNCE';
    this.codigo = codigo; // RED | TLS | TIMEOUT | AUTH | HTTP | FORMATO
    this.detalle = detalle;
  }
}

const ERRORES_TLS = {
  DEPTH_ZERO_SELF_SIGNED_CERT: 'El certificado de NCE es autofirmado',
  SELF_SIGNED_CERT_IN_CHAIN: 'La cadena de certificados de NCE incluye uno autofirmado',
  UNABLE_TO_VERIFY_LEAF_SIGNATURE: 'No se pudo verificar el certificado de NCE (falta la autoridad certificadora)',
  UNABLE_TO_GET_ISSUER_CERT_LOCALLY: 'No se encontró la autoridad certificadora del certificado de NCE',
  CERT_HAS_EXPIRED: 'El certificado de NCE está vencido',
  ERR_TLS_CERT_ALTNAME_INVALID: 'El certificado de NCE no corresponde al nombre o IP con que se conecta',
};
const MAX_BYTES = 10 * 1024 * 1024;
const MAX_PAGINAS = 50;
const MAX_ALARMAS = 20000;

/** Una petición HTTP(S) con tiempo máximo, tope de tamaño y verificación TLS configurable. Devuelve { status, texto, ms }. */
export function peticion({ url, metodo = 'GET', cabeceras = {}, cuerpo, timeoutMs = 15000, tlsVerify = true, ca }) {
  const u = new URL(url);
  const lib = u.protocol === 'https:' ? https : http;
  const inicio = Date.now();
  return new Promise((resolve, reject) => {
    const opciones = { method: metodo, hostname: u.hostname, port: u.port || undefined, path: `${u.pathname}${u.search}`, headers: cabeceras, agent: false, timeout: timeoutMs };
    if (u.protocol === 'https:') { opciones.rejectUnauthorized = tlsVerify; if (ca) opciones.ca = ca; }
    let cerrado = false;
    const fallar = (err) => { if (cerrado) return; cerrado = true; reject(err); };
    const req = lib.request(opciones, (res) => {
      const trozos = [];
      let bytes = 0;
      res.on('data', (c) => {
        bytes += c.length;
        if (bytes > MAX_BYTES) { fallar(new ErrorNCE('FORMATO', 'La respuesta de NCE es demasiado grande (más de 10 MB)')); req.destroy(); return; } // ya no se acepta nada más de esta respuesta
        trozos.push(c);
      });
      res.on('end', () => { if (cerrado) return; cerrado = true; resolve({ status: res.statusCode, texto: Buffer.concat(trozos).toString('utf8'), ms: Date.now() - inicio }); });
    });
    req.on('timeout', () => { fallar(new ErrorNCE('TIMEOUT', `NCE no respondió en ${Math.round(timeoutMs / 1000)} s`)); req.destroy(); });
    req.on('error', (err) => {
      if (cerrado) return;
      if (err instanceof ErrorNCE) return fallar(err);
      if (ERRORES_TLS[err.code]) return fallar(new ErrorNCE('TLS', `${ERRORES_TLS[err.code]}. Si es de confianza, indique su certificado en NCE_CA_FILE.`, err.code));
      const claro = { ECONNREFUSED: 'NCE rechazó la conexión (¿dirección o puerto incorrectos, o firewall?)', ENOTFOUND: 'No se encuentra el nombre de NCE (DNS)', EHOSTUNREACH: 'No hay ruta hasta NCE', ECONNRESET: 'NCE cortó la conexión', ETIMEDOUT: 'La conexión con NCE agotó el tiempo' }[err.code];
      fallar(new ErrorNCE('RED', claro ?? `Error de red al conectar con NCE: ${err.code ?? err.message}`, err.code));
    });
    if (cuerpo !== undefined) req.write(cuerpo);
    req.end();
  });
}

const dormir = (ms) => new Promise((r) => setTimeout(r, ms));
const trozo = (t) => String(t ?? '').replace(/\s+/g, ' ').slice(0, 240);

/**
 * Cliente de lectura de iMaster NCE. Solo CONSULTA: autentica y lee alarmas; no escribe nada en NCE.
 *  - Guarda el token y lo renueva antes de que venza o si NCE responde 401.
 *  - Reintenta con espera creciente ante errores de red y 5xx (no ante credenciales inválidas).
 */
export class ClienteNCE {
  constructor({ baseUrl, usuario, clave, perfil, tlsVerify = true, ca, timeoutMs = 15000, reintentos = 2, esperaBaseMs = 400, ahora = Date.now }) {
    this.baseUrl = String(baseUrl).replace(/\/+$/, '');
    Object.assign(this, { usuario, clave, perfil, tlsVerify, ca, timeoutMs, reintentos, esperaBaseMs, ahora });
    this.token = null;
    this.expira = 0;
  }

  #url(ruta, consulta = {}) {
    const u = new URL(`${this.baseUrl}${ruta}`);
    for (const [k, v] of Object.entries(consulta)) u.searchParams.set(k, String(v));
    return u.toString();
  }

  #cabecerasAuth() {
    const a = this.perfil.autenticacion;
    if (a.tipo === 'basic') return { Authorization: `Basic ${Buffer.from(`${this.usuario}:${this.clave}`).toString('base64')}` };
    if (a.tipo === 'token' && this.token) return { [a.cabecera]: `${a.prefijo}${this.token}` };
    return {};
  }

  /** Pide un token (si el perfil lo usa). Devuelve { ms }. Falla con ErrorNCE('AUTH') si NCE rechaza las credenciales. */
  async autenticar() {
    const a = this.perfil.autenticacion;
    if (a.tipo !== 'token') return { ms: 0 };
    const vars = { usuario: this.usuario, clave: this.clave };
    const cuerpoObj = sustituir(a.cuerpo, vars);
    const form = a.formato === 'form';
    const cuerpo = form ? new URLSearchParams(Object.entries(cuerpoObj).map(([k, v]) => [k, String(v)])).toString() : JSON.stringify(cuerpoObj);
    const r = await this.#enviar({ url: this.#url(a.ruta), metodo: a.metodo, cabeceras: { 'Content-Type': form ? 'application/x-www-form-urlencoded' : 'application/json', Accept: 'application/json' }, cuerpo }, { reintentar: false });
    if (r.status === 401 || r.status === 403) throw new ErrorNCE('AUTH', 'NCE rechazó el usuario o la contraseña de integración', `HTTP ${r.status}`);
    if (r.status >= 400) throw new ErrorNCE('HTTP', `NCE respondió ${r.status} al autenticar`, trozo(r.texto));
    let json;
    try { json = JSON.parse(r.texto); } catch { throw new ErrorNCE('FORMATO', 'La respuesta de autenticación de NCE no es JSON', trozo(r.texto)); }
    const token = leerRuta(json, a.token_en_respuesta);
    if (typeof token !== 'string' || !token) throw new ErrorNCE('FORMATO', `NCE respondió, pero no se encontró el token en «${a.token_en_respuesta}»`, `Campos recibidos: ${Object.keys(json ?? {}).join(', ') || '(ninguno)'}`);
    const seg = Number(leerRuta(json, a.expira_en_respuesta)) || a.expira_seg_por_defecto;
    this.token = token;
    this.expira = this.ahora() + seg * 1000;
    return { ms: r.ms, expira_seg: seg };
  }

  /** Una petición con reintentos ante errores transitorios (red, tiempo, 5xx). */
  async #enviar(params, { reintentar = true } = {}) {
    const base = { timeoutMs: this.timeoutMs, tlsVerify: this.tlsVerify, ca: this.ca };
    let ultimo;
    for (let n = 0; n <= (reintentar ? this.reintentos : 0); n += 1) {
      try {
        const r = await peticion({ ...base, ...params });
        if (r.status >= 500 && n < (reintentar ? this.reintentos : 0)) { ultimo = new ErrorNCE('HTTP', `NCE respondió ${r.status}`, trozo(r.texto)); await dormir(this.esperaBaseMs * 2 ** n); continue; }
        return r;
      } catch (err) {
        ultimo = err;
        const transitorio = err.codigo === 'RED' || err.codigo === 'TIMEOUT';
        if (!transitorio || n >= (reintentar ? this.reintentos : 0)) throw err;
        await dormir(this.esperaBaseMs * 2 ** n);
      }
    }
    throw ultimo;
  }

  async #asegurarSesion() {
    if (this.perfil.autenticacion.tipo === 'token' && (!this.token || this.ahora() > this.expira - 30_000)) await this.autenticar();
  }

  async #leerPagina(consulta, intentoAuth = true) {
    const al = this.perfil.alarmas;
    await this.#asegurarSesion();
    const cuerpo = al.metodo === 'POST' && al.cuerpo ? JSON.stringify(al.cuerpo) : undefined;
    const r = await this.#enviar({ url: this.#url(al.ruta, { ...al.consulta, ...consulta }), metodo: al.metodo, cabeceras: { Accept: 'application/json', ...(cuerpo ? { 'Content-Type': 'application/json' } : {}), ...this.#cabecerasAuth() }, cuerpo });
    if ((r.status === 401 || r.status === 403) && intentoAuth && this.perfil.autenticacion.tipo === 'token') { this.token = null; return this.#leerPagina(consulta, false); } // el token venció: se renueva una vez
    if (r.status === 401 || r.status === 403) throw new ErrorNCE('AUTH', 'NCE no autorizó la consulta de alarmas: revise los permisos del usuario de integración', `HTTP ${r.status}`);
    if (r.status >= 400) throw new ErrorNCE('HTTP', `NCE respondió ${r.status} a la consulta de alarmas`, trozo(r.texto));
    let json;
    try { json = JSON.parse(r.texto); } catch { throw new ErrorNCE('FORMATO', 'La respuesta de NCE no es JSON válido', trozo(r.texto)); }
    const lista = leerRuta(json, al.lista_en_respuesta);
    if (!Array.isArray(lista)) throw new ErrorNCE('FORMATO', `No se encontró la lista de alarmas en «${al.lista_en_respuesta || '(la respuesta)'}»`, `Claves de primer nivel: ${Object.keys(json ?? {}).join(', ') || '(ninguna)'}`);
    return { lista, json, ms: r.ms };
  }

  /** Lee las alarmas activas (todas las páginas). Devuelve { crudas, paginas, ms }. */
  async consultarAlarmas() {
    const inicio = Date.now();
    const pag = this.perfil.alarmas.paginacion;
    if (!pag) { const p = await this.#leerPagina({}); return { crudas: p.lista, paginas: 1, ms: Date.now() - inicio }; }
    const crudas = [];
    for (let pagina = 0; pagina < MAX_PAGINAS; pagina += 1) {
      const p = await this.#leerPagina({ [pag.parametro_inicio]: crudas.length, [pag.parametro_limite]: pag.tamano });
      crudas.push(...p.lista);
      const total = pag.total_en_respuesta ? Number(leerRuta(p.json, pag.total_en_respuesta)) : null;
      if (crudas.length > MAX_ALARMAS) throw new ErrorNCE('FORMATO', `NCE devolvió más de ${MAX_ALARMAS} alarmas: acote la consulta en el perfil`);
      if (p.lista.length < pag.tamano || (Number.isFinite(total) && crudas.length >= total)) return { crudas, paginas: pagina + 1, ms: Date.now() - inicio };
    }
    throw new ErrorNCE('FORMATO', `Se leyeron ${MAX_PAGINAS} páginas y NCE sigue entregando más: revise la paginación del perfil`);
  }
}

export { redactar };
