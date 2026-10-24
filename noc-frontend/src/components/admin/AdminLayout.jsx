import { BellRing, Cable, Layers, MapPin, Network, Palette, PlugZap, Server, Users } from 'lucide-react';
import { NavLink, Navigate, Outlet, useLocation } from 'react-router-dom';
import { cn } from '../../lib/format.js';
import { useAuth } from '../../store/authStore.js';

// Cada sección declara qué roles la ven; el servidor aplica además sus propios permisos.
const SECCIONES = [
  { ruta: 'enlaces', etiqueta: 'Enlaces', icono: Cable, roles: ['Supervisor', 'Admin'] },
  { ruta: 'nodos', etiqueta: 'Nodos', icono: Network, roles: ['Supervisor', 'Admin'] },
  { ruta: 'servicios', etiqueta: 'Servicios', icono: Layers, roles: ['Supervisor', 'Admin'] },
  { ruta: 'tipos', etiqueta: 'Tipos de línea', icono: Palette, roles: ['Admin'] },
  { ruta: 'zonales', etiqueta: 'Zonales', icono: MapPin, roles: ['Admin'] },
  { ruta: 'alarmas', etiqueta: 'Alarmas', icono: BellRing, roles: ['Admin'] },
  { ruta: 'usuarios', etiqueta: 'Usuarios', icono: Users, roles: ['Admin'] },
  { ruta: 'nce', etiqueta: 'Integración NCE', icono: PlugZap, roles: ['Supervisor', 'Admin'] },
  { ruta: 'sistema', etiqueta: 'Sistema', icono: Server, roles: ['Admin'] },
];

export default function AdminLayout() {
  const rol = useAuth((s) => s.user?.rol);
  const { pathname } = useLocation();
  const permitidas = SECCIONES.filter((s) => s.roles.includes(rol));

  if (permitidas.length === 0) return <Navigate to="/" replace />;
  const actual = pathname.split('/')[2];
  if (!permitidas.some((s) => s.ruta === actual)) return <Navigate to={`/admin/${permitidas[0].ruta}`} replace />;

  return (
    <div className="flex min-h-0 flex-1 max-md:flex-col">
      <nav aria-label="Administración" className="w-52 shrink-0 border-r border-noc-line bg-noc-panel p-3 max-md:flex max-md:w-auto max-md:gap-1 max-md:border-b max-md:border-r-0 max-md:overflow-x-auto">
        <p className="mb-2 px-2 text-xs text-noc-muted max-md:hidden">Administración</p>
        {permitidas.map(({ ruta, etiqueta, icono: Icono }) => (
          <NavLink
            key={ruta} to={ruta}
            className={({ isActive }) => cn('mb-0.5 flex items-center gap-2.5 rounded-md px-2.5 py-2 text-sm max-md:mb-0 max-md:whitespace-nowrap', isActive ? 'bg-noc-raised text-noc-text' : 'text-noc-muted hover:bg-noc-raised/60 hover:text-noc-text')}
          >
            <Icono size={16} /> {etiqueta}
          </NavLink>
        ))}
      </nav>
      <section className="min-w-0 flex-1 overflow-auto p-6 max-sm:p-4">
        <Outlet />
      </section>
    </div>
  );
}
