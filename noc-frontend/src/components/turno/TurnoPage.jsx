import { useState } from 'react';
import { cn } from '../../lib/format.js';
import HistorialTurnos from './HistorialTurnos.jsx';
import TurnoActual from './TurnoActual.jsx';

const VISTAS = [['actual', 'Turno actual'], ['historial', 'Historial']];

export default function TurnoPage() {
  const [vista, setVista] = useState('actual');
  return (
    <section className="min-w-0 flex-1 overflow-auto p-6 max-sm:p-4" aria-label="Turno">
      <div className="mx-auto max-w-5xl">
        <div className="mb-1 flex items-end justify-between gap-3">
          <h1 className="text-lg font-semibold">Cambio de turno</h1>
        </div>
        <p className="mb-4 max-w-prose text-sm text-noc-muted">Verifica los enlaces con falla que recibes, registra las acciones tomadas y deja el acta lista para quien entra.</p>
        <div role="tablist" aria-label="Vistas del turno" className="mb-5 flex gap-1 border-b border-noc-line">
          {VISTAS.map(([clave, etiqueta]) => (
            <button key={clave} type="button" role="tab" id={`vista-${clave}`} aria-selected={vista === clave} aria-controls={`panel-${clave}`} onClick={() => setVista(clave)}
              className={cn('-mb-px border-b-2 px-3 py-2 text-sm', vista === clave ? 'border-noc-focus text-noc-text' : 'border-transparent text-noc-muted hover:text-noc-text')}>
              {etiqueta}
            </button>
          ))}
        </div>
        <div role="tabpanel" id={`panel-${vista}`} aria-labelledby={`vista-${vista}`}>
          {vista === 'actual' ? <TurnoActual /> : <HistorialTurnos />}
        </div>
      </div>
    </section>
  );
}
