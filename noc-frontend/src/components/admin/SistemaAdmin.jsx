import { AlertTriangle, CheckCircle2, Loader2, RefreshCw, XCircle } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { api } from '../../lib/api.js';
import { describirError } from '../../lib/errores.js';
import { fechaHora } from '../../lib/format.js';
import { Aviso, Boton, Cabecera } from './ui.jsx';

const ESTILO = {
  ok: { Icono: CheckCircle2, color: '#22c55e', etiqueta: 'Correcto' },
  aviso: { Icono: AlertTriangle, color: '#f97316', etiqueta: 'Atención' },
  error: { Icono: XCircle, color: '#ef4444', etiqueta: 'Falla' },
};

/** Estado de lo que el servidor necesita para funcionar (base de datos, carpeta de documentos, espacio, límites). Solo Admin. */
export default function SistemaAdmin() {
  const [datos, setDatos] = useState(null);
  const [error, setError] = useState(null);
  const [cargando, setCargando] = useState(false);

  const comprobar = useCallback(async () => {
    setCargando(true); setError(null);
    try { setDatos((await api.diagnostico()).data); } catch (e) { setError(describirError(e)); }
    setCargando(false);
  }, []);
  useEffect(() => { comprobar(); }, [comprobar]);

  return (
    <>
      <Cabecera
        titulo="Sistema"
        descripcion="Comprobaciones del servidor. Si una función falla (por ejemplo, la subida de documentos), aquí suele verse el motivo."
        acciones={<Boton onClick={comprobar} cargando={cargando}><RefreshCw size={14} /> Volver a comprobar</Boton>}
      />
      {error && <Aviso>{error}</Aviso>}
      {!datos && !error && <p className="flex items-center gap-2 text-sm text-noc-muted"><Loader2 size={15} className="animate-spin" /> Comprobando…</p>}
      {datos && (
        <>
          <div role="status" className={`mb-4 rounded-md border px-4 py-3 text-sm ${datos.ok ? 'border-estado-ok/40 bg-estado-ok/10 text-green-300' : 'border-estado-down/40 bg-estado-down/10 text-red-300'}`}>
            {datos.ok ? 'Todo en orden.' : 'Hay comprobaciones que fallan: algunas funciones no van a trabajar hasta corregirlas.'}
            <span className="ml-2 text-xs opacity-70">Comprobado {fechaHora(datos.generado)}</span>
          </div>
          <ul className="divide-y divide-noc-line overflow-hidden rounded-lg border border-noc-line" aria-label="Comprobaciones">
            {datos.checks.map((c) => {
              const { Icono, color, etiqueta } = ESTILO[c.nivel] ?? ESTILO.ok;
              return (
                <li key={c.nombre} className="flex items-start gap-3 px-4 py-3">
                  <Icono size={18} className="mt-0.5 shrink-0" style={{ color }} aria-label={etiqueta} />
                  <div className="min-w-0">
                    <div className="text-sm font-medium">{c.nombre}</div>
                    <div className="break-words font-mono text-xs text-noc-muted">{c.detalle}</div>
                  </div>
                </li>
              );
            })}
          </ul>
        </>
      )}
    </>
  );
}
