import { Download, Loader2 } from 'lucide-react';
import { useEffect, useState } from 'react';
import { api } from '../../lib/api.js';
import { guardarBlob } from '../../lib/archivos.js';
import { describirError } from '../../lib/errores.js';
import { Aviso, Boton, Dialogo } from '../admin/ui.jsx';

/** Muestra un PDF dentro de la aplicación. El archivo exige el token, por eso se pide con fetch y se muestra desde un blob. */
export default function VisorPdf({ adjunto, onClose }) {
  const [blob, setBlob] = useState(null);
  const [url, setUrl] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    let vigente = true;
    let objeto = null;
    api.descargarAdjunto(adjunto._id, { enLinea: true })
      .then((b) => { if (!vigente) return; objeto = URL.createObjectURL(b); setBlob(b); setUrl(objeto); })
      .catch((e) => vigente && setError(describirError(e)));
    return () => { vigente = false; if (objeto) URL.revokeObjectURL(objeto); };
  }, [adjunto._id]);

  return (
    <Dialogo titulo={adjunto.nombre} descripcion={adjunto.descripcion || 'Documento del procedimiento'} onClose={onClose} ancho="max-w-5xl">
      {error && <Aviso>{error}</Aviso>}
      {!url && !error && <p className="flex items-center gap-2 text-sm text-noc-muted"><Loader2 size={15} className="animate-spin" /> Cargando documento…</p>}
      {url && (
        <>
          <iframe title={`Vista del documento ${adjunto.nombre}`} src={url} className="h-[70vh] w-full rounded-md border border-noc-line bg-white" />
          <div className="mt-3 flex justify-end gap-2">
            <Boton onClick={() => guardarBlob(blob, adjunto.nombre)}><Download size={14} /> Descargar</Boton>
            <Boton variante="primario" onClick={onClose}>Cerrar</Boton>
          </div>
        </>
      )}
    </Dialogo>
  );
}
