import { KeyRound, Pencil, Plus } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { api } from '../../lib/api.js';
import { ROLES, TURNOS } from '../../lib/catalogos.js';
import { describirError } from '../../lib/errores.js';
import { useAuth } from '../../store/authStore.js';
import { useTopology } from '../../store/topologyStore.js';
import { Aviso, Boton, Campo, Cabecera, Celda, Dialogo, Insignia, Tabla, entrada } from './ui.jsx';

const COLOR_ROL = { Admin: '#a855f7', Supervisor: '#7dd3fc', Operador: '#8296ab' };

function FormUsuario({ usuario, esYo, onClose, onGuardado }) {
  const nuevo = !usuario;
  const [f, setF] = useState({ nombre: usuario?.nombre ?? '', email: usuario?.email ?? '', rol: usuario?.rol ?? 'Operador', turno: usuario?.turno ?? 'Mañana', activo: usuario?.activo ?? true, password: '' });
  const [error, setError] = useState(null);
  const [enviando, setEnviando] = useState(false);
  const set = (k) => (e) => setF((x) => ({ ...x, [k]: e.target.type === 'checkbox' ? e.target.checked : e.target.value }));

  async function guardar(e) {
    e.preventDefault();
    setEnviando(true); setError(null);
    try {
      if (nuevo) await api.crearUsuario({ nombre: f.nombre, email: f.email, rol: f.rol, turno: f.turno, password: f.password });
      else await api.actualizarUsuario(usuario._id, { nombre: f.nombre, email: f.email, rol: f.rol, turno: f.turno, activo: f.activo });
      onGuardado(nuevo ? `Usuario ${f.nombre} creado` : `Usuario ${f.nombre} actualizado`);
    } catch (err) { setError(describirError(err)); setEnviando(false); }
  }

  return (
    <Dialogo titulo={nuevo ? 'Nuevo usuario' : 'Editar usuario'} onClose={onClose}>
      <form onSubmit={guardar}>
        <Campo id="u-nombre" etiqueta="Nombre"><input id="u-nombre" required minLength={2} value={f.nombre} onChange={set('nombre')} className={entrada} autoFocus /></Campo>
        <Campo id="u-email" etiqueta="Correo"><input id="u-email" type="email" required value={f.email} onChange={set('email')} className={entrada} /></Campo>
        <div className="grid grid-cols-2 gap-3">
          <Campo id="u-rol" etiqueta="Rol" ayuda={esYo ? 'No puedes cambiar tu propio rol.' : undefined}>
            <select id="u-rol" value={f.rol} onChange={set('rol')} disabled={esYo} className={entrada}>{ROLES.map((r) => <option key={r}>{r}</option>)}</select>
          </Campo>
          <Campo id="u-turno" etiqueta="Turno">
            <select id="u-turno" value={f.turno} onChange={set('turno')} className={entrada}>{TURNOS.map((t) => <option key={t}>{t}</option>)}</select>
          </Campo>
        </div>
        {nuevo ? (
          <Campo id="u-pass" etiqueta="Contraseña inicial" ayuda="Mínimo 8 caracteres. La persona puede pedir que se la restablezcan después.">
            <input id="u-pass" type="password" required minLength={8} autoComplete="new-password" value={f.password} onChange={set('password')} className={entrada} />
          </Campo>
        ) : (
          <label className="mb-3 flex items-center gap-2 text-sm">
            <input type="checkbox" checked={f.activo} onChange={set('activo')} disabled={esYo} />
            Cuenta activa <span className="text-xs text-noc-muted">(desactivar impide el ingreso sin borrar su historial)</span>
          </label>
        )}
        {error && <Aviso>{error}</Aviso>}
        <div className="flex justify-end gap-2">
          <Boton onClick={onClose}>Cancelar</Boton>
          <Boton type="submit" variante="primario" cargando={enviando}>{nuevo ? 'Crear usuario' : 'Guardar cambios'}</Boton>
        </div>
      </form>
    </Dialogo>
  );
}

function FormPassword({ usuario, onClose, onGuardado }) {
  const [password, setPassword] = useState('');
  const [error, setError] = useState(null);
  const [enviando, setEnviando] = useState(false);
  async function guardar(e) {
    e.preventDefault();
    setEnviando(true); setError(null);
    try { await api.restablecerPassword(usuario._id, password); onGuardado(`Contraseña de ${usuario.nombre} restablecida`); }
    catch (err) { setError(describirError(err)); setEnviando(false); }
  }
  return (
    <Dialogo titulo="Restablecer contraseña" descripcion={`${usuario.nombre} · ${usuario.email}`} onClose={onClose} ancho="max-w-md">
      <form onSubmit={guardar}>
        <Campo id="p-nueva" etiqueta="Nueva contraseña" ayuda="Mínimo 8 caracteres. Comuníquela a la persona por un canal seguro.">
          <input id="p-nueva" type="password" required minLength={8} autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} className={entrada} autoFocus />
        </Campo>
        {error && <Aviso>{error}</Aviso>}
        <div className="flex justify-end gap-2">
          <Boton onClick={onClose}>Cancelar</Boton>
          <Boton type="submit" variante="primario" cargando={enviando}>Restablecer</Boton>
        </div>
      </form>
    </Dialogo>
  );
}

export default function UsuariosAdmin() {
  const yo = useAuth((s) => s.user);
  const [usuarios, setUsuarios] = useState(null);
  const [error, setError] = useState(null);
  const [dialogo, setDialogo] = useState(null); // { tipo: 'form'|'password', usuario? }

  const cargar = useCallback(async () => {
    try { setUsuarios((await api.usuarios()).data); setError(null); } catch (e) { setError(describirError(e)); }
  }, []);
  useEffect(() => { cargar(); }, [cargar]);

  const terminado = (mensaje) => { setDialogo(null); cargar(); useTopology.getState().pushToast({ nivel: 'ok', texto: mensaje }); };

  return (
    <>
      <Cabecera
        titulo="Usuarios"
        descripcion="Cuentas de acceso a la consola. Las cuentas no se borran: se desactivan para conservar la trazabilidad de actas e incidencias."
        acciones={<Boton variante="primario" onClick={() => setDialogo({ tipo: 'form' })}><Plus size={15} /> Nuevo usuario</Boton>}
      />
      {error && <Aviso>{error}</Aviso>}
      {!usuarios && !error && <p className="text-sm text-noc-muted">Cargando usuarios…</p>}
      {usuarios && (
        <Tabla columnas={['Nombre', 'Correo', 'Rol', 'Turno', 'Estado', '']} vacio="Aún no hay usuarios.">
          {usuarios.map((u) => (
            <tr key={u._id} className={u.activo ? '' : 'opacity-60'}>
              <Celda>{u.nombre}{u._id === yo?._id && <span className="ml-2 text-xs text-noc-muted">(tú)</span>}</Celda>
              <Celda className="font-mono text-xs">{u.email}</Celda>
              <Celda><Insignia color={COLOR_ROL[u.rol]}>{u.rol}</Insignia></Celda>
              <Celda>{u.turno}</Celda>
              <Celda>{u.activo ? 'Activo' : 'Desactivado'}</Celda>
              <Celda className="text-right">
                <Boton className="mr-1.5" aria-label={`Editar ${u.nombre}`} onClick={() => setDialogo({ tipo: 'form', usuario: u })}><Pencil size={13} /> Editar</Boton>
                <Boton aria-label={`Restablecer contraseña de ${u.nombre}`} onClick={() => setDialogo({ tipo: 'password', usuario: u })}><KeyRound size={13} /> Contraseña</Boton>
              </Celda>
            </tr>
          ))}
        </Tabla>
      )}
      {dialogo?.tipo === 'form' && <FormUsuario usuario={dialogo.usuario} esYo={dialogo.usuario?._id === yo?._id} onClose={() => setDialogo(null)} onGuardado={terminado} />}
      {dialogo?.tipo === 'password' && <FormPassword usuario={dialogo.usuario} onClose={() => setDialogo(null)} onGuardado={terminado} />}
    </>
  );
}
