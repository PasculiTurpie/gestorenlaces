export const TIPOS_NODO = ['ESTACION', 'OLA', 'IBTP', 'NE'];
export const ETIQUETA_TIPO_NODO = { ESTACION: 'Estación', OLA: 'OLA', IBTP: 'IBTP', NE: 'NE' };
export const ROLES = ['Operador', 'Supervisor', 'Admin'];
export const TURNOS = ['Mañana', 'Tarde', 'Noche'];

/** Colores sugeridos para tipos de línea: evitan los de estado (verde, naranja, rojo, azul). */
export const COLORES_TIPO = ['#a855f7', '#06b6d4', '#f43f5e', '#eab308', '#ec4899', '#14b8a6', '#8b5cf6', '#8296ab'];

/** Clave sugerida a partir de un nombre: "Claro Chile" -> "CLARO_CHILE" */
export const claveDesdeNombre = (nombre) =>
  nombre.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase().replace(/[^A-Z0-9]+/g, '_').replace(/^_+|_+$/g, '').slice(0, 24);

/** Siguiente id libre ENL-<origen>-<destino>-NN */
export function siguienteIdEnlace(origen, destino, enlaces) {
  const base = `ENL-${origen}-${destino}-`;
  const usados = Object.values(enlaces).map((l) => l.id_enlace).filter((id) => id.startsWith(base)).map((id) => Number(id.slice(base.length)) || 0);
  return `${base}${String(Math.max(0, ...usados) + 1).padStart(2, '0')}`;
}
