import { Suspense, lazy } from 'react';
import { HashRouter, Navigate, Route, Routes } from 'react-router-dom';
import AdminLayout from './components/admin/AdminLayout.jsx';
import AlarmasAdmin from './components/admin/AlarmasAdmin.jsx';
import EnlacesAdmin from './components/admin/EnlacesAdmin.jsx';
import NodosAdmin from './components/admin/NodosAdmin.jsx';
import TiposAdmin from './components/admin/TiposAdmin.jsx';
import NceAdmin from './components/admin/NceAdmin.jsx';
import SistemaAdmin from './components/admin/SistemaAdmin.jsx';
import ServiciosAdmin from './components/servicios/ServiciosAdmin.jsx';
import UsuariosAdmin from './components/admin/UsuariosAdmin.jsx';
import ZonalesAdmin from './components/admin/ZonalesAdmin.jsx';
import GuiaAlarmas from './components/alarmas/GuiaAlarmas.jsx';
import Consola from './components/Consola.jsx';
import LoginPage from './components/LoginPage.jsx';
import MantenimientosPage from './components/mantenimientos/MantenimientosPage.jsx';
import MapaPage from './components/MapaPage.jsx';
import TurnoPage from './components/turno/TurnoPage.jsx';
import { useAuth } from './store/authStore.js';

// Recharts pesa bastante: el dashboard se descarga solo cuando se abre
const IndicadoresPage = lazy(() => import('./components/indicadores/IndicadoresPage.jsx'));

// HashRouter: no requiere configurar el servidor para servir rutas como /admin/usuarios
export default function App() {
  const token = useAuth((s) => s.token);
  if (!token) return <LoginPage />;

  return (
    <HashRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <Routes>
        <Route element={<Consola />}>
          <Route index element={<MapaPage />} />
          <Route path="turno" element={<TurnoPage />} />
          <Route path="mantenimientos" element={<MantenimientosPage />} />
          <Route path="alarmas" element={<GuiaAlarmas />} />
          <Route path="indicadores" element={<Suspense fallback={<p className="p-6 text-sm text-noc-muted">Cargando indicadores…</p>}><IndicadoresPage /></Suspense>} />
          <Route path="admin" element={<AdminLayout />}>
            <Route path="usuarios" element={<UsuariosAdmin />} />
            <Route path="nodos" element={<NodosAdmin />} />
            <Route path="servicios" element={<ServiciosAdmin />} />
            <Route path="enlaces" element={<EnlacesAdmin />} />
            <Route path="tipos" element={<TiposAdmin />} />
            <Route path="zonales" element={<ZonalesAdmin />} />
            <Route path="alarmas" element={<AlarmasAdmin />} />
            <Route path="nce" element={<NceAdmin />} />
            <Route path="sistema" element={<SistemaAdmin />} />
          </Route>
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
    </HashRouter>
  );
}
