import { X } from 'lucide-react';
import { useTopology } from '../store/topologyStore.js';

const COLOR = { critico: '#ef4444', warn: '#f97316', ok: '#22c55e', info: '#7dd3fc' };

export default function Toasts() {
  const toasts = useTopology((s) => s.toasts);
  return (
    <div className="pointer-events-none fixed bottom-4 right-4 z-50 flex w-full max-w-sm flex-col gap-2" aria-live="polite">
      {toasts.map((t) => (
        <div key={t.id} role={t.nivel === 'critico' ? 'alert' : 'status'}
          className="entra pointer-events-auto flex items-start gap-3 rounded-md border bg-noc-panel px-3 py-2.5 text-sm shadow-xl"
          style={{ borderColor: `${COLOR[t.nivel] ?? COLOR.info}88`, borderLeftWidth: 4, borderLeftColor: COLOR[t.nivel] ?? COLOR.info }}>
          <span className="min-w-0 flex-1">{t.texto}</span>
          <button type="button" aria-label="Descartar aviso" onClick={() => useTopology.getState().quitarToast(t.id)} className="text-noc-muted hover:text-noc-text"><X size={14} /></button>
        </div>
      ))}
    </div>
  );
}
