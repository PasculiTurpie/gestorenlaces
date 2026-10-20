import { useEffect, useMemo, useState } from 'react';
import { api } from '../../lib/api.js';
import { describirError } from '../../lib/errores.js';
import { fmtDuracion } from '../../lib/turno.js';
import { OBJETIVOS, agregarPorTipo, etiquetaMes, filtrarFilas, filtrarIncidencias, fmtPct, fmtPctCorto, leerMes, mesComoTexto, promedioUptime, resumenFilas, resumenIncidencias, resumenPorTipificacion, ultimosMeses } from '../../lib/indicadores.js';
import { useTopology } from '../../store/topologyStore.js';
import { Insignia, Aviso, entrada, entradaAuto } from '../admin/ui.jsx';
import { GraficoFallas, GraficoTendencia } from './Graficos.jsx';
import TablaIncidencias from './TablaIncidencias.jsx';
import TablaMetricas from './TablaMetricas.jsx';

const mesActual = () => { const d = new Date(); return mesComoTexto({ year: d.getFullYear(), month: d.getMonth() + 1 }); };
const guardado = (clave, defecto) => { try { return JSON.parse(localStorage.getItem(clave)) ?? defecto; } catch { return defecto; } };
const guardar = (clave, valor) => { try { localStorage.setItem(clave, JSON.stringify(valor)); } catch { /* almacenamiento no disponible */ } };

async function cargarIncidencias(desde, hasta) {
  const todas = [];
  for (let page = 1; page <= 5; page++) { // hasta 1.000 incidencias del período
    const q = new URLSearchParams({ desde, hasta, limit: '200', page: String(page) });
    const { data, meta } = await api.incidencias(q.toString());
    todas.push(...data);
    if (page >= meta.paginas) break;
  }
  return todas;
}

function Panel({ titulo, descripcion, children, className = '' }) {
  return (
    <section aria-label={titulo} className={`rounded-lg border border-noc-line bg-noc-panel p-4 ${className}`}>
      <h2 className="text-sm font-semibold">{titulo}</h2>
      {descripcion && <p className="mb-3 text-xs text-noc-muted">{descripcion}</p>}
      {!descripcion && <div className="mb-3" />}
      {children}
    </section>
  );
}

function Indicador({ etiqueta, valor, detalle, tono }) {
  const color = tono === 'bien' ? 'text-estado-ok' : tono === 'mal' ? 'text-red-300' : 'text-noc-text';
  return (
    <div className="rounded-lg border border-noc-line bg-noc-panel px-4 py-3">
      <div className="text-xs text-noc-muted">{etiqueta}</div>
      <div className={`mt-1 font-mono text-2xl font-medium leading-none tabular-nums ${color}`}>{valor}</div>
      <div className="mt-1.5 text-xs text-noc-muted">{detalle}</div>
    </div>
  );
}

export default function IndicadoresPage() {
  const enlaces = useTopology((s) => s.enlaces);
  const tipos = useTopology((s) => s.tipos);
  const zonales = useTopology((s) => s.zonales);

  const [mes, setMes] = useState(mesActual);
  const [objetivo, setObjetivo] = useState(() => guardado('noc-objetivo', 99.9));
  const [incluirDegradado, setIncluirDegradado] = useState(false);
  const [tipo, setTipo] = useState('');
  const [zonal, setZonal] = useState('');
  const [datos, setDatos] = useState({ cargando: true, filas: [], meta: null, incidencias: [], error: null });
  const [tendencia, setTendencia] = useState([]); // [{ mes, filas }]

  const periodo = leerMes(mes);

  // Datos del mes: métricas por enlace + incidencias de la misma ventana (la fija el servidor, en la zona horaria de la operación)
  useEffect(() => {
    if (!periodo) return undefined;
    let vigente = true;
    setDatos((d) => ({ ...d, cargando: true, error: null }));
    (async () => {
      try {
        const m = await api.metricas(`year=${periodo.year}&month=${periodo.month}&incluirDegradado=${incluirDegradado}`);
        const incidencias = await cargarIncidencias(m.meta.desde, m.meta.hasta);
        if (vigente) setDatos({ cargando: false, filas: m.data, meta: m.meta, incidencias, error: null });
      } catch (err) {
        if (vigente) setDatos((d) => ({ ...d, cargando: false, error: describirError(err) }));
      }
    })();
    return () => { vigente = false; };
  }, [mes, incluirDegradado]); // eslint-disable-line react-hooks/exhaustive-deps

  // Tendencia: los 6 meses que terminan en el elegido (se carga aparte para no retrasar lo principal)
  useEffect(() => {
    if (!periodo) return undefined;
    let vigente = true;
    setTendencia([]);
    Promise.allSettled(ultimosMeses(periodo, 6).map(async (p) => ({ mes: etiquetaMes(p), filas: (await api.metricas(`year=${p.year}&month=${p.month}&incluirDegradado=${incluirDegradado}`)).data })))
      .then((r) => vigente && setTendencia(r.filter((x) => x.status === 'fulfilled').map((x) => x.value)));
    return () => { vigente = false; };
  }, [mes, incluirDegradado]); // eslint-disable-line react-hooks/exhaustive-deps

  const filtro = { tipo, zonal };
  const filas = useMemo(() => filtrarFilas(datos.filas, enlaces, filtro), [datos.filas, enlaces, tipo, zonal]); // eslint-disable-line react-hooks/exhaustive-deps
  const resumen = useMemo(() => resumenFilas(filas, objetivo), [filas, objetivo]);
  const porTipo = useMemo(() => agregarPorTipo(filas, enlaces), [filas, enlaces]);
  const incidencias = useMemo(
    () => (datos.meta ? resumenIncidencias(filtrarIncidencias(datos.incidencias, enlaces, filtro), { desde: datos.meta.desde, hasta: datos.meta.hasta, incluirDegradado }) : null),
    [datos.incidencias, datos.meta, enlaces, tipo, zonal, incluirDegradado], // eslint-disable-line react-hooks/exhaustive-deps
  );
  const porTipificacion = useMemo(() => resumenPorTipificacion(incidencias?.lista ?? []), [incidencias]);
  const serie = useMemo(() => tendencia.map((t) => ({ mes: t.mes, uptime: promedioUptime(filtrarFilas(t.filas, enlaces, filtro)) })), [tendencia, enlaces, tipo, zonal]); // eslint-disable-line react-hooks/exhaustive-deps

  const cambiarObjetivo = (v) => { setObjetivo(v); guardar('noc-objetivo', v); };
  const enCurso = datos.meta && new Date(datos.meta.corte) < new Date(datos.meta.hasta);
  const cumple = resumen.uptimePromedio != null && resumen.uptimePromedio >= objetivo;

  return (
    <section className="min-w-0 flex-1 overflow-auto p-6 max-sm:p-4" aria-label="Indicadores">
      <div className="mx-auto max-w-6xl">
        <h1 className="text-lg font-semibold">Indicadores de disponibilidad</h1>
        <p className="mb-4 max-w-prose text-sm text-noc-muted">Uptime y tiempo medio de reparación (MTTR) de los enlaces. Por defecto solo cuentan como falla los períodos en estado Caído.</p>

        <div className="mb-4 flex flex-wrap items-end gap-3">
          <label className="text-sm">
            <span className="mb-1 block text-xs text-noc-muted">Mes</span>
            <input type="month" aria-label="Mes" value={mes} max={mesActual()} onChange={(e) => setMes(e.target.value)} className={`${entradaAuto}`} />
          </label>
          <label className="text-sm">
            <span className="mb-1 block text-xs text-noc-muted">Objetivo de disponibilidad</span>
            <select aria-label="Objetivo de disponibilidad" value={objetivo} onChange={(e) => cambiarObjetivo(Number(e.target.value))} className={`${entradaAuto}`}>
              {OBJETIVOS.map((o) => <option key={o} value={o}>{fmtPctCorto(o)}</option>)}
            </select>
          </label>
          <label className="text-sm">
            <span className="mb-1 block text-xs text-noc-muted">Tipo de línea</span>
            <select aria-label="Tipo de línea" value={tipo} onChange={(e) => setTipo(e.target.value)} className={`${entradaAuto}`}>
              <option value="">Todas</option>{tipos.map((t) => <option key={t.clave} value={t.clave}>{t.nombre}</option>)}
            </select>
          </label>
          {zonales.length > 0 && (
            <label className="text-sm">
              <span className="mb-1 block text-xs text-noc-muted">Zonal</span>
              <select aria-label="Zonal" value={zonal} onChange={(e) => setZonal(e.target.value)} className={`${entradaAuto}`}>
                <option value="">Todas</option>{zonales.map((z) => <option key={z._id} value={z._id}>{z.nombre}</option>)}
              </select>
            </label>
          )}
          <label className="flex items-center gap-2 pb-2 text-sm">
            <input type="checkbox" checked={incluirDegradado} onChange={(e) => setIncluirDegradado(e.target.checked)} />
            Contar «Degradado» como falla
          </label>
        </div>

        {!periodo && <Aviso>Elija un mes válido.</Aviso>}
        {datos.error && <Aviso>{datos.error}</Aviso>}
        {enCurso && <Aviso tipo="info">Mes en curso: el uptime se calcula sobre el tiempo transcurrido hasta ahora, no sobre el mes completo.</Aviso>}

        {datos.cargando && !datos.meta ? <p className="text-sm text-noc-muted">Calculando indicadores…</p> : (
          <div aria-busy={datos.cargando} className={datos.cargando ? 'opacity-60 transition-opacity' : 'transition-opacity'}>
            <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
              <Indicador etiqueta="Uptime promedio" valor={fmtPct(resumen.uptimePromedio)} tono={resumen.uptimePromedio == null ? undefined : cumple ? 'bien' : 'mal'}
                detalle={resumen.uptimePromedio == null ? 'Sin datos' : `${cumple ? 'Cumple' : 'No cumple'} el objetivo de ${fmtPctCorto(objetivo)}`} />
              <Indicador etiqueta="Enlaces bajo el objetivo" valor={`${resumen.bajoObjetivo} de ${resumen.enlaces}`} tono={resumen.bajoObjetivo ? 'mal' : 'bien'} detalle={`${resumen.sinFallas} sin ninguna falla`} />
              <Indicador etiqueta="Incidencias" valor={incidencias?.total ?? '—'} detalle={incidencias ? `${incidencias.abiertas} abierta(s) · ${fmtDuracion(resumen.minutosFalla)} de falla en total` : ''} />
              <Indicador etiqueta="MTTR" valor={fmtDuracion(incidencias?.mttr)} detalle={incidencias ? `${incidencias.cerradas} cerrada(s)${incidencias.sinCausa ? ` · ${incidencias.sinCausa} sin causa raíz` : ''}` : ''} />
            </div>

            <div className="mb-4 grid gap-4 lg:grid-cols-2">
              <Panel titulo="Enlaces más afectados" descripcion="Tiempo de falla del mes. Pase el cursor sobre una barra para ver el detalle."><GraficoFallas filas={filas} objetivo={objetivo} /></Panel>
              <Panel titulo="Tendencia del uptime" descripcion="Promedio de los enlaces seleccionados en los últimos 6 meses."><GraficoTendencia serie={serie} objetivo={objetivo} /></Panel>
            </div>

            <Panel titulo="Por tipo de línea" descripcion="Cómo se comporta cada tipo de línea (propia u otras telcos) en el período." className="mb-4">
              <div className="overflow-auto">
                <table className="w-full min-w-[480px] border-collapse text-sm">
                  <thead className="text-left text-xs text-noc-muted"><tr><th className="py-1.5 pr-3 font-medium">Tipo</th><th className="px-3 py-1.5 font-medium">Enlaces</th><th className="px-3 py-1.5 font-medium">Uptime promedio</th><th className="px-3 py-1.5 font-medium">Tiempo de falla</th></tr></thead>
                  <tbody>
                    {porTipo.map((t) => (
                      <tr key={t.clave} className="border-t border-noc-line/60">
                        <td className="py-2 pr-3"><Insignia color={t.color}>{t.nombre}</Insignia></td>
                        <td className="px-3 py-2 tabular-nums">{t.enlaces}</td>
                        <td className="px-3 py-2 font-mono tabular-nums">{fmtPct(t.uptime)}</td>
                        <td className="px-3 py-2 tabular-nums">{t.minutosFalla > 0 ? fmtDuracion(t.minutosFalla) : '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {porTipo.length === 0 && <p className="py-4 text-center text-sm text-noc-muted">Sin enlaces para los filtros elegidos.</p>}
              </div>
            </Panel>

            <Panel titulo="Por tipificación de alarma" descripcion="Qué tipos de alarma originan las incidencias del período. «Sin tipificar» son las que falta clasificar." className="mb-4">
              <div className="overflow-auto">
                <table className="w-full min-w-[480px] border-collapse text-sm">
                  <thead className="text-left text-xs text-noc-muted"><tr><th className="py-1.5 pr-3 font-medium">Alarma</th><th className="px-3 py-1.5 font-medium">Incidencias</th><th className="px-3 py-1.5 font-medium">Tiempo total</th><th className="px-3 py-1.5 font-medium">MTTR</th></tr></thead>
                  <tbody>
                    {porTipificacion.map((t) => (
                      <tr key={t.codigo ?? 'sin'} className="border-t border-noc-line/60">
                        <td className="py-2 pr-3">{t.codigo ? <><span className="mr-2 rounded border border-noc-line-strong bg-noc-raised px-1.5 py-0.5 font-mono text-xs">{t.codigo}</span>{t.nombre}</> : <span className="text-estado-deg">{t.nombre}</span>}</td>
                        <td className="px-3 py-2 tabular-nums">{t.incidencias}</td>
                        <td className="px-3 py-2 tabular-nums">{t.minutos > 0 ? fmtDuracion(t.minutos) : '—'}</td>
                        <td className="px-3 py-2 tabular-nums">{fmtDuracion(t.mttr)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {porTipificacion.length === 0 && <p className="py-4 text-center text-sm text-noc-muted">No hubo incidencias en el período.</p>}
              </div>
            </Panel>

            <Panel titulo="Detalle por enlace" descripcion="Pulse el título de una columna para ordenar. El MTTR es la media de las incidencias cerradas que comenzaron en el mes." className="mb-4">
              <TablaMetricas filas={filas} objetivo={objetivo} />
            </Panel>

            <Panel titulo="Incidencias del período" descripcion="Las cerradas sin causa raíz quedan resaltadas: son el trabajo pendiente del análisis posterior.">
              <TablaIncidencias
                incidencias={incidencias?.lista ?? []}
                onActualizada={(inc) => setDatos((d) => ({ ...d, incidencias: d.incidencias.map((i) => (i._id === inc._id ? inc : i)) }))}
              />
            </Panel>
          </div>
        )}
      </div>
    </section>
  );
}
