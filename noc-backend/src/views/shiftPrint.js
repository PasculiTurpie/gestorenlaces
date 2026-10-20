import { etiquetaTurno } from '../config/turnos.js';
/**
 * Resumen imprimible del acta de turno: HTML autocontenido, tema claro, A4.
 * TODO texto proveniente de la BD se escapa (bitácora, acciones, causas son texto libre de usuarios).
 */
const ESC = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ESC[c]);

const ESTADO_CLASE = { OK: 'ok', Degradado: 'deg', Caido: 'down', Mantenimiento: 'mant' };
const badge = (estado) => `<span class="badge ${ESTADO_CLASE[estado] ?? ''}">${esc(estado)}</span>`;

function formatearDuracion(minutos) {
  if (minutos == null) return '—';
  const total = Math.round(minutos);
  const h = Math.floor(total / 60);
  const m = String(total % 60).padStart(2, '0');
  return h ? `${h} h ${m} min` : `${total} min`;
}

export function renderShiftHtml({ acta, incidencias, tz, ahora = new Date() }) {
  const fmt = (d) =>
    d
      ? new Intl.DateTimeFormat('es-CL', { dateStyle: 'short', timeStyle: 'short', timeZone: tz }).format(new Date(d))
      : '—';

  const items = acta.checklist_enlaces ?? [];
  const recibidosConFalla = items.filter((i) => i.estado_recibido !== 'OK');
  const gestionados = recibidosConFalla.filter((i) => i.gestionado).length;
  const fin = acta.fecha_fin ?? ahora;
  const duracionMin = (new Date(fin) - new Date(acta.fecha_inicio)) / 60_000;
  const borrador = !acta.cerrado;

  const filasChecklist = items.length
    ? items
        .map((i) => {
          const enlace = i.enlace; // puede ser null si el enlace fue eliminado después
          const ruta = enlace ? `${esc(enlace.origen_nodo?.id_nodo ?? '?')} → ${esc(enlace.destino_nodo?.id_nodo ?? '?')}` : '—';
          return `<tr>
            <td class="nw"><strong>${esc(enlace?.id_enlace ?? '(enlace eliminado)')}</strong></td>
            <td class="nw">${ruta}</td>
            <td>${badge(i.estado_recibido)}</td>
            <td>${enlace ? badge(enlace.estado) : '—'}</td>
            <td class="c">${i.gestionado ? '&#10003; Sí' : '&#10007; No'}</td>
            <td>${esc(i.accion_tomada) || '—'}</td>
          </tr>`;
        })
        .join('')
    : `<tr><td colspan="6" class="c muted">Se recibió el turno sin incidentes pendientes.</td></tr>`;

  const filasIncidencias = incidencias.length
    ? incidencias
        .map(
          (inc) => `<tr>
            <td class="nw"><strong>${esc(inc.enlace?.id_enlace ?? '—')}</strong></td>
            <td>${badge(inc.severidad)}</td>
            <td>${fmt(inc.inicio)}</td>
            <td>${inc.fin ? fmt(inc.fin) : '<em>En curso</em>'}</td>
            <td>${inc.abierta ? '—' : formatearDuracion(inc.duracion_minutos)}</td>
            <td>${esc(inc.ticket) || '—'}</td>
            <td>${esc(inc.causa_raiz) || '—'}</td>
          </tr>`,
        )
        .join('')
    : `<tr><td colspan="7" class="c muted">Sin incidencias registradas durante el turno.</td></tr>`;

  return `<!doctype html>
<html lang="es">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Acta de turno — ${esc(acta.operador?.nombre ?? '')} — ${esc(fmt(acta.fecha_inicio))}</title>
<style>
  @page { size: A4; margin: 14mm; }
  * { box-sizing: border-box; }
  body { font-family: -apple-system, "Segoe UI", Roboto, Arial, sans-serif; font-size: 11px; color: #111; margin: 0; padding: 16px; position: relative; }
  h1 { font-size: 18px; margin: 0 0 2px; }
  h2 { font-size: 13px; margin: 18px 0 6px; padding-bottom: 3px; border-bottom: 2px solid #111; }
  .sub { color: #555; margin-bottom: 10px; }
  .meta { display: grid; grid-template-columns: repeat(4, 1fr); gap: 6px 14px; margin: 10px 0; }
  .meta div { border: 1px solid #ccc; border-radius: 4px; padding: 5px 7px; }
  .meta span { display: block; font-size: 9px; text-transform: uppercase; letter-spacing: .04em; color: #666; }
  table { width: 100%; border-collapse: collapse; }
  th, td { border: 1px solid #bbb; padding: 4px 6px; text-align: left; vertical-align: top; }
  th { background: #eee; font-size: 10px; text-transform: uppercase; letter-spacing: .03em; }
  tr { page-break-inside: avoid; }
  .c { text-align: center; } .muted { color: #666; } .nw { white-space: nowrap; }
  .badge { display: inline-block; padding: 1px 6px; border-radius: 9px; border: 1px solid #555; font-size: 10px; font-weight: 600; }
  .badge.ok { border-color: #15803d; color: #15803d; } .badge.deg { border-color: #c2410c; color: #c2410c; }
  .badge.down { border-color: #b91c1c; color: #b91c1c; background: #fee2e2; } .badge.mant { border-color: #1d4ed8; color: #1d4ed8; }
  .bitacora { border: 1px solid #bbb; border-radius: 4px; padding: 8px; white-space: pre-wrap; min-height: 50px; }
  .firmas { display: grid; grid-template-columns: 1fr 1fr; gap: 40px; margin-top: 46px; }
  .firmas div { border-top: 1px solid #111; padding-top: 4px; text-align: center; }
  .pie { margin-top: 18px; color: #777; font-size: 9px; }
  .borrador { position: fixed; top: 42%; left: 0; right: 0; text-align: center; font-size: 80px; font-weight: 800;
              color: rgba(0,0,0,.07); transform: rotate(-25deg); pointer-events: none; }
</style>
</head>
<body>
${borrador ? '<div class="borrador">BORRADOR</div>' : ''}
<h1>Acta de cambio de turno</h1>
<div class="sub">${borrador ? 'Turno ABIERTO — documento provisional' : 'Turno cerrado'} · ID ${esc(acta._id ?? acta.id)}</div>

<div class="meta">
  <div><span>Operador</span>${esc(acta.operador?.nombre ?? '—')}</div>
  <div><span>Turno</span>${esc(etiquetaTurno(acta.tipo_turno))}</div>
  <div><span>Fecha del turno</span>${esc(String(acta.fecha_turno ?? '').split('-').reverse().join('-') || '—')}</div>
  <div><span>Inicio</span>${esc(fmt(acta.fecha_inicio))}</div>
  <div><span>Fin</span>${acta.fecha_fin ? esc(fmt(acta.fecha_fin)) : 'En curso'}</div>
  <div><span>Duración</span>${esc(formatearDuracion(duracionMin))}</div>
  <div><span>Enlaces con falla recibidos</span>${recibidosConFalla.length}</div>
  <div><span>Gestionados</span>${gestionados} de ${recibidosConFalla.length}</div>
  <div><span>Incidencias en el turno</span>${incidencias.length}</div>
</div>

<h2>Verificación de enlaces recibidos</h2>
<table>
  <thead><tr><th>Enlace</th><th>Ruta</th><th>Estado recibido</th><th>Estado actual</th><th class="c">Gestionado</th><th>Acción tomada</th></tr></thead>
  <tbody>${filasChecklist}</tbody>
</table>

<h2>Incidencias durante el turno</h2>
<table>
  <thead><tr><th>Enlace</th><th>Severidad</th><th>Inicio</th><th>Fin</th><th>Duración</th><th>Ticket</th><th>Causa raíz</th></tr></thead>
  <tbody>${filasIncidencias}</tbody>
</table>

<h2>Bitácora general</h2>
<div class="bitacora">${esc(acta.bitacora_general) || '<span class="muted">Sin observaciones.</span>'}</div>

<div class="firmas"><div>Operador saliente</div><div>Operador entrante / Supervisor</div></div>
<div class="pie">Generado el ${esc(fmt(ahora))} (${esc(tz)}).</div>
</body>
</html>`;
}
