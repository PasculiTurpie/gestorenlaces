import { Activity, Loader2 } from 'lucide-react';
import { useState } from 'react';
import { useAuth } from '../store/authStore.js';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState(null);
  const [enviando, setEnviando] = useState(false);

  async function enviar(e) {
    e.preventDefault();
    setError(null);
    setEnviando(true);
    try {
      await useAuth.getState().login(email.trim(), password);
    } catch (err) {
      setError(err.message);
    } finally {
      setEnviando(false);
    }
  }

  return (
    <div
      className="flex h-full items-center justify-center px-4"
      style={{ backgroundImage: 'radial-gradient(circle at 1px 1px, #1a2635 1px, transparent 0)', backgroundSize: '28px 28px' }}
    >
      <form onSubmit={enviar} className="entra w-full max-w-sm rounded-lg border border-noc-line bg-noc-panel p-6 shadow-2xl shadow-black/40">
        <div className="mb-6 flex items-center gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-md border border-estado-ok/40 bg-estado-ok/10 text-estado-ok">
            <Activity size={20} />
          </span>
          <div>
            <h1 className="text-lg font-semibold leading-tight">NOC Console</h1>
            <p className="text-sm text-noc-muted">Enlaces de transporte y fibra óptica</p>
          </div>
        </div>

        <label className="mb-1 block text-sm text-noc-muted" htmlFor="email">Correo</label>
        <input
          id="email" type="email" required autoFocus autoComplete="username"
          value={email} onChange={(e) => setEmail(e.target.value)}
          className="mb-4 w-full rounded-md border border-noc-line bg-noc-bg px-3 py-2 text-sm placeholder:text-noc-muted/60"
          placeholder="nombre@empresa.cl"
        />

        <label className="mb-1 block text-sm text-noc-muted" htmlFor="password">Contraseña</label>
        <input
          id="password" type="password" required autoComplete="current-password"
          value={password} onChange={(e) => setPassword(e.target.value)}
          className="mb-4 w-full rounded-md border border-noc-line bg-noc-bg px-3 py-2 text-sm"
        />

        {error && (
          <p role="alert" className="mb-4 rounded-md border border-estado-down/40 bg-estado-down/10 px-3 py-2 text-sm text-red-300">
            {error}
          </p>
        )}

        <button
          type="submit" disabled={enviando}
          className="flex w-full items-center justify-center gap-2 rounded-md bg-estado-ok px-3 py-2 text-sm font-semibold text-noc-bg hover:brightness-110 disabled:opacity-60"
        >
          {enviando && <Loader2 size={16} className="animate-spin" />}
          {enviando ? 'Ingresando…' : 'Ingresar'}
        </button>
      </form>
    </div>
  );
}
