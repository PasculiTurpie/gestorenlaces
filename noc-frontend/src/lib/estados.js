export const ESTADOS = ['OK', 'Degradado', 'Caido', 'Mantenimiento'];

// peso = severidad para ordenar alarmas y decidir el estado "peor" de un nodo
export const ESTADO_META = {
  OK: { label: 'OK', color: '#22c55e', peso: 0 },
  Mantenimiento: { label: 'Mantenimiento', color: '#3b82f6', peso: 1 },
  Degradado: { label: 'Degradado', color: '#f97316', peso: 2 },
  Caido: { label: 'Caído', color: '#ef4444', peso: 3 },
};

export const esFalla = (estado) => estado === 'Caido' || estado === 'Degradado';

/**
 * Estilo visual de una arista según el estado del enlace.
 *  OK: verde sólido · Degradado: naranja sólido · Caído: rojo punteado parpadeante · Mantenimiento: azul punteado fino
 */
export function estiloEnlace(estado, resaltado = false) {
  const extra = resaltado ? 1.4 : 0;
  switch (estado) {
    case 'Caido':
      return { stroke: '#ef4444', strokeWidth: 2.6 + extra, strokeDasharray: '7 5', className: 'edge-blink' };
    case 'Degradado':
      return { stroke: '#f97316', strokeWidth: 2.4 + extra, className: 'edge-degradado' };
    case 'Mantenimiento':
      return { stroke: '#3b82f6', strokeWidth: 2.2 + extra, strokeDasharray: '2 6', strokeLinecap: 'round', className: '' };
    default:
      return { stroke: '#22c55e', strokeWidth: 1.6 + extra, className: '' };
  }
}

export const puedeMoverNodos = (rol) => rol === 'Supervisor' || rol === 'Admin';
