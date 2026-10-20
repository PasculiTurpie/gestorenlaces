// Horario de los turnos. La fuente es el backend (GET /api/shifts/schedule); aquí solo se interpreta.
//   horarios = { zona_horaria, turnos: [{ clave, inicio, fin, cruza_medianoche, anterior }], ahora: { turno, sugerido } }

export const rangoTurno = (horarios, clave) => {
  const t = horarios?.turnos?.find((x) => x.clave === clave);
  return t ? `${t.inicio}–${t.fin}` : null;
};

/** "Noche (23:00–08:00)"; sin horarios cargados, solo el nombre. */
export const etiquetaTurno = (horarios, clave) => {
  const r = rangoTurno(horarios, clave);
  return r ? `${clave} (${r})` : clave;
};

/** Turno del que se espera recibir: Mañana←Noche, Tarde←Mañana, Noche←Tarde. */
export const turnoEsperadoAntes = (horarios, clave) => horarios?.turnos?.find((x) => x.clave === clave)?.anterior ?? null;

/**
 * Comprueba que el último turno cerrado sea el que corresponde a quien entra. null si cuadra o no hay datos para decidir.
 * Si no cuadra, es un aviso (no un bloqueo): puede que el turno esperado no se haya registrado en el sistema.
 */
export function avisoContinuidad(horarios, tipoMio, anterior) {
  const esperado = turnoEsperadoAntes(horarios, tipoMio);
  if (!esperado || !anterior || anterior.tipo_turno === esperado) return null;
  const quien = anterior.operador?.nombre ? ` (${anterior.operador.nombre})` : '';
  return `Para entrar al turno ${tipoMio.toLowerCase()} se espera recibir del turno ${esperado.toLowerCase()}, pero el último turno cerrado es el ${anterior.tipo_turno.toLowerCase()}${quien}. Puede que el turno ${esperado.toLowerCase()} no se haya registrado en el sistema: confirme con quien lo cubrió.`;
}
