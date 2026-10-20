import { Loader2, Printer } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { api } from '../../lib/api.js';
import { describirError } from '../../lib/errores.js';
import { Aviso, Boton, Dialogo } from '../admin/ui.jsx';

/**
 * Vista previa del acta imprimible. El HTML lo genera el backend (texto escapado, tema claro, A4) y requiere el token,
 * por eso se pide con fetch y se muestra en un iframe en lugar de abrir la URL en otra pestaña.
 * "Imprimir" abre el diálogo del navegador, desde donde también se puede guardar como PDF.
 */
export default function VistaPreviaActa({ actaId, onClose }) {
  const [html, setHtml] = useState(null);
  const [error, setError] = useState(null);
  const [listo, setListo] = useState(false);
  const marco = useRef(null);

  useEffect(() => {
    let vigente = true;
    api.actaImprimible(actaId).then((t) => vigente && setHtml(t)).catch((e) => vigente && setError(describirError(e)));
    return () => { vigente = false; };
  }, [actaId]);

  function imprimir() {
    const ventana = marco.current?.contentWindow;
    ventana?.focus();
    ventana?.print();
  }

  return (
    <Dialogo titulo="Acta de turno" descripcion="Vista previa del documento. Use «Guardar como PDF» en el diálogo de impresión para conservar una copia." onClose={onClose} ancho="max-w-4xl">
      {error && <Aviso>{error}</Aviso>}
      {!html && !error && <p className="flex items-center gap-2 text-sm text-noc-muted"><Loader2 size={15} className="animate-spin" /> Generando el acta…</p>}
      {html && (
        <>
          <iframe
            ref={marco} title="Vista previa del acta de turno" srcDoc={html} onLoad={() => setListo(true)}
            // sin scripts: solo se permite imprimir desde la página principal
            sandbox="allow-same-origin allow-modals"
            className="h-[62vh] w-full rounded-md border border-noc-line bg-white"
          />
          <div className="mt-3 flex justify-end gap-2">
            <Boton onClick={onClose}>Cerrar</Boton>
            <Boton variante="primario" onClick={imprimir} disabled={!listo}><Printer size={15} /> Imprimir / Guardar PDF</Boton>
          </div>
        </>
      )}
    </Dialogo>
  );
}
