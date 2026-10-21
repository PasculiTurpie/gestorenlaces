import { Activity, Eye, EyeOff, LogOut, PanelRight } from 'lucide-react';
import { NavLink, useLocation } from 'react-router-dom';
import { useNow } from '../hooks/useNow.js';
import { cn, hora } from '../lib/format.js';
import { useAuth } from '../store/authStore.js';
import { useTopology } from '../store/topologyStore.js';
import NodeSearch from './NodeSearch.jsx';

function Reloj() {
  const ahora = useNow(1000);
  return <span className="font-mono text-sm tabular-nums text-noc-muted">{hora(ahora)}</span>;
}

function Conexion() {
  const conectado = useTopology((s) => s.conectado);
  return (
    <span className="flex items-center gap-2 text-sm" role="status">
      <span className={`h-2 w-2 rounded-full ${conectado ? 'bg-estado-ok' : 'animate-pulse bg-estado-deg'}`} />
      <span className={conectado ? 'text-noc-muted' : 'text-estado-deg'}>{conectado ? 'En vivo' : 'Reconectando…'}</span>
    </span>
  );
}

const esGestor = (rol) => rol === 'Supervisor' || rol === 'Admin';
const enlaceNav = ({ isActive }) =>
  cn('rounded-md px-2.5 py-1 text-sm', isActive ? 'bg-noc-raised text-noc-text' : 'text-noc-muted hover:text-noc-text');

export default function Header() {
  const user = useAuth((s) => s.user);
  const enMapa = useLocation().pathname === '/';
  const ocultarOK = useTopology((s) => s.filtros.ocultarOK);
  const sidebarAbierto = useTopology((s) => s.sidebarAbierto);
  const { setFiltro, toggleSidebar } = useTopology.getState();

  return (
    <header className="flex h-12 shrink-0 items-center gap-4 border-b border-noc-line bg-noc-panel px-4">
      <div className="flex items-center gap-2.5">
        <Activity size={18} className="text-estado-ok" />
        <span className="font-semibold">NOC Console</span>
      </div>

      <nav aria-label="Secciones" className="flex items-center gap-1">
        <NavLink to="/" end className={enlaceNav}>Mapa</NavLink>
        <NavLink to="/turno" className={enlaceNav}>Turno</NavLink>
        <NavLink to="/mantenimientos" className={enlaceNav}>Mantenimientos</NavLink>
        <NavLink to="/indicadores" className={enlaceNav}>Indicadores</NavLink>
        <NavLink to="/alarmas" className={enlaceNav}>Alarmas</NavLink>
        {esGestor(user?.rol) && <NavLink to="/admin" className={enlaceNav}>Administración</NavLink>}
      </nav>

      {enMapa && (
        <>
          <NodeSearch />
          <button
            type="button" onClick={() => setFiltro('ocultarOK', !ocultarOK)} aria-pressed={ocultarOK}
            className={`flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-sm ${ocultarOK ? 'border-noc-focus/60 bg-noc-focus/10 text-noc-focus' : 'border-noc-line text-noc-muted hover:text-noc-text'}`}
          >
            {ocultarOK ? <EyeOff size={15} /> : <Eye size={15} />}
            Solo fallas
          </button>
        </>
      )}

      <div className="ml-auto flex items-center gap-4">
        <Conexion />
        <Reloj />
        <div className="flex items-center gap-2 border-l border-noc-line pl-4">
          <div className="text-right leading-tight">
            <div className="text-sm">{user?.nombre}</div>
            <div className="text-xs text-noc-muted">{user?.rol} · turno {user?.turno?.toLowerCase()}</div>
          </div>
          <button type="button" onClick={() => useAuth.getState().logout()} title="Cerrar sesión" aria-label="Cerrar sesión"
            className="rounded-md p-1.5 text-noc-muted hover:bg-noc-raised hover:text-noc-text">
            <LogOut size={16} />
          </button>
        </div>
        {enMapa && (
          <button type="button" onClick={toggleSidebar} aria-pressed={sidebarAbierto} title="Panel de alarmas" aria-label="Mostrar u ocultar el panel lateral"
            className={`rounded-md p-1.5 hover:bg-noc-raised ${sidebarAbierto ? 'text-noc-focus' : 'text-noc-muted'}`}>
            <PanelRight size={17} />
          </button>
        )}
      </div>
    </header>
  );
}
