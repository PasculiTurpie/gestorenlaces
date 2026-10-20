import { Pencil, Plus } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { api } from '../../lib/api.js';
import { siguienteIdEnlace } from '../../lib/catalogos.js';
import { describirError } from '../../lib/errores.js';
import { ETIQUETA_SENTIDO, SENTIDOS, calcularAtenuacion, fechaParaInput, fmtDb, leerNumero } from '../../lib/levantamiento.js';
import { estadoLevantamiento } from '../../lib/selectors.js';
import { analizarTramos, filasDesdeTramos, fmtKm, zonalesDeEnlace } from '../../lib/tramos.js';
import { useAuth } from '../../store/authStore.js';
import { useTopology } from '../../store/topologyStore.js';
import EstadoBadge from '../EstadoBadge.jsx';
import { cn } from '../../lib/format.js';
import TramosEditor from './TramosEditor.jsx';
import { Aviso, Boton, Campo, Cabecera, Celda, Dialogo, Insignia, Tabla, entrada, entradaAuto } from './ui.jsx';

const ETIQUETA_LEV = { completo: 'Completo', parcial: 'Parcial', sin: 'Sin datos' };
const COLOR_LEV = { completo: '#22c55e', parcial: '#f97316', sin: '#8296ab' };

const formularioInicial = (enlace) =>
  Object.fromEntries(
    enlace.filamentos.map(({ sentido, levantamiento: l }) => [
      sentido,
      { tx: l.tx == null ? '' : String(l.tx), rx: l.rx == null ? '' : String(l.rx), fecha: fechaParaInput(l.fecha), observacion: l.observacion },
    ]),
  );

const PESTANAS = [['general', 'General'], ['potencias', 'Potencias'], ['tramos', 'Tramos por zonal']];

function EditorEnlace({ enlace, onClose }) {
  const tipos = useTopology((s) => s.tipos);
  const zonales = useTopology((s) => s.zonales);
  const rol = useAuth((s) => s.user?.rol);
  const [pestana, setPestana] = useState('general');
  const [longitud, setLongitud] = useState(enlace.longitud_km == null ? '' : String(enlace.longitud_km));
  const [filas, setFilas] = useState(() => filasDesdeTramos(enlace.tramos));
  const analisis = useMemo(() => analizarTramos(filas, longitud), [filas, longitud]);
  const [tipo, setTipo] = useState(enlace.tipo?._id ?? '');
  const [proveedor, setProveedor] = useState(enlace.proveedor);
  const [fil, setFil] = useState(() => formularioInicial(enlace));
  const [error, setError] = useState(null);
  const [enviando, setEnviando] = useState(false);

  // Un mensaje de error de un intento anterior deja de tener sentido en cuanto se edita algo
  useEffect(() => { setError(null); }, [tipo, proveedor, fil, filas, longitud]);

  const opcionesTipo = tipos.filter((t) => t.activo || t._id === enlace.tipo?._id);
  const setCampo = (sentido, campo) => (e) => setFil((f) => ({ ...f, [sentido]: { ...f[sentido], [campo]: e.target.value } }));

  async function guardar(e) {
    e.preventDefault();
    setError(null);

    // 1) Diferencias respecto a lo guardado (solo se envía lo que cambió)
    const cambiosEnlace = {};
    if (tipo && tipo !== (enlace.tipo?._id ?? '')) cambiosEnlace.tipo_enlace = tipo;
    if (proveedor.trim() !== enlace.proveedor) cambiosEnlace.proveedor = proveedor.trim();

    const cambiosFil = [];
    for (const sentido of SENTIDOS) {
      const orig = enlace.filamentos.find((f) => f.sentido === sentido).levantamiento;
      const act = fil[sentido];
      const tx = leerNumero(act.tx), rx = leerNumero(act.rx);
      if (Number.isNaN(tx) || Number.isNaN(rx)) return setError(`${ETIQUETA_SENTIDO[sentido]}: las potencias deben ser números (ej. -9,80).`);
      const body = {};
      if (tx !== orig.tx) body.potencia_tx_dbm = tx; // null = borrar
      if (rx !== orig.rx) body.potencia_rx_dbm = rx;
      if (act.fecha !== fechaParaInput(orig.fecha)) body.fecha = act.fecha || null;
      if (act.observacion.trim() !== orig.observacion) body.observacion = act.observacion.trim();
      if (Object.keys(body).length) cambiosFil.push([sentido, body]);
    }

    // Tramos por zonal: no se guarda con errores (los avisos, como km sin asignar, no bloquean)
    if (analisis.errores.length) {
      setPestana('tramos');
      return setError('Corrija los errores de los tramos por zonal antes de guardar.');
    }
    const originalTramos = enlace.tramos.map((t) => ({ zonal: t.zonal._id, km_desde: t.km_desde, km_hasta: t.km_hasta }));
    const nuevosTramos = analisis.tramos.map((t) => ({ zonal: t.zonal, km_desde: t.km_desde, km_hasta: t.km_hasta }));
    const cambioTramos = analisis.longitud !== enlace.longitud_km || JSON.stringify(nuevosTramos) !== JSON.stringify(originalTramos);

    if (!Object.keys(cambiosEnlace).length && !cambiosFil.length && !cambioTramos) return onClose();

    // 2) Se guarda en orden; cada respuesta actualiza el mapa al instante
    setEnviando(true);
    const T = useTopology.getState();
    try {
      if (Object.keys(cambiosEnlace).length) T.aplicarEnlace((await api.actualizarEnlace(enlace._id, cambiosEnlace)).data);
      for (const [sentido, body] of cambiosFil) T.aplicarEnlace((await api.guardarLevantamiento(enlace._id, sentido, body)).data);
      if (cambioTramos) T.aplicarEnlace((await api.guardarTramos(enlace._id, { longitud_km: analisis.longitud, tramos: nuevosTramos })).data);
      T.pushToast({ nivel: 'ok', texto: `${enlace.id_enlace} actualizado` });
      onClose();
    } catch (err) {
      setError(`${describirError(err)}. Lo guardado antes de este error ya quedó registrado.`);
      setEnviando(false);
    }
  }

  return (
    <Dialogo titulo={enlace.id_enlace} descripcion={`${enlace.origen} ⇄ ${enlace.destino}`} onClose={onClose} ancho="max-w-2xl">
      <form onSubmit={guardar}>
        <div role="tablist" aria-label="Secciones del enlace" className="mb-4 flex gap-1 border-b border-noc-line">
          {PESTANAS.map(([clave, etiqueta]) => (
            <button
              key={clave} type="button" role="tab" id={`tab-${clave}`} aria-selected={pestana === clave} aria-controls={`panel-${clave}`}
              onClick={() => setPestana(clave)}
              className={cn('-mb-px border-b-2 px-3 py-2 text-sm', pestana === clave ? 'border-noc-focus text-noc-text' : 'border-transparent text-noc-muted hover:text-noc-text')}
            >
              {etiqueta}
              {clave === 'tramos' && analisis.errores.length > 0 && <span role="img" aria-label="con errores" className="ml-1.5 inline-block h-1.5 w-1.5 rounded-full bg-estado-down" />}
            </button>
          ))}
        </div>

        <div role="tabpanel" id="panel-general" aria-labelledby="tab-general" hidden={pestana !== 'general'}>
        <div className="grid gap-3 sm:grid-cols-2">
          <Campo id="e-tipo" etiqueta="Tipo de línea" ayuda="A quién pertenece este enlace.">
            <select id="e-tipo" value={tipo} onChange={(e) => setTipo(e.target.value)} className={entrada}>
              {!tipo && <option value="">Sin clasificar</option>}
              {opcionesTipo.map((t) => <option key={t._id} value={t._id}>{t.nombre}{t.activo ? '' : ' (desactivado)'}</option>)}
            </select>
          </Campo>
          <Campo id="e-prov" etiqueta="Proveedor / responsable"><input id="e-prov" maxLength={120} value={proveedor} onChange={(e) => setProveedor(e.target.value)} className={entrada} /></Campo>
        </div>

        </div>

        <div role="tabpanel" id="panel-potencias" aria-labelledby="tab-potencias" hidden={pestana !== 'potencias'}>
        <p className="mb-1 text-sm font-semibold">Levantamiento de potencias</p>
        <p className="mb-3 text-xs text-noc-muted">Potencias medidas al poner en servicio cada filamento, en dBm. La atenuación se calcula como Tx − Rx.</p>

        <div className="grid gap-4 md:grid-cols-2">
          {SENTIDOS.map((sentido) => {
            const f = fil[sentido];
            const atenuacion = calcularAtenuacion(leerNumero(f.tx), leerNumero(f.rx));
            return (
              <fieldset key={sentido} className="rounded-md border border-noc-line p-3">
                <legend className="px-1 text-sm">
                  {ETIQUETA_SENTIDO[sentido]} <span className="text-xs text-noc-muted">{sentido === 'ida' ? `${enlace.origen} → ${enlace.destino}` : `${enlace.destino} → ${enlace.origen}`}</span>
                </legend>
                <div className="grid grid-cols-2 gap-3">
                  <Campo id={`${sentido}-tx`} etiqueta="Potencia Tx (dBm)" className="mb-2">
                    <input id={`${sentido}-tx`} inputMode="decimal" value={f.tx} onChange={setCampo(sentido, 'tx')} placeholder="+1,20" className={`${entrada} font-mono`} />
                  </Campo>
                  <Campo id={`${sentido}-rx`} etiqueta="Potencia Rx (dBm)" className="mb-2">
                    <input id={`${sentido}-rx`} inputMode="decimal" value={f.rx} onChange={setCampo(sentido, 'rx')} placeholder="-9,80" className={`${entrada} font-mono`} />
                  </Campo>
                </div>
                <p className="mb-2 text-xs text-noc-muted" aria-live="polite">Atenuación: <span className="font-mono text-noc-text">{atenuacion == null ? '—' : `${fmtDb(atenuacion)} dB`}</span></p>
                <Campo id={`${sentido}-fecha`} etiqueta="Fecha del levantamiento" className="mb-2">
                  <input id={`${sentido}-fecha`} type="date" value={f.fecha} onChange={setCampo(sentido, 'fecha')} className={entrada} />
                </Campo>
                <Campo id={`${sentido}-obs`} etiqueta="Observación" className="mb-0">
                  <input id={`${sentido}-obs`} maxLength={500} value={f.observacion} onChange={setCampo(sentido, 'observacion')} placeholder="Ej. medido con OTDR" className={entrada} />
                </Campo>
              </fieldset>
            );
          })}
        </div>
        </div>

        <div role="tabpanel" id="panel-tramos" aria-labelledby="tab-tramos" hidden={pestana !== 'tramos'}>
          <p className="mb-3 text-xs text-noc-muted">Qué kilómetros del enlace pertenecen a cada zonal. Los tramos no pueden solaparse; pueden quedar kilómetros sin asignar.</p>
          <TramosEditor
            origen={enlace.origen} destino={enlace.destino} zonales={zonales} zonalesDisponibles={zonales.filter((z) => z.activo)}
            puedeCrearZonales={rol === 'Admin'} longitud={longitud} setLongitud={setLongitud} filas={filas} setFilas={setFilas} analisis={analisis}
          />
        </div>

        {error && <div className="mt-3"><Aviso>{error}</Aviso></div>}
        <div className="mt-4 flex justify-end gap-2">
          <Boton onClick={onClose}>Cancelar</Boton>
          <Boton type="submit" variante="primario" cargando={enviando}>Guardar cambios</Boton>
        </div>
      </form>
    </Dialogo>
  );
}

function NuevoEnlace({ onClose }) {
  const nodos = useTopology((s) => s.nodos);
  const enlaces = useTopology((s) => s.enlaces);
  const tipos = useTopology((s) => s.tipos);
  const [f, setF] = useState({ origen: '', destino: '', id: '', tipo: tipos.find((t) => t.propio)?._id ?? '', proveedor: '' });
  const [idManual, setIdManual] = useState(false);
  const [error, setError] = useState(null);
  const [enviando, setEnviando] = useState(false);

  const cambiar = (campo) => (e) => {
    const valor = campo === 'origen' || campo === 'destino' ? e.target.value.toUpperCase() : e.target.value;
    setF((x) => {
      const n = { ...x, [campo]: valor };
      if (!idManual && nodos[n.origen] && nodos[n.destino]) n.id = siguienteIdEnlace(n.origen, n.destino, enlaces);
      return n;
    });
  };

  async function crear(e) {
    e.preventDefault();
    if (!nodos[f.origen] || !nodos[f.destino]) return setError('Elija nodos existentes para el origen y el destino.');
    if (f.origen === f.destino) return setError('El origen y el destino deben ser nodos distintos.');
    setEnviando(true); setError(null);
    try {
      const { data } = await api.crearEnlace({ id_enlace: f.id.trim(), origen_nodo: f.origen, destino_nodo: f.destino, ...(f.tipo && { tipo_enlace: f.tipo }), proveedor: f.proveedor.trim() });
      useTopology.getState().aplicarEnlace(data);
      useTopology.getState().pushToast({ nivel: 'ok', texto: `Enlace ${data.id_enlace} creado` });
      onClose();
    } catch (err) { setError(describirError(err)); setEnviando(false); }
  }

  return (
    <Dialogo titulo="Nuevo enlace" descripcion="Entre dos nodos existentes. Nace en estado OK con sus dos filamentos (ida y vuelta)." onClose={onClose}>
      <form onSubmit={crear}>
        <datalist id="lista-nodos">{Object.values(nodos).map((n) => <option key={n.id_nodo} value={n.id_nodo}>{n.nombre}</option>)}</datalist>
        <div className="grid grid-cols-2 gap-3">
          <Campo id="ne-o" etiqueta="Nodo origen"><input id="ne-o" list="lista-nodos" required value={f.origen} onChange={cambiar('origen')} className={`${entrada} font-mono`} autoFocus /></Campo>
          <Campo id="ne-d" etiqueta="Nodo destino"><input id="ne-d" list="lista-nodos" required value={f.destino} onChange={cambiar('destino')} className={`${entrada} font-mono`} /></Campo>
        </div>
        <Campo id="ne-id" etiqueta="Código del enlace" ayuda="Se sugiere automáticamente; puede editarlo.">
          <input id="ne-id" required maxLength={40} value={f.id} onChange={(e) => { setIdManual(true); setF((x) => ({ ...x, id: e.target.value.toUpperCase() })); }} className={`${entrada} font-mono`} />
        </Campo>
        <div className="grid grid-cols-2 gap-3">
          <Campo id="ne-tipo" etiqueta="Tipo de línea">
            <select id="ne-tipo" value={f.tipo} onChange={cambiar('tipo')} className={entrada}>{tipos.filter((t) => t.activo).map((t) => <option key={t._id} value={t._id}>{t.nombre}</option>)}</select>
          </Campo>
          <Campo id="ne-prov" etiqueta="Proveedor / responsable"><input id="ne-prov" maxLength={120} value={f.proveedor} onChange={cambiar('proveedor')} className={entrada} /></Campo>
        </div>
        {error && <Aviso>{error}</Aviso>}
        <div className="flex justify-end gap-2">
          <Boton onClick={onClose}>Cancelar</Boton>
          <Boton type="submit" variante="primario" cargando={enviando}>Crear enlace</Boton>
        </div>
      </form>
    </Dialogo>
  );
}

export default function EnlacesAdmin() {
  const enlaces = useTopology((s) => s.enlaces);
  const tipos = useTopology((s) => s.tipos);
  const [params, setParams] = useSearchParams();
  const [q, setQ] = useState('');
  const [tipo, setTipo] = useState('');
  const [lev, setLev] = useState('');
  const [zonal, setZonal] = useState('');
  const zonales = useTopology((s) => s.zonales);
  const [nuevo, setNuevo] = useState(false);

  // ?enlace=<id> abre el editor (lo usa el enlace «Editar levantamiento» del modal del mapa)
  const editando = params.get('enlace') ? enlaces[params.get('enlace')] : null;
  const cerrarEditor = () => setParams({}, { replace: true });

  const filas = useMemo(() => {
    const t = q.trim().toLowerCase();
    return Object.values(enlaces)
      .filter((l) => (!tipo || l.tipo?.clave === tipo) && (!lev || estadoLevantamiento(l) === lev))
      .filter((l) => !zonal || l.tramos.some((t) => t.zonal._id === zonal))
      .filter((l) => !t || l.id_enlace.toLowerCase().includes(t) || l.proveedor.toLowerCase().includes(t))
      .sort((a, b) => a.id_enlace.localeCompare(b.id_enlace));
  }, [enlaces, q, tipo, lev, zonal]);

  return (
    <>
      <Cabecera
        titulo="Enlaces"
        descripcion="Tipo de línea (propia u otra telco) y levantamiento de potencias de los dos filamentos de cada enlace."
        acciones={<Boton variante="primario" onClick={() => setNuevo(true)}><Plus size={15} /> Nuevo enlace</Boton>}
      />
      <div className="mb-3 flex flex-wrap gap-2">
        <input type="search" aria-label="Buscar enlace" placeholder="Buscar por código o proveedor" value={q} onChange={(e) => setQ(e.target.value)} className={`${entrada} max-w-xs`} />
        <select aria-label="Filtrar por tipo de línea" value={tipo} onChange={(e) => setTipo(e.target.value)} className={`${entradaAuto}`}>
          <option value="">Todas las líneas</option>
          {tipos.map((t) => <option key={t.clave} value={t.clave}>{t.nombre}</option>)}
        </select>
        <select aria-label="Filtrar por levantamiento" value={lev} onChange={(e) => setLev(e.target.value)} className={`${entradaAuto}`}>
          <option value="">Todo el levantamiento</option>
          <option value="sin">Sin datos</option>
          <option value="parcial">Parcial</option>
          <option value="completo">Completo</option>
        </select>
        <select aria-label="Filtrar por zonal" value={zonal} onChange={(e) => setZonal(e.target.value)} className={`${entradaAuto}`}>
          <option value="">Todas las zonales</option>
          {zonales.map((z) => <option key={z._id} value={z._id}>{z.nombre}</option>)}
        </select>
        <span className="self-center text-sm text-noc-muted">{filas.length} de {Object.keys(enlaces).length}</span>
      </div>
      <Tabla columnas={['Enlace', 'Línea', 'Zonales', 'Proveedor', 'Estado', 'Levantamiento', '']} vacio="Ningún enlace coincide con los filtros.">
        {filas.map((l) => {
          const e = estadoLevantamiento(l);
          return (
            <tr key={l._id}>
              <Celda><div className="font-mono text-xs">{l.id_enlace}</div><div className="text-xs text-noc-muted">{l.origen} ⇄ {l.destino}</div></Celda>
              <Celda>{l.tipo ? <Insignia color={l.tipo.color}>{l.tipo.nombre}</Insignia> : <span className="text-noc-muted">Sin clasificar</span>}</Celda>
              <Celda>
                {l.tramos.length ? (
                  <div className="flex flex-wrap items-center gap-1">
                    {zonalesDeEnlace(l).map((z) => <Insignia key={z._id} color={z.color}>{z.nombre}</Insignia>)}
                    {l.longitud_km != null && <span className="font-mono text-xs text-noc-muted">{fmtKm(l.longitud_km)}</span>}
                  </div>
                ) : (
                  <span className="text-noc-muted">{l.longitud_km != null ? fmtKm(l.longitud_km) : '—'}</span>
                )}
              </Celda>
              <Celda>{l.proveedor || <span className="text-noc-muted">—</span>}</Celda>
              <Celda><EstadoBadge estado={l.estado} /></Celda>
              <Celda><span style={{ color: COLOR_LEV[e] }}>{ETIQUETA_LEV[e]}</span></Celda>
              <Celda className="text-right"><Boton aria-label={`Editar ${l.id_enlace}`} onClick={() => setParams({ enlace: l._id }, { replace: true })}><Pencil size={13} /> Editar</Boton></Celda>
            </tr>
          );
        })}
      </Tabla>
      {editando && <EditorEnlace key={editando._id} enlace={editando} onClose={cerrarEditor} />}
      {nuevo && <NuevoEnlace onClose={() => setNuevo(false)} />}
    </>
  );
}
