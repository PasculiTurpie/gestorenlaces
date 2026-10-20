import { Clock, PhoneCall } from 'lucide-react';
import { textoTiempoRespuesta } from '../../lib/alarmas.js';
import { cn } from '../../lib/format.js';
import EstadoBadge from '../EstadoBadge.jsx';
import Documentos from './Documentos.jsx';

/**
 * Ficha de una tipificación de alarma: qué es, qué significa y qué hacer (pasos del procedimiento), con el
 * escalamiento y el tiempo objetivo de respuesta. Se usa en la guía, al registrar una alarma y en los checklists.
 */
export default function DetalleAlarma({ alarma, compacto = false, className }) {
  const tiempo = textoTiempoRespuesta(alarma.tiempo_respuesta_min);
  const titulo = compacto ? 'text-sm' : 'text-base';

  return (
    <article aria-label={`Alarma ${alarma.codigo}: ${alarma.nombre}`} className={cn('text-sm', className)}>
      <header className="mb-3 flex flex-wrap items-center gap-2">
        <h3 className={cn('font-semibold', titulo)}>{alarma.nombre}</h3>
        <span className="rounded border border-noc-line-strong bg-noc-raised px-1.5 py-0.5 font-mono text-xs">{alarma.codigo}</span>
        <EstadoBadge estado={alarma.estado_sugerido} />
        {!alarma.activo && <span className="text-xs text-noc-muted">(desactivada)</span>}
      </header>

      <section className="mb-4" aria-label="Qué significa">
        <h4 className="mb-1 text-xs font-medium uppercase tracking-wide text-noc-muted">Qué significa</h4>
        <p className="whitespace-pre-wrap leading-relaxed">{alarma.significado || <span className="text-noc-muted">Sin descripción registrada.</span>}</p>
      </section>

      <section className="mb-4" aria-label="Qué hacer">
        <h4 className="mb-1.5 text-xs font-medium uppercase tracking-wide text-noc-muted">Qué hacer</h4>
        {alarma.procedimiento?.length ? (
          <ol className="space-y-2">
            {alarma.procedimiento.map((paso, i) => (
              <li key={i} className="flex gap-2.5">
                <span aria-hidden="true" className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-noc-raised font-mono text-[11px] text-noc-muted">{i + 1}</span>
                <span className="leading-relaxed">{paso}</span>
              </li>
            ))}
          </ol>
        ) : (
          <p className="text-noc-muted">Aún no hay un procedimiento registrado para esta alarma.</p>
        )}
      </section>

      {alarma.adjuntos?.length > 0 && <Documentos adjuntos={alarma.adjuntos} />}

      {(alarma.escalamiento || tiempo) && (
        <footer className="grid gap-2 rounded-md border border-noc-line bg-noc-bg/60 p-3 sm:grid-cols-2">
          {tiempo && (
            <p className="flex items-start gap-2"><Clock size={15} className="mt-0.5 shrink-0 text-noc-muted" /><span><span className="block text-xs text-noc-muted">Tiempo de respuesta</span>Actuar dentro de {tiempo}</span></p>
          )}
          {alarma.escalamiento && (
            <p className="flex items-start gap-2"><PhoneCall size={15} className="mt-0.5 shrink-0 text-noc-muted" /><span><span className="block text-xs text-noc-muted">Escalamiento</span>{alarma.escalamiento}</span></p>
          )}
        </footer>
      )}
    </article>
  );
}
