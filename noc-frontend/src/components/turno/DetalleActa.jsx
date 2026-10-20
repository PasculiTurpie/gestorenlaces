import { FileText, Loader2 } from 'lucide-react';
import { useEffect, useState } from 'react';
import { api } from '../../lib/api.js';
import { describirError } from '../../lib/errores.js';
import { fechaDia, fechaHora } from '../../lib/format.js';
import { duracionTurnoMin, fmtDuracion, normalizarActa, resumenActa } from '../../lib/turno.js';
import { useTopology } from '../../store/topologyStore.js';
import { Aviso, Boton, Dialogo } from '../admin/ui.jsx';
import ChecklistTabla from './ChecklistTabla.jsx';

/** Acta del historial, de solo lectura, con acceso a la vista imprimible. */
export default function DetalleActa({ actaId, onImprimir, onClose }) {
  const enlaces = useTopology((s) => s.enlaces);
  const [acta, setActa] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    let vigente = true;
    api.turno(actaId).then(({ data }) => vigente && setActa(normalizarActa(data))).catch((e) => vigente && setError(describirError(e)));
    return () => { vigente = false; };
  }, [actaId]);

  const r = acta && resumenActa(acta);
  return (
    <Dialogo titulo={acta ? `Turno ${acta.tipo_turno.toLowerCase()} del ${fechaDia(acta.fecha_turno)} · ${acta.operador?.nombre ?? ''}` : 'Acta de turno'} descripcion={acta ? `${fechaHora(acta.fecha_inicio)} → ${acta.fecha_fin ? fechaHora(acta.fecha_fin) : 'en curso'} (${fmtDuracion(duracionTurnoMin(acta))})` : undefined} onClose={onClose} ancho="max-w-4xl">
      {error && <Aviso>{error}</Aviso>}
      {!acta && !error && <p className="flex items-center gap-2 text-sm text-noc-muted"><Loader2 size={15} className="animate-spin" /> Cargando acta…</p>}
      {acta && (
        <>
          <p className="mb-3 text-sm text-noc-muted">{r.total} enlace(s) recibidos · {r.gestionados} gestionados{acta.cerrado ? '' : ' · turno todavía abierto'}</p>
          <ChecklistTabla items={acta.items} editable={false} estadoActual={(i) => (i.enlaceId ? enlaces[i.enlaceId] : null)} />
          <h3 className="mb-1 mt-4 text-sm font-semibold">Bitácora general</h3>
          <p className="whitespace-pre-wrap rounded-md border border-noc-line px-3 py-2 text-sm">{acta.bitacora_general || <span className="text-noc-muted">Sin observaciones.</span>}</p>
          <div className="mt-4 flex justify-end gap-2">
            <Boton onClick={onClose}>Cerrar</Boton>
            <Boton variante="primario" onClick={() => onImprimir(acta._id)}><FileText size={14} /> Vista imprimible</Boton>
          </div>
        </>
      )}
    </Dialogo>
  );
}
