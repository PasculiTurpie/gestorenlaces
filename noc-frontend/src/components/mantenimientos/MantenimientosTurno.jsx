import { useMemo } from 'react';
import { useNow } from '../../hooks/useNow.js';
import { relevantes } from '../../lib/mantenimientos.js';
import { useTopology } from '../../store/topologyStore.js';
import { BloqueMantenimientos } from './Lista.jsx';

/** Para el cambio de turno: lo que se está trabajando y lo que empieza en las próximas 48 horas. */
export default function MantenimientosTurno({ className }) {
  const lista = useTopology((s) => s.mantenimientos);
  const ahora = useNow();
  const rel = useMemo(() => relevantes(lista, ahora, 48), [lista, ahora]);
  return <BloqueMantenimientos lista={rel} className={className} />;
}
