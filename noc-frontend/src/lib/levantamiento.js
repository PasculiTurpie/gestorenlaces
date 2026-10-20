export const SENTIDOS = ['ida', 'vuelta'];
export const ETIQUETA_SENTIDO = { ida: 'Ida', vuelta: 'Vuelta' };

const num = (v) => (typeof v === 'number' && Number.isFinite(v) ? v : null);

/** Atenuación medida (dB) = potencia emitida (Tx) - potencia recibida (Rx). null si falta alguno. */
export const calcularAtenuacion = (tx, rx) => (tx != null && rx != null ? Math.round((tx - rx) * 100) / 100 : null);

/**
 * Siempre devuelve los dos filamentos [ida, vuelta], aunque el enlace sea anterior a esta función
 * o no tenga levantamiento.
 */
export function normalizarFilamentos(raw, enlace = {}) {
  return SENTIDOS.map((sentido) => {
    const f = (raw ?? []).find((x) => x.sentido === sentido) ?? {};
    const l = f.levantamiento ?? {};
    const tx = num(l.potencia_tx_dbm);
    const rx = num(l.potencia_rx_dbm);
    const tip = f.alarma?.tipificacion;
    return {
      sentido,
      // Estado propio del filamento. Los enlaces anteriores a las alarmas por filamento no lo tienen: heredan el del enlace.
      estado: f.estado ?? enlace.estado ?? 'OK',
      estado_desde: f.estado_desde ?? enlace.estado_desde ?? null,
      alarma: tip ? { tipificacion: typeof tip === 'object' ? { _id: tip._id, codigo: tip.codigo, nombre: tip.nombre } : { _id: tip, codigo: null, nombre: 'Alarma' }, observacion: f.alarma?.observacion ?? '' } : null,
      levantamiento: {
        fecha: l.fecha ?? null,
        tx,
        rx,
        observacion: l.observacion ?? '',
        atenuacion: calcularAtenuacion(tx, rx),
        completo: tx != null && rx != null,
      },
    };
  });
}

/** "+1,20" / "-9,80" / "—" (coma decimal, siempre 2 decimales y signo explícito en positivos) */
export const fmtDbm = (n) => (n == null ? '—' : `${n > 0 ? '+' : ''}${n.toFixed(2).replace('.', ',')}`);
export const fmtDb = (n) => (n == null ? '—' : n.toFixed(2).replace('.', ','));

/** Para inputs type="number": acepta coma o punto; '' -> null; texto inválido -> NaN */
export function leerNumero(texto) {
  const t = String(texto ?? '').trim().replace(',', '.');
  if (t === '') return null;
  const n = Number(t);
  return Number.isFinite(n) ? n : NaN;
}

export const fechaParaInput = (iso) => (iso ? new Date(iso).toISOString().slice(0, 10) : '');
