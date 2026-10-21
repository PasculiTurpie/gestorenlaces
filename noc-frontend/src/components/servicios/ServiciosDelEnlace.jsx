import { Layers } from 'lucide-react';
import { useEffect, useState } from 'react';
import { api } from '../../lib/api.js';
import { describirError } from '../../lib/errores.js';
import { useAuth } from '../../store/authStore.js';
import { useTopology } from '../../store/topologyStore.js';
import { Aviso } from '../admin/ui.jsx';

/** Qué servicios pasan por este enlace (los que se ven afectados si falla o entra en mantenimiento). */
export default function ServiciosDelEnlace({ enlace }) {
  const total = useTopology((s) => s.serviciosPorEnlace[enlace._id] ?? 0); // cambia cuando alguien carga o edita servicios
  const rol = useAuth((s) => s.user?.rol);
  const [est, setEst] = useState({ cargando: true, lista: [], error: null });
  const afectados = enlace.estado !== 'OK';

  useEffect(() => {
    let vigente = true;
    setEst((e) => ({ ...e, cargando: true, error: null }));
    api.servicios({ enlace: enlace._id, limit: 200 })
      .then((r) => vigente && setEst({ cargando: false, lista: r.data, error: null }))
      .catch((e) => vigente && setEst({ cargando: false, lista: [], error: describirError(e) }));
    return () => { vigente = false; };
  }, [enlace._id, total]);

  return (
    <section aria-label="Servicios del enlace" className="mb-5">
      <h3 className="mb-2 flex items-center gap-2 text-sm font-semibold">
        <Layers size={14} className={afectados && est.lista.length ? 'text-orange-300' : 'text-noc-muted'} aria-hidden="true" />
        {afectados ? 'Servicios afectados' : 'Servicios que pasan por este enlace'}
        {!est.cargando && <span className="font-normal text-noc-muted">{est.lista.length}</span>}
      </h3>
      {est.error && <Aviso>{est.error}</Aviso>}
      {est.cargando && !est.lista.length && <p className="text-sm text-noc-muted">Cargando…</p>}
      {!est.cargando && !est.error && est.lista.length === 0 && (
        <p className="rounded-md border border-dashed border-noc-line px-3 py-3 text-sm text-noc-muted">
          No hay servicios registrados en este enlace.{(rol === 'Supervisor' || rol === 'Admin') && ' Se cargan en Administración → Servicios.'}
        </p>
      )}
      {est.lista.length > 0 && (
        <ul className="max-h-52 divide-y divide-noc-line overflow-auto rounded-md border border-noc-line">
          {est.lista.map((s) => (
            <li key={s._id} className="px-3 py-2">
              <div className="flex flex-wrap items-baseline justify-between gap-x-3">
                <span className="text-sm font-medium">{s.nombre}</span>
                <span className="text-xs text-noc-muted">{[s.cliente, s.tipo, s.capacidad].filter(Boolean).join(' · ')}</span>
              </div>
              {s.observacion && <p className="mt-0.5 text-xs text-noc-muted">{s.observacion}</p>}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
