import { Eye } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { api } from '../../lib/api.js';
import { TURNOS } from '../../lib/catalogos.js';
import { describirError } from '../../lib/errores.js';
import { fechaDia, fechaHora } from '../../lib/format.js';
import { duracionTurnoMin, fmtDuracion, normalizarActa } from '../../lib/turno.js';
import { useAuth } from '../../store/authStore.js';
import { Aviso, Boton, Celda, Tabla, entrada, entradaAuto } from '../admin/ui.jsx';
import DetalleActa from './DetalleActa.jsx';
import VistaPreviaActa from './VistaPreviaActa.jsx';

const LIMITE = 15;

export default function HistorialTurnos() {
  const rol = useAuth((s) => s.user?.rol);
  const [f, setF] = useState({ tipo_turno: '', cerrado: '', desde: '', hasta: '' });
  const [pagina, setPagina] = useState(1);
  const [datos, setDatos] = useState({ cargando: true, actas: [], meta: null, error: null });
  const [detalle, setDetalle] = useState(null);
  const [imprimir, setImprimir] = useState(null);
  const set = (k) => (e) => { setF((x) => ({ ...x, [k]: e.target.value })); setPagina(1); };

  const cargar = useCallback(async () => {
    const q = new URLSearchParams({ page: String(pagina), limit: String(LIMITE) });
    if (f.tipo_turno) q.set('tipo_turno', f.tipo_turno);
    if (f.cerrado) q.set('cerrado', f.cerrado);
    if (f.desde) q.set('desde', f.desde); // fecha de turno (AAAA-MM-DD): el turno noche que empieza el 19 a las 23:00 es del 20
    if (f.hasta) q.set('hasta', f.hasta);
    try {
      const { data, meta } = await api.turnos(q.toString());
      setDatos({ cargando: false, actas: data.map(normalizarActa), meta, error: null });
    } catch (err) { setDatos({ cargando: false, actas: [], meta: null, error: describirError(err) }); }
  }, [f, pagina]);
  useEffect(() => { cargar(); }, [cargar]);

  return (
    <div>
      <p className="mb-3 text-sm text-noc-muted">{rol === 'Operador' ? 'Tus actas de turno.' : 'Actas de todos los operadores.'}</p>
      <div className="mb-3 flex flex-wrap gap-2">
        <select aria-label="Filtrar por turno" value={f.tipo_turno} onChange={set('tipo_turno')} className={`${entradaAuto}`}>
          <option value="">Todos los turnos</option>{TURNOS.map((t) => <option key={t}>{t}</option>)}
        </select>
        <select aria-label="Filtrar por estado" value={f.cerrado} onChange={set('cerrado')} className={`${entradaAuto}`}>
          <option value="">Abiertos y cerrados</option><option value="true">Cerrados</option><option value="false">Abiertos</option>
        </select>
        <label className="flex items-center gap-1.5 text-sm text-noc-muted">Turno desde <input type="date" aria-label="Desde" value={f.desde} onChange={set('desde')} className={`${entradaAuto}`} /></label>
        <label className="flex items-center gap-1.5 text-sm text-noc-muted">Turno hasta <input type="date" aria-label="Hasta" value={f.hasta} onChange={set('hasta')} className={`${entradaAuto}`} /></label>
      </div>
      {datos.error && <Aviso>{datos.error}</Aviso>}
      {datos.cargando ? <p className="text-sm text-noc-muted">Cargando actas…</p> : (
        <Tabla columnas={['Fecha del turno', 'Operador', 'Turno', 'Duración', 'Checklist', 'Estado', '']} vacio="No hay actas que coincidan con los filtros.">
          {datos.actas.map((a) => (
            <tr key={a._id}>
              <Celda className="tabular-nums"><span className="font-medium">{fechaDia(a.fecha_turno)}</span><span className="block text-xs text-noc-muted">inició {fechaHora(a.fecha_inicio)}</span></Celda>
              <Celda>{a.operador?.nombre ?? '—'}</Celda>
              <Celda>{a.tipo_turno}</Celda>
              <Celda className="tabular-nums">{fmtDuracion(duracionTurnoMin(a))}{a.cerrado ? '' : ' (en curso)'}</Celda>
              <Celda className="tabular-nums">{a.checklist_total} enlace(s){a.checklist_pendientes > 0 && <span className="ml-1.5 text-estado-deg">· {a.checklist_pendientes} sin gestionar</span>}</Celda>
              <Celda>{a.cerrado ? 'Cerrado' : <span className="text-estado-ok">Abierto</span>}</Celda>
              <Celda className="text-right"><Boton aria-label={`Ver acta de ${a.operador?.nombre ?? ''}, turno ${a.tipo_turno.toLowerCase()} del ${fechaDia(a.fecha_turno)}`} onClick={() => setDetalle(a._id)}><Eye size={13} /> Ver</Boton></Celda>
            </tr>
          ))}
        </Tabla>
      )}
      {datos.meta && datos.meta.paginas > 1 && (
        <div className="mt-3 flex items-center justify-end gap-3 text-sm text-noc-muted">
          <span>Página {datos.meta.page} de {datos.meta.paginas} · {datos.meta.total} actas</span>
          <Boton disabled={pagina <= 1} onClick={() => setPagina((p) => p - 1)}>Anterior</Boton>
          <Boton disabled={pagina >= datos.meta.paginas} onClick={() => setPagina((p) => p + 1)}>Siguiente</Boton>
        </div>
      )}
      {detalle && <DetalleActa actaId={detalle} onImprimir={(id) => { setDetalle(null); setImprimir(id); }} onClose={() => setDetalle(null)} />}
      {imprimir && <VistaPreviaActa actaId={imprimir} onClose={() => setImprimir(null)} />}
    </div>
  );
}
