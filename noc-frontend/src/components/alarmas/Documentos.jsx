import { Download, Eye, File, FileSpreadsheet, FileText, Loader2 } from 'lucide-react';
import { useState } from 'react';
import { api } from '../../lib/api.js';
import { COLOR_TIPO, ETIQUETA_TIPO, fmtTamano, guardarBlob } from '../../lib/archivos.js';
import { describirError } from '../../lib/errores.js';
import { fechaHora } from '../../lib/format.js';
import { useTopology } from '../../store/topologyStore.js';
import VisorPdf from './VisorPdf.jsx';

const ICONO = { pdf: File, docx: FileText, xlsx: FileSpreadsheet };

export function IconoDocumento({ extension, size = 18 }) {
  const Icono = ICONO[extension] ?? File;
  return <Icono size={size} style={{ color: COLOR_TIPO[extension] ?? '#8296ab' }} aria-hidden="true" />;
}

/** Documentos de procedimiento adjuntos a una alarma: se pueden ver (PDF) y descargar. */
export default function Documentos({ adjuntos }) {
  const [descargando, setDescargando] = useState(null);
  const [visor, setVisor] = useState(null);

  async function descargar(a) {
    setDescargando(a._id);
    try { guardarBlob(await api.descargarAdjunto(a._id), a.nombre); }
    catch (err) { useTopology.getState().pushToast({ nivel: 'critico', texto: `No se pudo descargar «${a.nombre}»: ${describirError(err)}` }); }
    setDescargando(null);
  }

  return (
    <section aria-label="Documentos del procedimiento" className="mb-4">
      <h4 className="mb-1.5 text-xs font-medium uppercase tracking-wide text-noc-muted">Documentos del procedimiento</h4>
      <ul className="space-y-1.5">
        {adjuntos.map((a) => (
          <li key={a._id} className="flex items-center gap-3 rounded-md border border-noc-line px-3 py-2">
            <IconoDocumento extension={a.extension} />
            <div className="min-w-0 flex-1">
              <div className="truncate text-sm">{a.nombre}</div>
              <div className="truncate text-xs text-noc-muted">
                {ETIQUETA_TIPO[a.extension]} · {fmtTamano(a.tamano_bytes)}{a.descripcion ? ` · ${a.descripcion}` : ''} · {fechaHora(a.createdAt)}
              </div>
            </div>
            {a.extension === 'pdf' && (
              <button type="button" onClick={() => setVisor(a)} aria-label={`Ver ${a.nombre}`} className="inline-flex items-center gap-1.5 rounded-md border border-noc-line px-2 py-1 text-xs hover:bg-noc-raised">
                <Eye size={13} /> Ver
              </button>
            )}
            <button type="button" onClick={() => descargar(a)} disabled={descargando === a._id} aria-label={`Descargar ${a.nombre}`} className="inline-flex items-center gap-1.5 rounded-md border border-noc-line px-2 py-1 text-xs hover:bg-noc-raised disabled:opacity-50">
              {descargando === a._id ? <Loader2 size={13} className="animate-spin" /> : <Download size={13} />} Descargar
            </button>
          </li>
        ))}
      </ul>
      {visor && <VisorPdf adjunto={visor} onClose={() => setVisor(null)} />}
    </section>
  );
}
