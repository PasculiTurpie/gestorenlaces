import { Bar, BarChart, CartesianGrid, Cell, Line, LineChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { estaBajoObjetivo, fmtPct, fmtPctCorto, peoresEnlaces } from '../../lib/indicadores.js';
import { fmtDuracion } from '../../lib/turno.js';

const EJE = { stroke: '#33465c', tick: { fill: '#8296ab', fontSize: 11 } };

function Vacio({ children }) {
  return <p className="flex h-40 items-center justify-center px-4 text-center text-sm text-noc-muted">{children}</p>;
}

function Tarjeta({ titulo, lineas }) {
  return (
    <div className="rounded-md border border-noc-line-strong bg-noc-panel px-3 py-2 text-xs shadow-xl">
      <div className="mb-1 font-mono text-noc-text">{titulo}</div>
      {lineas.map(([k, v]) => <div key={k} className="flex justify-between gap-4"><span className="text-noc-muted">{k}</span><span className="tabular-nums">{v}</span></div>)}
    </div>
  );
}

/** Enlaces con más minutos de falla. Rojo = por debajo del objetivo de disponibilidad; naranja = con fallas pero dentro del objetivo. */
export function GraficoFallas({ filas, objetivo }) {
  const datos = peoresEnlaces(filas, 12).map((f) => ({ nombre: f.id_enlace.replace(/^ENL-/, ''), minutos: f.minutos_falla, uptime: f.uptime_pct, incidentes: f.incidentes, bajo: estaBajoObjetivo(f, objetivo) }));
  if (!datos.length) return <Vacio>Ningún enlace registró fallas en el período.</Vacio>;
  const resumen = datos.slice(0, 3).map((d) => `${d.nombre} ${fmtDuracion(d.minutos)}`).join(', ');

  return (
    <div role="img" aria-label={`Tiempo de falla de los ${datos.length} enlaces más afectados. Los mayores: ${resumen}.`}>
      <ResponsiveContainer width="100%" height={Math.max(200, datos.length * 28 + 36)}>
        <BarChart data={datos} layout="vertical" margin={{ left: 4, right: 20, top: 4, bottom: 4 }}>
          <CartesianGrid stroke="#223043" horizontal={false} />
          <XAxis type="number" {...EJE} tickFormatter={fmtDuracion} />
          <YAxis type="category" dataKey="nombre" width={150} stroke="#33465c" tick={{ fill: '#d9e3ee', fontSize: 11, fontFamily: 'IBM Plex Mono, monospace' }} />
          <Tooltip cursor={{ fill: '#162030' }} content={({ active, payload }) => {
            if (!active || !payload?.length) return null;
            const d = payload[0].payload;
            return <Tarjeta titulo={d.nombre} lineas={[['Tiempo de falla', fmtDuracion(d.minutos)], ['Uptime', fmtPct(d.uptime)], ['Incidencias', d.incidentes], ['Objetivo', d.bajo ? 'No cumple' : 'Cumple']]} />;
          }} />
          <Bar dataKey="minutos" radius={[0, 3, 3, 0]} isAnimationActive={false}>
            {datos.map((d) => <Cell key={d.nombre} fill={d.bajo ? '#ef4444' : '#f97316'} />)}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
      <p className="mt-1 flex items-center gap-4 text-xs text-noc-muted">
        <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm bg-estado-down" /> Bajo el objetivo</span>
        <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm bg-estado-deg" /> Con fallas, dentro del objetivo</span>
      </p>
    </div>
  );
}

/** Uptime promedio mes a mes con la línea del objetivo. `serie`: [{ mes, uptime }] */
export function GraficoTendencia({ serie, objetivo }) {
  const conDatos = serie.filter((s) => s.uptime != null);
  if (!conDatos.length) return <Vacio>Aún no hay datos para mostrar la tendencia.</Vacio>;
  const resumen = serie.map((s) => `${s.mes} ${fmtPctCorto(s.uptime)}`).join(', ');

  return (
    <div role="img" aria-label={`Uptime promedio por mes. ${resumen}. Objetivo ${fmtPctCorto(objetivo)}.`}>
      <ResponsiveContainer width="100%" height={240}>
        <LineChart data={serie} margin={{ left: 0, right: 16, top: 12, bottom: 4 }}>
          <CartesianGrid stroke="#223043" vertical={false} />
          <XAxis dataKey="mes" {...EJE} />
          <YAxis {...EJE} width={64} domain={[(min) => Math.max(0, Math.floor((Math.min(min, objetivo) - 0.05) * 100) / 100), 100]} tickFormatter={fmtPctCorto} />
          <Tooltip content={({ active, payload }) => (active && payload?.length ? <Tarjeta titulo={payload[0].payload.mes} lineas={[['Uptime promedio', fmtPct(payload[0].payload.uptime)], ['Objetivo', fmtPctCorto(objetivo)]]} /> : null)} />
          <ReferenceLine y={objetivo} stroke="#7dd3fc" strokeDasharray="5 4" label={{ value: `Objetivo ${fmtPctCorto(objetivo)}`, fill: '#7dd3fc', fontSize: 11, position: 'insideBottomRight' }} />
          <Line type="monotone" dataKey="uptime" stroke="#22c55e" strokeWidth={2.2} dot={{ r: 3.5, fill: '#22c55e', stroke: '#090d12' }} connectNulls isAnimationActive={false} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
