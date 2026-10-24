import { ClienteNCE, ErrorNCE } from './cliente.js';
import { asociar } from './correspondencia.js';
import { interpretarLista } from './normalizar.js';
import { redactar } from './util.js';

const iso = (ms) => new Date(ms).toISOString();

/**
 * Gestiona la conexión: sincroniza las alarmas de NCE cada cierto tiempo, guarda la última lectura y permite probar la conexión paso a paso.
 * `config` = { habilitado, baseUrl, usuario, clave, tlsVerify, ca, timeoutMs, pollSeg }.
 * Es de SOLO LECTURA: lo que trae de NCE se muestra y se relaciona con los enlaces; no cambia estados por sí solo.
 */
export function crearGestorNCE({ config, perfil, reglas = [], emitir = () => {}, ahora = Date.now, clienteExtra = {} }) {
  const cliente = () => new ClienteNCE({ baseUrl: config.baseUrl, usuario: config.usuario, clave: config.clave, perfil, tlsVerify: config.tlsVerify, ca: config.ca, timeoutMs: config.timeoutMs, ...clienteExtra, ahora });
  let cli = null;
  let temporizador = null;
  const e = { sincronizando: false, ultima_ok: null, ultima_duracion_ms: null, ultimo_error: null, errores_seguidos: 0, alarmas: [], descartadas: 0, total_crudas: 0 };

  const relacionar = (alarmas) => alarmas.map((a) => ({ ...a, enlace: asociar(a, reglas) }));

  async function sincronizar() {
    if (!config.baseUrl || e.sincronizando) return;
    e.sincronizando = true;
    try {
      cli ??= cliente();
      const { crudas, ms } = await cli.consultarAlarmas();
      const { alarmas, descartadas } = interpretarLista(crudas, perfil);
      Object.assign(e, { alarmas: relacionar(alarmas), descartadas: descartadas.length, total_crudas: crudas.length, ultima_ok: iso(ahora()), ultima_duracion_ms: ms, ultimo_error: null, errores_seguidos: 0 });
      emitir('nce:sincronizado', { total: e.alarmas.length, ts: e.ultima_ok });
    } catch (err) {
      e.errores_seguidos += 1;
      e.ultimo_error = { codigo: err.codigo ?? 'INTERNO', mensaje: err instanceof ErrorNCE ? err.message : `Error inesperado: ${err.message}`, detalle: err.detalle ?? null, en: iso(ahora()) };
    } finally { e.sincronizando = false; }
  }

  /** Prueba la conexión paso a paso, sin guardar nada: configuración → autenticación → consulta → interpretación → correspondencia. */
  async function probar() {
    const pasos = [];
    const paso = async (nombre, fn) => {
      const t0 = Date.now();
      try { const r = await fn(); pasos.push({ paso: nombre, ok: true, ms: Date.now() - t0, ...r }); return true; } catch (err) {
        pasos.push({ paso: nombre, ok: false, ms: Date.now() - t0, detalle: err.message, codigo: err.codigo ?? 'INTERNO', ayuda: err.detalle ?? null });
        return false;
      }
    };
    let cliLocal; let crudas = []; let alarmas = []; let descartadas = [];
    const sigue = await paso('Configuración', async () => {
      if (!config.baseUrl) throw new ErrorNCE('CONFIG', 'Falta NCE_BASE_URL en el archivo .env del servidor');
      if (perfil.autenticacion.tipo !== 'ninguna' && (!config.usuario || !config.clave)) throw new ErrorNCE('CONFIG', 'Faltan NCE_USERNAME o NCE_PASSWORD en el archivo .env del servidor');
      cliLocal = cliente();
      const avisos = [];
      if (!perfil.verificado) avisos.push('El perfil es una plantilla NO verificada contra su versión de NCE: confírmelo con la guía de la interfaz.');
      if (config.baseUrl.startsWith('https') && !config.tlsVerify) avisos.push('La verificación del certificado TLS está desactivada (solo para pruebas).');
      return { detalle: `${config.baseUrl} · perfil «${perfil.nombre}»`, avisos };
    })
      && await paso('Autenticación', async () => { const r = await cliLocal.autenticar(); return { detalle: perfil.autenticacion.tipo === 'token' ? `Token obtenido (vence en ${Math.round((r.expira_seg ?? 0) / 60)} min)` : `Sin token (${perfil.autenticacion.tipo})` }; })
      && await paso('Consulta de alarmas', async () => { const r = await cliLocal.consultarAlarmas(); crudas = r.crudas; return { detalle: `${crudas.length} alarma(s) recibida(s) en ${r.paginas} página(s)` }; })
      && await paso('Interpretación', async () => {
        ({ alarmas, descartadas } = interpretarLista(crudas, perfil));
        if (crudas.length && !alarmas.length) throw new ErrorNCE('FORMATO', `Ninguna de las ${crudas.length} alarmas se pudo interpretar: revise «campos» en el perfil`, `Primera alarma recibida, campos: ${Object.keys(crudas[0] ?? {}).join(', ')}`);
        return { detalle: `${alarmas.length} interpretada(s)${descartadas.length ? `, ${descartadas.length} descartada(s) (${descartadas[0].motivo})` : ''}` };
      })
      && await paso('Correspondencia con enlaces', async () => {
        const rel = relacionar(alarmas);
        const con = rel.filter((a) => a.enlace).length;
        return { detalle: `${con} alarma(s) asociada(s) a un enlace, ${rel.length - con} sin correspondencia (${reglas.length} regla(s) cargada(s))` };
      });
    for (const n of ['Configuración', 'Autenticación', 'Consulta de alarmas', 'Interpretación', 'Correspondencia con enlaces']) if (!pasos.some((p) => p.paso === n)) pasos.push({ paso: n, ok: null, omitido: true });
    return {
      ok: sigue === true,
      pasos,
      muestra: { cruda: redactar(crudas.slice(0, 2)), interpretadas: relacionar(alarmas.slice(0, 5)) },
    };
  }

  function iniciar() {
    if (!config.habilitado || !config.baseUrl || temporizador) return;
    const ciclo = async () => {
      await sincronizar();
      // tras fallos seguidos se espacian los intentos (hasta 5 veces el intervalo) para no insistir sobre un NCE caído
      const espera = config.pollSeg * 1000 * Math.min(5, 1 + e.errores_seguidos);
      temporizador = setTimeout(ciclo, espera);
      temporizador.unref?.();
    };
    ciclo();
  }
  const detener = () => { clearTimeout(temporizador); temporizador = null; };

  const estado = () => ({
    habilitado: Boolean(config.habilitado), configurado: Boolean(config.baseUrl),
    url_base: config.baseUrl || null, usuario: config.usuario || null, clave_configurada: Boolean(config.clave),
    tls_verificado: config.baseUrl?.startsWith('https') ? config.tlsVerify : null, ca_propia: Boolean(config.ca),
    intervalo_seg: config.pollSeg, timeout_seg: Math.round(config.timeoutMs / 1000),
    perfil: { nombre: perfil.nombre, verificado: perfil.verificado, autenticacion: perfil.autenticacion.tipo, notas: perfil.notas ?? null },
    correspondencias: reglas.length,
    sincronizando: e.sincronizando, ultima_ok: e.ultima_ok, ultima_duracion_ms: e.ultima_duracion_ms, ultimo_error: e.ultimo_error, errores_seguidos: e.errores_seguidos,
    total_alarmas: e.alarmas.length, descartadas: e.descartadas,
  });

  return { sincronizar, probar, iniciar, detener, estado, alarmas: () => e.alarmas };
}
