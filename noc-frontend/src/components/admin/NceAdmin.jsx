import { AlertTriangle, ExternalLink, PlugZap, RefreshCw, RotateCcw } from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useNow } from '../../hooks/useNow.js';
import { api } from '../../lib/api.js';
import { describirError } from '../../lib/errores.js';
import { cn, fechaHora, hace } from '../../lib/format.js';
import { VARIABLES_ENV, enriquecerAlarmas, estadoConexion, marcaPaso, resumenAlarmas } from '../../lib/nce.js';
import { useAuth } from '../../store/authStore.js';
import { useTopology } from '../../store/topologyStore.js';
import EstadoBadge from '../EstadoBadge.jsx';
import { Aviso, Boton, Cabecera, Insignia } from './ui.jsx';

const COLOR = { ok: '#22c55e', warn: '#f97316', error: '#ef4444', muted: '#8296ab' };

function Dato({ etiqueta, children }) {
  return <div className="min-w-0"><dt className="text-xs text-noc-muted">{etiqueta}</dt><dd className="mt-0.5 break-words text-sm">{children}</dd></div>;
}

/** Conexión con iMaster NCE (solo lectura): estado, prueba paso a paso y las alarmas leídas, relacionadas con los enlaces. */
export default function NceAdmin() {
  const rol = useAuth((s) => s.user?.rol);
  const navigate = useNavigate();
  const ahora = useNow();
  const catalogo = useTopology((s) => s.alarmas);
  const enlaces = useTopology((s) => s.enlaces);
  const [est, setEst] = useState(null);
  const [alarmas, setAlarmas] = useState([]);
  const [error, setError] = useState(null);
  const [prueba, setPrueba] = useState(null);
  const [trabajando, setTrabajando] = useState(null); // 'probar' | 'leer' | 'recargar'

  const cargar = useCallback(async () => {
    try {
      const [e, a] = await Promise.all([api.nceEstado(), api.nceAlarmas()]);
      setEst(e.data); setAlarmas(a.data); setError(null);
    } catch (err) { setError(describirError(err)); }
  }, []);
  useEffect(() => { cargar(); const t = setInterval(cargar, 15000); return () => clearInterval(t); }, [cargar]); // se mantiene al día mientras la pantalla está abierta

  async function accion(clave, fn) {
    setTrabajando(clave); setError(null);
    try { await fn(); await cargar(); } catch (err) { setError(describirError(err)); }
    setTrabajando(null);
  }
  const probar = () => accion('probar', async () => setPrueba((await api.nceProbar()).data));
  const leer = () => accion('leer', () => api.nceSincronizar());
  const recargar = () => accion('recargar', async () => { await api.nceRecargar(); setPrueba(null); });

  const conexion = estadoConexion(est);
  const lista = useMemo(() => enriquecerAlarmas(alarmas, catalogo, enlaces), [alarmas, catalogo, enlaces]);
  const resumen = resumenAlarmas(lista);
  const abrirEnlace = (l) => { useTopology.getState().seleccionarEnlace(l._id); navigate('/'); };

  return (
    <>
      <Cabecera
        titulo="Integración con iMaster NCE"
        descripcion="La aplicación lee las alarmas de NCE y las relaciona con sus enlaces. Es solo lectura: no cambia nada en NCE ni modifica estados por sí sola."
        acciones={(
          <div className="flex flex-wrap gap-2">
            <Boton variante="primario" onClick={probar} cargando={trabajando === 'probar'}><PlugZap size={14} /> Probar conexión</Boton>
            <Boton onClick={leer} cargando={trabajando === 'leer'} disabled={!est?.configurado}><RefreshCw size={14} /> Leer alarmas ahora</Boton>
            {rol === 'Admin' && <Boton onClick={recargar} cargando={trabajando === 'recargar'} title="Vuelve a leer el perfil y las correspondencias"><RotateCcw size={14} /> Recargar perfil</Boton>}
          </div>
        )}
      />
      {error && <Aviso>{error}</Aviso>}
      {est?.error_configuracion && <Aviso>{est.error_configuracion}</Aviso>}

      <section aria-label="Estado de la conexión" className="mb-5 rounded-lg border border-noc-line bg-noc-panel p-4">
        <div className="mb-3 flex flex-wrap items-center gap-3">
          <h2 className="text-sm font-semibold">Estado</h2>
          <Insignia color={COLOR[conexion.nivel]}>{conexion.etiqueta}</Insignia>
          {est?.perfil && !est.perfil.verificado && <Insignia color={COLOR.warn}><AlertTriangle size={11} className="mr-1" /> Perfil no verificado</Insignia>}
        </div>
        {est && !est.error_configuracion && (
          <dl className="grid gap-x-6 gap-y-3 sm:grid-cols-2 lg:grid-cols-3">
            <Dato etiqueta="Dirección de NCE">{est.url_base ? <span className="font-mono text-xs">{est.url_base}</span> : <span className="text-noc-muted">Sin configurar</span>}</Dato>
            <Dato etiqueta="Usuario de integración">{est.usuario ?? <span className="text-noc-muted">—</span>} {est.clave_configurada && <span className="text-xs text-noc-muted">· contraseña configurada</span>}</Dato>
            <Dato etiqueta="Certificado (TLS)">{est.tls_verificado === null ? <span className="text-noc-muted">No aplica (HTTP)</span> : est.tls_verificado ? `Verificado${est.ca_propia ? ' con certificado propio' : ''}` : <span className="text-orange-300">Sin verificar (solo pruebas)</span>}</Dato>
            <Dato etiqueta="Última lectura">{est.ultima_ok ? <>{hace(est.ultima_ok, ahora)} <span className="text-xs text-noc-muted">· {fechaHora(est.ultima_ok)} · {est.ultima_duracion_ms} ms</span></> : <span className="text-noc-muted">Todavía ninguna</span>}</Dato>
            <Dato etiqueta="Se lee cada">{est.intervalo_seg} s <span className="text-xs text-noc-muted">· espera máx. {est.timeout_seg} s</span></Dato>
            <Dato etiqueta="Perfil de conexión">{est.perfil.nombre} <span className="text-xs text-noc-muted">· autenticación: {est.perfil.autenticacion}</span></Dato>
            <Dato etiqueta="Correspondencias con enlaces">{est.correspondencias} regla(s)</Dato>
            <Dato etiqueta="Alarmas leídas">{est.total_alarmas}{est.descartadas > 0 && <span className="text-xs text-noc-muted"> · {est.descartadas} descartada(s)</span>}</Dato>
          </dl>
        )}
        {est?.ultimo_error && (
          <div role="alert" className="mt-3 rounded-md border border-estado-down/40 bg-estado-down/10 px-3 py-2 text-sm text-red-300">
            <b className="font-medium">{est.ultimo_error.mensaje}</b>
            <span className="ml-2 text-xs text-red-300/70">{hace(est.ultimo_error.en, ahora)} · {est.errores_seguidos} intento(s) seguido(s)</span>
            {est.ultimo_error.detalle && <p className="mt-0.5 text-xs text-red-300/80">{est.ultimo_error.detalle}</p>}
          </div>
        )}
        {est?.perfil && !est.perfil.verificado && (
          <p className="mt-3 rounded-md border border-estado-deg/40 bg-estado-deg/10 px-3 py-2 text-xs text-orange-200">
            El perfil de conexión es una <b className="font-medium">plantilla de ejemplo</b>. La API real de su versión de iMaster NCE puede ser distinta: ajuste rutas, autenticación y nombres de campo en <span className="font-mono">config/nce.perfil.ejemplo.json</span> según la guía de la interfaz, y luego use «Recargar perfil».
          </p>
        )}
        {est && !est.configurado && (
          <div className="mt-3 text-sm">
            <p className="mb-2 text-noc-muted">La conexión se configura en el archivo <span className="font-mono">.env</span> del servidor (las credenciales nunca pasan por esta pantalla). Después, reinicie el servidor:</p>
            <pre className="overflow-auto rounded-md border border-noc-line bg-noc-bg/60 p-3 font-mono text-xs leading-relaxed">{VARIABLES_ENV.map(([k, v, d]) => `${k}=${v}`.padEnd(46) + `# ${d}`).join('\n')}</pre>
          </div>
        )}
      </section>

      {prueba && (
        <section aria-label="Prueba de conexión" className="mb-5 rounded-lg border border-noc-line bg-noc-panel p-4">
          <div className="mb-3 flex items-center gap-3"><h2 className="text-sm font-semibold">Prueba de conexión</h2><Insignia color={prueba.ok ? COLOR.ok : COLOR.error}>{prueba.ok ? 'Todo en orden' : 'Falló'}</Insignia></div>
          <ol className="space-y-2">
            {prueba.pasos.map((p) => (
              <li key={p.paso} className="flex gap-3 text-sm">
                <span aria-label={p.omitido ? 'Omitido' : p.ok ? 'Correcto' : 'Falló'} className={cn('mt-0.5 w-4 shrink-0 text-center font-bold', p.omitido ? 'text-noc-muted' : p.ok ? 'text-green-400' : 'text-red-400')}>{marcaPaso(p)}</span>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-baseline gap-x-2"><span className={cn('font-medium', p.omitido && 'text-noc-muted')}>{p.paso}</span>{!p.omitido && <span className="text-xs tabular-nums text-noc-muted">{p.ms} ms</span>}</div>
                  {p.detalle && <p className={cn('text-xs', p.ok ? 'text-noc-muted' : 'text-red-300')}>{p.detalle}</p>}
                  {p.ayuda && <p className="text-xs text-noc-muted">{p.ayuda}</p>}
                  {p.avisos?.map((a) => <p key={a} className="mt-0.5 text-xs text-orange-300">⚠ {a}</p>)}
                </div>
              </li>
            ))}
          </ol>
          {prueba.ok && prueba.muestra.interpretadas.length > 0 && (
            <details className="mt-4 text-sm">
              <summary className="cursor-pointer text-noc-focus">Ver una alarma tal como la entrega NCE y cómo la interpreta la app</summary>
              <div className="mt-2 grid gap-3 lg:grid-cols-2">
                <div><p className="mb-1 text-xs text-noc-muted">Como llega de NCE (datos sensibles ocultos)</p><pre className="max-h-56 overflow-auto rounded-md border border-noc-line bg-noc-bg/60 p-2 font-mono text-[11px]">{JSON.stringify(prueba.muestra.cruda[0], null, 2)}</pre></div>
                <div><p className="mb-1 text-xs text-noc-muted">Como la interpreta la app</p><pre className="max-h-56 overflow-auto rounded-md border border-noc-line bg-noc-bg/60 p-2 font-mono text-[11px]">{JSON.stringify(prueba.muestra.interpretadas[0], null, 2)}</pre></div>
              </div>
            </details>
          )}
        </section>
      )}

      <section aria-label="Alarmas leídas de NCE">
        <div className="mb-2 flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="text-sm font-semibold">Alarmas leídas de NCE <span className="font-normal text-noc-muted">{resumen.total}</span></h2>
          {resumen.total > 0 && <p className="text-xs text-noc-muted">{resumen.conEnlace} relacionada(s) con un enlace · {resumen.sinEnlace} sin correspondencia · {resumen.sinTipificar} sin tipificar en la app</p>}
        </div>
        {lista.length === 0 ? (
          <p className="rounded-lg border border-dashed border-noc-line px-4 py-8 text-center text-sm text-noc-muted">{est?.ultima_ok ? 'NCE no tiene alarmas activas.' : 'Todavía no se ha leído ninguna alarma.'}</p>
        ) : (
          <div className="overflow-auto rounded-lg border border-noc-line">
            <table className="w-full text-left text-sm">
              <thead className="bg-noc-raised text-xs text-noc-muted"><tr>{['Alarma', 'Severidad en NCE', 'Equipo y ubicación', 'Desde', 'Enlace en la app'].map((c) => <th key={c} className="px-3 py-2 font-medium">{c}</th>)}</tr></thead>
              <tbody className="divide-y divide-noc-line">
                {lista.map((a) => (
                  <tr key={a.id} className="align-top">
                    <td className="px-3 py-2"><div className="font-mono text-xs">{a.codigo}</div><div className={cn('text-xs', a.tipificacion ? 'text-noc-muted' : 'text-orange-300')}>{a.tipificacion ? a.tipificacion.nombre : 'Sin tipificar en la app'}</div></td>
                    <td className="px-3 py-2"><div>{a.severidad_nce}</div>{a.estado_sugerido && <div className="mt-0.5"><EstadoBadge estado={a.estado_sugerido} /></div>}</td>
                    <td className="px-3 py-2"><div className="font-mono text-xs">{a.equipo}</div><div className="text-xs text-noc-muted">{a.ubicacion}</div></td>
                    <td className="whitespace-nowrap px-3 py-2 text-xs text-noc-muted">{a.inicio ? hace(a.inicio, ahora) : '—'}</td>
                    <td className="px-3 py-2">
                      {a.enlace ? (
                        <div><span className="font-mono text-xs">{a.enlace.enlace}</span>{a.enlace.sentido && <span className="ml-1 text-xs text-noc-muted">· {a.enlace.sentido}</span>}
                          {a.enlaceApp ? <button type="button" onClick={() => abrirEnlace(a.enlaceApp)} aria-label={`Abrir ${a.enlace.enlace}`} className="mt-0.5 flex items-center gap-1 text-xs text-noc-focus hover:underline"><ExternalLink size={11} /> Abrir enlace</button> : <div className="text-xs text-orange-300">No existe en la app</div>}</div>
                      ) : <span className="text-xs text-noc-muted">Sin correspondencia</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </>
  );
}
