import { ReactFlowProvider } from '@xyflow/react';
import { Loader2 } from 'lucide-react';
import { useEffect } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { iniciarTiempoReal } from '../lib/realtime.js';
import { useAuth } from '../store/authStore.js';
import { useTopology } from '../store/topologyStore.js';
import ErrorBoundary from './ErrorBoundary.jsx';
import Header from './Header.jsx';
import Toasts from './Toasts.jsx';

/** Marco de la aplicación autenticada: cabecera, carga de datos, tiempo real y avisos. Las pantallas van en <Outlet/>. */
export default function Consola() {
  const token = useAuth((s) => s.token);
  const cargando = useTopology((s) => s.cargando);
  const error = useTopology((s) => s.error);
  const { pathname } = useLocation();

  // Arranque: valida la sesión, carga nodos/enlaces/tipos y abre el canal en vivo. Al salir lo cierra todo.
  useEffect(() => {
    useAuth.getState().verificar().catch(() => {}); // un 401 cierra la sesión por sí solo
    useTopology.getState().cargar();
    const detener = iniciarTiempoReal(token);
    return () => {
      detener();
      useTopology.getState().reset();
    };
  }, [token]);

  return (
    <ReactFlowProvider>
      <div className="flex h-full flex-col">
        <Header />
        <div className="relative flex min-h-0 flex-1">
          {cargando && (
            <div className="absolute inset-0 z-10 flex items-center justify-center gap-2 text-noc-muted">
              <Loader2 className="animate-spin" size={18} /> Cargando datos…
            </div>
          )}
          {error && !cargando && (
            <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-3 px-6 text-center">
              <p className="text-red-300">No se pudieron cargar los datos: {error}</p>
              <button type="button" onClick={() => useTopology.getState().cargar()} className="rounded-md border border-noc-line px-3 py-1.5 text-sm hover:bg-noc-raised">
                Reintentar
              </button>
            </div>
          )}
          {!cargando && !error && <ErrorBoundary clave={pathname}><Outlet /></ErrorBoundary>}
        </div>
        <Toasts />
      </div>
    </ReactFlowProvider>
  );
}
