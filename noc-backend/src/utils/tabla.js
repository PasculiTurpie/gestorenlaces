import ExcelJS from 'exceljs';
import { AppError } from './errors.js';
import { extensionDe, nombreLimpio } from './archivos.js';
import { normalizar } from './texto.js';

/** Lectura de tablas subidas por el usuario: Excel (.xlsx) o texto delimitado (.txt, .csv). Todo se devuelve como texto. */
export const MAX_FILAS = 20000;
export const MAX_COLUMNAS = 40;
export const MAX_TABLA_BYTES = 5 * 1024 * 1024;

const tiene = (buf, t) => buf.includes(Buffer.from(t, 'latin1'));

export const MAX_DESCOMPRIMIDO = 100 * 1024 * 1024; // un .xlsx es un ZIP: un archivo pequeño podría descomprimirse a cientos de MB («bomba ZIP»)
const MAX_ENTRADAS_ZIP = 2000;

/** Suma lo que ocuparía el ZIP descomprimido, leyendo su directorio central (sin descomprimir nada). null si no se puede leer. */
export function tamanoDescomprimido(buf) {
  const minimo = Math.max(0, buf.length - 65557); // el registro final puede estar tras un comentario de hasta 64 KB
  let fin = -1;
  for (let i = buf.length - 22; i >= minimo; i -= 1) if (buf.readUInt32LE(i) === 0x06054b50) { fin = i; break; }
  if (fin < 0) return null;
  const entradas = buf.readUInt16LE(fin + 10);
  let pos = buf.readUInt32LE(fin + 16);
  if (entradas > MAX_ENTRADAS_ZIP) return { entradas, total: Infinity };
  let total = 0;
  for (let n = 0; n < entradas; n += 1) {
    if (pos + 46 > buf.length || buf.readUInt32LE(pos) !== 0x02014b50) return null;
    total += buf.readUInt32LE(pos + 24);
    pos += 46 + buf.readUInt16LE(pos + 28) + buf.readUInt16LE(pos + 30) + buf.readUInt16LE(pos + 32);
  }
  return { entradas, total };
}

/** Valida nombre y contenido (no solo la extensión). Devuelve la extensión: 'xlsx' | 'txt' | 'csv'. */
export function validarArchivoTabla({ buffer, nombre }) {
  const ext = extensionDe(nombreLimpio(nombre));
  if (ext === 'xls') throw new AppError(415, 'El formato .xls (Excel antiguo) no se admite: ábralo en Excel y use «Guardar como» .xlsx');
  if (!['xlsx', 'txt', 'csv'].includes(ext)) throw new AppError(415, 'Solo se admiten archivos Excel (.xlsx) o de texto (.txt, .csv)');
  if (!buffer?.length) throw new AppError(400, 'El archivo está vacío');
  if (buffer.length > MAX_TABLA_BYTES) throw new AppError(413, `El archivo supera el máximo de ${MAX_TABLA_BYTES / 1024 / 1024} MB para importar`);
  if (ext === 'xlsx') {
    const zip = buffer.length > 4 && buffer[0] === 0x50 && buffer[1] === 0x4b && buffer[2] === 0x03 && buffer[3] === 0x04;
    if (!zip || !tiene(buffer, '[Content_Types].xml') || !tiene(buffer, 'xl/workbook.xml')) throw new AppError(415, 'El contenido no corresponde a un archivo .xlsx válido');
    if (tiene(buffer, 'vbaProject.bin')) throw new AppError(415, 'No se admiten libros con macros');
    const z = tamanoDescomprimido(buffer);
    if (!z) throw new AppError(415, 'El contenido no corresponde a un archivo .xlsx válido');
    if (z.total > MAX_DESCOMPRIMIDO) throw new AppError(413, 'El libro es demasiado grande al descomprimirse: guarde solo la hoja con los datos');
  } else if (buffer.subarray(0, 8192).includes(0)) {
    throw new AppError(415, 'El archivo parece binario, no de texto');
  }
  return ext;
}

// ------------------------------------------------------------------ texto

/** UTF-8 si es válido; si no (típico de Excel en Windows), Windows-1252. Se quita el BOM. */
export function decodificarTexto(buffer) {
  let texto;
  try { texto = new TextDecoder('utf-8', { fatal: true }).decode(buffer); } catch { texto = new TextDecoder('windows-1252').decode(buffer); }
  return texto.replace(/^\uFEFF/, '');
}

/** Parte texto delimitado respetando comillas ("a;b", "" escapada) y saltos de línea dentro de comillas. */
export function parsearDelimitado(texto, delimitador) {
  const filas = [];
  let fila = [];
  let campo = '';
  let entre = false;
  for (let i = 0; i < texto.length; i += 1) {
    const c = texto[i];
    if (entre) {
      if (c === '"') { if (texto[i + 1] === '"') { campo += '"'; i += 1; } else entre = false; } else campo += c;
    } else if (c === '"' && campo === '') entre = true;
    else if (c === delimitador) { fila.push(campo); campo = ''; }
    else if (c === '\n' || c === '\r') {
      if (c === '\r' && texto[i + 1] === '\n') i += 1;
      fila.push(campo); filas.push(fila); fila = []; campo = '';
    } else campo += c;
  }
  if (campo !== '' || fila.length) { fila.push(campo); filas.push(fila); }
  return filas.map((f) => f.map((x) => x.trim()));
}

/** Elige el delimitador (tabulador, ; , o |) que reparte las primeras líneas en un número de columnas más estable. */
export function detectarDelimitador(texto) {
  const lineas = texto.split(/\r?\n/).filter((l) => l.trim()).slice(0, 25);
  let mejor = { d: '\t', puntaje: -1 };
  for (const d of ['\t', ';', ',', '|']) {
    const cuentas = lineas.map((l) => parsearDelimitado(l, d)[0]?.length ?? 1);
    const frecuencia = new Map();
    for (const n of cuentas) frecuencia.set(n, (frecuencia.get(n) ?? 0) + 1);
    // número de columnas más repetido (a igualdad, el mayor); con una sola columna no hay delimitador
    const [moda, veces] = [...frecuencia.entries()].sort((x, y) => y[1] - x[1] || y[0] - x[0])[0] ?? [1, 0];
    if (moda < 2) continue;
    const puntaje = (veces / cuentas.length) * 100 + moda;
    if (puntaje > mejor.puntaje) mejor = { d, puntaje };
  }
  return mejor.puntaje < 0 ? '\t' : mejor.d;
}

// ------------------------------------------------------------------ Excel

function celdaATexto(v) {
  if (v === null || v === undefined) return '';
  if (v instanceof Date) return Number.isNaN(v.getTime()) ? '' : v.toISOString().slice(0, 10);
  if (typeof v === 'object') {
    if (Array.isArray(v.richText)) return v.richText.map((r) => r.text).join('').trim();
    if ('result' in v) return celdaATexto(v.result); // fórmula: su valor calculado
    if ('text' in v) return celdaATexto(v.text); // hipervínculo
    if ('error' in v) return '';
    return '';
  }
  return String(v).trim();
}

async function leerXlsx(buffer, hoja) {
  const wb = new ExcelJS.Workbook();
  try { await wb.xlsx.load(buffer); } catch { throw new AppError(415, 'No se pudo leer el archivo Excel: está dañado o no es un .xlsx válido'); }
  const hojas = wb.worksheets.map((w) => ({ nombre: w.name, filas: w.actualRowCount }));
  if (!hojas.length) throw new AppError(400, 'El libro no tiene hojas');
  const ws = hoja ? wb.getWorksheet(hoja) : wb.worksheets.find((w) => w.actualRowCount > 0) ?? wb.worksheets[0];
  if (!ws) throw new AppError(400, `El libro no tiene una hoja llamada «${hoja}»`);
  if (ws.rowCount > MAX_FILAS + 50) throw new AppError(413, `La hoja tiene demasiadas filas (máximo ${MAX_FILAS})`);
  const columnas = Math.min(ws.columnCount, MAX_COLUMNAS);
  const filas = [];
  for (let r = 1; r <= ws.rowCount; r += 1) {
    const row = ws.getRow(r);
    const f = [];
    for (let c = 1; c <= columnas; c += 1) f.push(celdaATexto(row.getCell(c).value));
    filas.push(f);
  }
  return { hojas, hoja: ws.name, filas };
}

/**
 * Lee el archivo y devuelve { formato, hojas, hoja, delimitador, filas } con filas = array de arrays de texto
 * (sin filas completamente vacías por delante ni por detrás, pero respetando las vacías intermedias).
 */
export async function leerTabla({ buffer, nombre, hoja }) {
  const formato = validarArchivoTabla({ buffer, nombre });
  let r;
  if (formato === 'xlsx') r = { ...(await leerXlsx(buffer, hoja)), delimitador: null };
  else {
    const texto = decodificarTexto(buffer);
    const delimitador = detectarDelimitador(texto);
    r = { hojas: [], hoja: null, delimitador, filas: parsearDelimitado(texto, delimitador) };
  }
  const vacia = (f) => f.every((x) => x === '');
  const ancho = Math.min(MAX_COLUMNAS, Math.max(0, ...r.filas.map((f) => f.length)));
  r.filas = r.filas.map((f) => Array.from({ length: ancho }, (_, i) => f[i] ?? ''));
  while (r.filas.length && vacia(r.filas.at(-1))) r.filas.pop();
  if (r.filas.length > MAX_FILAS) throw new AppError(413, `El archivo tiene demasiadas filas (máximo ${MAX_FILAS})`);
  if (!r.filas.some((f) => !vacia(f))) throw new AppError(400, 'El archivo no tiene datos');
  return { formato, ...r };
}

// ------------------------------------------------------------------ columnas

export { normalizar };

/** Campos que se pueden importar y cómo suelen llamarse las columnas que los traen. */
export const CAMPOS_SERVICIO = {
  servicio: ['servicio', 'nombre del servicio', 'nombre servicio', 'service', 'circuito', 'nombre'],
  codigo: ['codigo', 'cod', 'id servicio', 'id del servicio', 'codigo servicio', 'codigo del servicio', 'id'],
  cliente: ['cliente', 'customer', 'empresa', 'abonado'],
  tipo: ['tipo', 'tipo de servicio', 'tipo servicio', 'tecnologia', 'categoria', 'clase'],
  capacidad: ['capacidad', 'ancho de banda', 'bw', 'velocidad', 'bandwidth', 'tasa'],
  enlace: ['enlace', 'enlaces', 'id enlace', 'id enlaces', 'ruta', 'tramo', 'tramos', 'link', 'links', 'recorrido', 'path'],
  origen: ['origen', 'nodo origen', 'extremo a', 'nodo a', 'desde', 'a'],
  destino: ['destino', 'nodo destino', 'extremo b', 'nodo b', 'hasta', 'b'],
  observacion: ['observacion', 'observaciones', 'comentario', 'comentarios', 'notas', 'nota', 'descripcion'],
};

/** Propone qué columna es cada campo, por su encabezado: { campo: índiceDeColumna }. Una columna no se asigna dos veces. */
export function sugerirMapeo(encabezados) {
  const norm = encabezados.map(normalizar);
  const usadas = new Set();
  const mapeo = {};
  for (const exacto of [true, false]) {
    for (const [campo, sinonimos] of Object.entries(CAMPOS_SERVICIO)) {
      if (mapeo[campo] !== undefined) continue;
      const i = norm.findIndex((h, idx) => !usadas.has(idx) && h && sinonimos.some((s) => (exacto ? h === s : s.length >= 4 && (` ${h} `.includes(` ${s} `)))));
      if (i >= 0) { mapeo[campo] = i; usadas.add(i); }
    }
  }
  return mapeo;
}

/**
 * Primera fila con al menos dos valores DISTINTOS (sirve de encabezado aunque haya un título encima: un título combinado
 * a lo ancho repite el mismo texto en todas sus celdas, y no cuenta).
 */
export function detectarEncabezado(filas) {
  const i = filas.findIndex((f) => new Set(f.filter((x) => x !== '')).size >= 2);
  return i >= 0 ? i : 0;
}
