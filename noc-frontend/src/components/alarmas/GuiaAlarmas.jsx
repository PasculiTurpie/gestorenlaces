import { Pencil, Search } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { ordenarAlarmas } from '../../lib/alarmas.js';
import { ESTADO_META } from '../../lib/estados.js';
import { cn } from '../../lib/format.js';
import { useAuth } from '../../store/authStore.js';
import { useTopology } from '../../store/topologyStore.js';
import { Boton, entrada } from '../admin/ui.jsx';
import DetalleAlarma from './DetalleAlarma.jsx';

const FILTROS = [['', 'Todas'], ['Caido', 'Caído'], ['Degradado', 'Degradado'], ['Mantenimiento', 'Mantenimiento']];

/** Guía de consulta: todas las tipificaciones con su significado y procedimiento. Para todos los roles. */
export default function GuiaAlarmas() {
  const alarmas = useTopology((s) => s.alarmas);
  const rol = useAuth((s) => s.user?.rol);
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const [q, setQ] = useState('');
  const [estado, setEstado] = useState('');

  const lista = useMemo(() => {
    const t = q.trim().toLowerCase();
    return ordenarAlarmas(
      alarmas
        .filter((a) => a.activo || rol === 'Admin')
        .filter((a) => (!estado || a.estado_sugerido === estado) && (!t || [a.codigo, a.nombre, a.significado].some((x) => x?.toLowerCase().includes(t)))),
    );
  }, [alarmas, q, estado, rol]);

  const elegidaId = params.get('alarma');
  const elegida = lista.find((a) => a._id === elegidaId || a.codigo === elegidaId) ?? lista[0];

  return (
    <section className="flex min-h-0 min-w-0 flex-1 max-md:flex-col" aria-label="Guía de alarmas">
      <aside className="flex w-80 shrink-0 flex-col border-r border-noc-line bg-noc-panel max-md:max-h-72 max-md:w-auto max-md:border-b max-md:border-r-0">
        <div className="border-b border-noc-line p-3">
          <h1 className="mb-2 text-base font-semibold">Guía de alarmas</h1>
          <div className="relative mb-2">
            <Search size={14} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-noc-muted" />
            <input type="search" aria-label="Buscar alarma" placeholder="Buscar por código o nombre" value={q} onChange={(e) => setQ(e.target.value)} className={`${entrada} py-1.5 pl-8`} />
          </div>
          <div className="flex flex-wrap gap-1" role="group" aria-label="Filtrar por estado">
            {FILTROS.map(([valor, etiqueta]) => (
              <button key={valor} type="button" aria-pressed={estado === valor} onClick={() => setEstado(valor)}
                className={cn('rounded-full border px-2.5 py-0.5 text-xs', estado === valor ? 'border-noc-focus/60 bg-noc-focus/10 text-noc-focus' : 'border-noc-line text-noc-muted hover:text-noc-text')}>
                {etiqueta}
              </button>
            ))}
          </div>
        </div>
        <ul className="min-h-0 flex-1 overflow-auto" aria-label="Alarmas">
          {lista.map((a) => (
            <li key={a._id}>
              <button type="button" onClick={() => setParams({ alarma: a._id }, { replace: true })} aria-current={elegida?._id === a._id}
                className={cn('flex w-full items-start gap-2.5 border-b border-noc-line/60 px-3 py-2.5 text-left hover:bg-noc-raised', elegida?._id === a._id && 'bg-noc-raised')}>
                <span aria-hidden="true" className="mt-1.5 h-2 w-2 shrink-0 rounded-full" style={{ background: ESTADO_META[a.estado_sugerido].color }} />
                <span className="min-w-0">
                  <span className="block font-mono text-xs text-noc-muted">{a.codigo}{!a.activo && ' · desactivada'}</span>
                  <span className="block text-sm">{a.nombre}</span>
                </span>
              </button>
            </li>
          ))}
          {lista.length === 0 && <li className="px-4 py-8 text-center text-sm text-noc-muted">{alarmas.length === 0 ? 'Todavía no hay tipificaciones. Un Administrador puede crearlas en Administración → Alarmas.' : 'Ninguna alarma coincide con la búsqueda.'}</li>}
        </ul>
      </aside>

      <div className="min-w-0 flex-1 overflow-auto p-6 max-sm:p-4">
        {elegida ? (
          <div className="mx-auto max-w-3xl">
            <DetalleAlarma alarma={elegida} />
            <p className="mt-4 text-xs text-noc-muted">
              {elegida.alarmas_activas > 0 ? `${elegida.alarmas_activas} alarma(s) activa(s) con este tipo ahora · ` : ''}{elegida.incidencias} incidencia(s) registradas
            </p>
            {rol === 'Admin' && <Boton className="mt-3" onClick={() => navigate(`/admin/alarmas?alarma=${elegida._id}`)}><Pencil size={13} /> Editar esta tipificación</Boton>}
          </div>
        ) : (
          <p className="text-sm text-noc-muted">Elija una alarma de la lista para ver su significado y el procedimiento a seguir.</p>
        )}
      </div>
    </section>
  );
}
