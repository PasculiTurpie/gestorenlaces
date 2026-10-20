import { alarmasConProcedimiento } from '../../lib/alarmas.js';
import { ESTADO_META } from '../../lib/estados.js';
import { hace } from '../../lib/format.js';
import { useTopology } from '../../store/topologyStore.js';
import { Dialogo } from '../admin/ui.jsx';
import DetalleAlarma from './DetalleAlarma.jsx';

/** Procedimiento a seguir para las alarmas activas de un enlace (una ficha por filamento alarmado). */
export default function ProcedimientoDialog({ enlace, onClose }) {
  const catalogo = useTopology((s) => s.alarmas);
  const activas = alarmasConProcedimiento(enlace, catalogo);

  return (
    <Dialogo titulo={`Procedimiento · ${enlace.id_enlace}`} descripcion={`${enlace.origen} ⇄ ${enlace.destino}`} onClose={onClose} ancho="max-w-2xl">
      {activas.length === 0 ? (
        <p className="text-sm text-noc-muted">Este enlace tiene alarmas sin tipificar, por lo que no hay un procedimiento asociado. Al registrar el estado, elija el tipo de alarma para ver su procedimiento.</p>
      ) : (
        <div className="space-y-6">
          {activas.map(({ sentido, estado, desde, observacion, alarma, resumen }) => (
            <section key={sentido} aria-label={`Filamento de ${sentido}`}>
              <p className="mb-2 text-sm text-noc-muted">
                Filamento de <b className="font-medium text-noc-text">{sentido}</b> · <span style={{ color: ESTADO_META[estado].color }}>{ESTADO_META[estado].label}</span> {hace(desde)}
                {observacion && <> · «{observacion}»</>}
              </p>
              {alarma ? <DetalleAlarma alarma={alarma} compacto className="rounded-lg border border-noc-line p-4" /> : <p className="text-sm text-noc-muted">La tipificación «{resumen.codigo ?? resumen.nombre}» ya no está en el catálogo.</p>}
            </section>
          ))}
        </div>
      )}
    </Dialogo>
  );
}
