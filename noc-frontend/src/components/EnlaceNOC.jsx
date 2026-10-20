import { BaseEdge, EdgeLabelRenderer } from '@xyflow/react';
import { memo, useState } from 'react';
import { ESTADO_META, estiloEnlace } from '../lib/estados.js';
import { desplazamientoTarjeta, puntoEnTrazado, trazadoEnlace, trazadoFilamento } from '../lib/geometria.js';
import { useTopology } from '../store/topologyStore.js';
import MarcadorMedio from './MarcadorMedio.jsx';
import TarjetaFilamentos, { TARJETA } from './TarjetaFilamentos.jsx';

const SEPARACION = 7; // px entre cada filamento y el eje del enlace

function Flecha({ x, y, ang, color }) {
  return <path d="M -4.5 -3.5 L 4.5 0 L -4.5 3.5 z" transform={`translate(${x} ${y}) rotate(${ang})`} fill={color} className="pointer-events-none" />;
}

function EnlaceNOC({ id, sourceX: sx, sourceY: sy, targetX: tx, targetY: ty, data, selected }) {
  const [hover, setHover] = useState(false);
  const { estado, offset, expandido, tipo, filamentos, id_enlace } = data;
  const base = trazadoEnlace(sx, sy, tx, ty, offset);
  const { className, ...estilo } = estiloEnlace(estado, selected || hover);
  const color = ESTADO_META[estado]?.color ?? '#22c55e';

  const alternar = () => useTopology.getState().toggleExpandido(id);
  const abrir = () => useTopology.getState().seleccionarEnlace(id);

  // Desplegado: la línea se reemplaza por dos filamentos paralelos (ida: origen→destino, vuelta: destino→origen)
  const estadoDe = (sentido) => filamentos.find((f) => f.sentido === sentido)?.estado ?? estado;
  const fil = expandido
    ? [
        { sentido: 'ida', t: trazadoFilamento(sx, sy, tx, ty, offset, SEPARACION), invertir: false, posicion: 0.66 },
        { sentido: 'vuelta', t: trazadoFilamento(sx, sy, tx, ty, offset, -SEPARACION), invertir: true, posicion: 0.34 },
      ]
    : null;
  // La tarjeta crece una línea por cada filamento alarmado (estado + tipificación)
  const alarmados = filamentos.filter((f) => f.estado !== 'OK');
  const tarjeta = expandido ? desplazamientoTarjeta(sx, sy, tx, ty, TARJETA.w, TARJETA.h + 14 * alarmados.length, 16) : null;
  // Alarma en UN solo filamento: el «+» lo señala con un punto del color de ese estado
  const parcial = alarmados.length === 1 ? { sentido: alarmados[0].sentido, color: ESTADO_META[alarmados[0].estado].color } : null;

  return (
    <g onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)}>
      {fil ? (
        fil.map(({ sentido, t, invertir, posicion }) => {
          const flecha = puntoEnTrazado(t.p, posicion, invertir);
          // cada filamento se dibuja con el estilo de SU estado: uno caído (rojo punteado) y el otro OK (verde)
          const { className: claseFil, ...estiloFil } = estiloEnlace(estadoDe(sentido), selected || hover);
          return (
            <g key={sentido}>
              <BaseEdge id={`${id}-${sentido}`} path={t.path} style={{ ...estiloFil, strokeWidth: Math.max(1.3, estiloFil.strokeWidth - 0.7) }} className={claseFil} interactionWidth={10} />
              <Flecha {...flecha} color={estiloFil.stroke} />
            </g>
          );
        })
      ) : (
        <BaseEdge id={id} path={base.path} style={estilo} className={className} interactionWidth={18} />
      )}

      <EdgeLabelRenderer>
        <MarcadorMedio x={base.labelX} y={base.labelY} expandido={expandido} tipo={tipo} idEnlace={id_enlace} onToggle={alternar} parcial={parcial} />
        {expandido && (
          <TarjetaFilamentos x={base.labelX + tarjeta.x} y={base.labelY + tarjeta.y} idEnlace={id_enlace} tipo={tipo} filamentos={filamentos} onAbrir={abrir} />
        )}
        {!expandido && (hover || selected) && (
          <div
            className="pointer-events-none absolute rounded border bg-noc-bg px-1.5 py-0.5 font-mono text-[11px] text-noc-text"
            style={{ transform: `translate(-50%, -50%) translate(${base.labelX}px, ${base.labelY - 16}px)`, borderColor: color }}
          >
            {id_enlace}
            {tipo && !tipo.propio && <span style={{ color: tipo.color }}> · {tipo.nombre}</span>}
          </div>
        )}
      </EdgeLabelRenderer>
    </g>
  );
}

export default memo(EnlaceNOC);
