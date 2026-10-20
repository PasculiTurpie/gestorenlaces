import { Component } from 'react';
import { Boton } from './admin/ui.jsx';

/**
 * Evita que un error de render en una pantalla deje toda la aplicación en blanco: se muestra un mensaje con la
 * opción de reintentar y el resto (cabecera, navegación, sesión) sigue funcionando. Se reinicia al cambiar de ruta.
 */
export default class ErrorBoundary extends Component {
  state = { error: null };

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    console.error('[ui] error de render:', error, info?.componentStack);
  }

  componentDidUpdate(previas) {
    if (this.state.error && previas.clave !== this.props.clave) this.setState({ error: null });
  }

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div role="alert" className="m-auto max-w-md rounded-lg border border-estado-down/40 bg-noc-panel p-6 text-center">
        <h2 className="mb-1 text-base font-semibold">Esta pantalla tuvo un problema</h2>
        <p className="mb-4 text-sm text-noc-muted">El resto de la consola sigue funcionando. Puede reintentar o ir a otra sección.</p>
        <div className="flex justify-center gap-2">
          <Boton onClick={() => this.setState({ error: null })}>Reintentar</Boton>
          <Boton variante="primario" onClick={() => window.location.reload()}>Recargar la página</Boton>
        </div>
      </div>
    );
  }
}
