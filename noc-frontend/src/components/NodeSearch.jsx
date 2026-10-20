import { Search } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useFocus } from '../hooks/useFocus.js';
import { buscarNodos } from '../lib/selectors.js';
import { useTopology } from '../store/topologyStore.js';

export default function NodeSearch() {
  const nodos = useTopology((s) => s.nodos);
  const foco = useFocus();
  const [texto, setTexto] = useState('');
  const [abierto, setAbierto] = useState(false);
  const resultados = useMemo(() => buscarNodos(nodos, texto), [nodos, texto]);

  function elegir(n) {
    foco.nodo(n.id_nodo);
    useTopology.getState().seleccionarNodo(n.id_nodo);
    setTexto('');
    setAbierto(false);
  }

  return (
    <div className="relative w-64 max-w-full">
      <Search size={15} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-noc-muted" />
      <input
        type="search" value={texto} placeholder="Buscar nodo (ej. VLDV)"
        aria-label="Buscar nodo" role="combobox" aria-expanded={abierto && resultados.length > 0}
        onChange={(e) => { setTexto(e.target.value); setAbierto(true); }}
        onFocus={() => setAbierto(true)}
        onBlur={() => setTimeout(() => setAbierto(false), 120)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && resultados[0]) elegir(resultados[0]);
          if (e.key === 'Escape') setAbierto(false);
        }}
        className="w-full rounded-md border border-noc-line bg-noc-bg py-1.5 pl-8 pr-2 text-sm placeholder:text-noc-muted/70"
      />
      {abierto && resultados.length > 0 && (
        <ul role="listbox" className="absolute z-30 mt-1 max-h-72 w-full overflow-auto rounded-md border border-noc-line bg-noc-panel py-1 shadow-xl">
          {resultados.map((n) => (
            <li key={n.id_nodo} role="option" aria-selected="false">
              <button
                type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => elegir(n)}
                className="flex w-full items-baseline justify-between gap-3 px-3 py-1.5 text-left text-sm hover:bg-noc-raised"
              >
                <span className="font-mono">{n.id_nodo}</span>
                <span className="text-xs text-noc-muted">{n.tipo === 'ESTACION' ? 'Estación' : n.tipo}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
