import { LinkType } from '../../src/models/LinkType.js';

/**
 * Tipos de línea base. Los colores evitan los de estado (verde/naranja/rojo/azul) porque se usan en el
 * marcador del enlace, no en la línea. Un Admin puede editarlos o agregar más desde el panel.
 */
export const TIPOS_BASE = [
  { clave: 'PROPIO', nombre: 'Propio', color: '#8296ab', descripcion: 'Enlace de la red propia', propio: true },
  { clave: 'WOM', nombre: 'WOM', color: '#a855f7', descripcion: 'Enlace de la telco WOM' },
  { clave: 'TIGO', nombre: 'Tigo', color: '#06b6d4', descripcion: 'Enlace de la telco Tigo' },
  { clave: 'CLARO', nombre: 'Claro', color: '#f43f5e', descripcion: 'Enlace de la telco Claro' },
  { clave: 'ENTEL', nombre: 'Entel', color: '#eab308', descripcion: 'Enlace de la telco Entel' },
];

/** Upsert por clave. Idempotente: nunca pisa lo que un Admin haya editado (todo va en $setOnInsert). */
export async function cargarTiposEnlace({ modelos = { LinkType }, tipos = TIPOS_BASE } = {}) {
  let creados = 0;
  for (const t of tipos) {
    const r = await modelos.LinkType.updateOne({ clave: t.clave }, { $setOnInsert: { ...t, activo: true } }, { upsert: true });
    creados += r.upsertedCount ?? 0;
  }
  return { creados, total: tipos.length };
}
