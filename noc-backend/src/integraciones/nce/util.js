/** Utilidades puras de la integración con iMaster NCE (sin red ni base de datos). */

/** Lee un valor de un objeto por ruta: "data.alarms", "items[0].name". Devuelve undefined si no existe. */
export function leerRuta(obj, ruta) {
  if (ruta === undefined || ruta === null || ruta === '') return obj;
  const partes = String(ruta).replace(/\[(\d+)\]/g, '.$1').split('.').filter(Boolean);
  let v = obj;
  for (const p of partes) {
    if (v === null || v === undefined) return undefined;
    v = v[p];
  }
  return v;
}

/** Sustituye {usuario}, {clave}... en textos, listas y objetos (recursivo). Lo que no sea texto se deja igual. */
export function sustituir(valor, vars) {
  if (typeof valor === 'string') return valor.replace(/\{(\w+)\}/g, (m, k) => (k in vars ? String(vars[k]) : m));
  if (Array.isArray(valor)) return valor.map((x) => sustituir(x, vars));
  if (valor && typeof valor === 'object') return Object.fromEntries(Object.entries(valor).map(([k, v]) => [k, sustituir(v, vars)]));
  return valor;
}

const SENSIBLE = /pass|secret|token|clave|authorization|cookie|credential|contrase/i;

/** Copia de un valor con los campos sensibles (contraseñas, tokens...) ocultos. Para mostrar o registrar respuestas de NCE. */
export function redactar(valor, profundidad = 0) {
  if (profundidad > 8) return '…';
  if (Array.isArray(valor)) return valor.map((x) => redactar(x, profundidad + 1));
  if (valor && typeof valor === 'object') return Object.fromEntries(Object.entries(valor).map(([k, v]) => [k, SENSIBLE.test(k) ? '***' : redactar(v, profundidad + 1)]));
  return valor;
}

/** Fecha en ISO-8601 (UTC) desde ISO, milisegundos o segundos de epoch. null si no se puede interpretar. */
export function aISO(valor, formato = 'auto') {
  if (valor === null || valor === undefined || valor === '') return null;
  let ms;
  const num = typeof valor === 'number' ? valor : (/^\d{9,}$/.test(String(valor).trim()) ? Number(valor) : null);
  if (formato === 'epoch_ms') ms = Number(valor);
  else if (formato === 'epoch_s') ms = Number(valor) * 1000;
  else if (formato === 'iso') ms = Date.parse(String(valor));
  else if (num !== null) ms = num > 1e11 ? num : num * 1000; // auto: más de 1e11 ya son milisegundos
  else ms = Date.parse(String(valor));
  return Number.isFinite(ms) && ms > 0 ? new Date(ms).toISOString() : null;
}

const minusculas = (s) => String(s ?? '').trim().toLowerCase();
export const igual = (a, b) => minusculas(a) === minusculas(b);
export const contiene = (texto, trozo) => minusculas(texto).includes(minusculas(trozo));
