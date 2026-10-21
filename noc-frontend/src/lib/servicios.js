// Servicios que pasan por cada enlace: lógica pura (sin React).

export const EXTENSIONES_TABLA = ['xlsx', 'txt', 'csv'];
export const MAX_TABLA_MB = 5;

/** Datos que se pueden traer de una columna (el enlace se elige aparte). */
export const CAMPOS = [
  { clave: 'servicio', etiqueta: 'Servicio', requerido: true, ayuda: 'El nombre con que se conoce el servicio' },
  { clave: 'cliente', etiqueta: 'Cliente' },
  { clave: 'tipo', etiqueta: 'Tipo de servicio', ayuda: 'TV, datos, voz…' },
  { clave: 'capacidad', etiqueta: 'Capacidad', ayuda: '10G, STM-64…' },
  { clave: 'codigo', etiqueta: 'Código' },
  { clave: 'observacion', etiqueta: 'Observación' },
];

const extension = (nombre) => (String(nombre).includes('.') ? String(nombre).split('.').pop().toLowerCase() : '');

/** Primera comprobación en el navegador; la que cuenta (extensión + contenido) la hace el servidor. null = válido. */
export function validarArchivoTabla(file) {
  const ext = extension(file.name);
  if (ext === 'xls') return 'El formato .xls (Excel antiguo) no se admite: ábralo en Excel y use «Guardar como» .xlsx';
  if (!EXTENSIONES_TABLA.includes(ext)) return 'Solo se admiten archivos Excel (.xlsx) o de texto (.txt, .csv)';
  if (file.size === 0) return 'El archivo está vacío';
  if (file.size > MAX_TABLA_MB * 1024 * 1024) return `Supera el máximo de ${MAX_TABLA_MB} MB`;
  return null;
}

/**
 * Estado del formulario de columnas a partir del mapeo sugerido por el servidor.
 * Los valores son texto ('' = sin columna) para poder usarlos en un <select>.
 */
export function mapeoInicial(sugerido = {}) {
  const v = (c) => (sugerido[c] === undefined ? '' : String(sugerido[c]));
  const porNodos = sugerido.enlace === undefined && sugerido.origen !== undefined && sugerido.destino !== undefined;
  return { servicio: v('servicio'), cliente: v('cliente'), tipo: v('tipo'), capacidad: v('capacidad'), codigo: v('codigo'), observacion: v('observacion'), enlaceModo: porNodos ? 'nodos' : 'enlace', enlace: v('enlace'), origen: v('origen'), destino: v('destino') };
}

/** Errores del formulario de columnas ({} si es válido). */
export function validarMapeo(m) {
  const e = {};
  if (m.servicio === '') e.servicio = 'Elija la columna del servicio';
  if (m.enlaceModo === 'enlace' && m.enlace === '') e.enlace = 'Elija la columna del enlace';
  if (m.enlaceModo === 'nodos') {
    if (m.origen === '') e.origen = 'Elija la columna del origen';
    if (m.destino === '') e.destino = 'Elija la columna del destino';
    if (m.origen !== '' && m.origen === m.destino) e.destino = 'El destino debe ser otra columna';
  }
  const usadas = ['servicio', 'cliente', 'tipo', 'capacidad', 'codigo', 'observacion', ...(m.enlaceModo === 'enlace' ? ['enlace'] : ['origen', 'destino'])].filter((c) => m[c] !== '');
  const repetida = usadas.find((c, i) => usadas.findIndex((x) => m[x] === m[c]) !== i);
  if (repetida && !e[repetida]) e[repetida] = 'Esa columna ya se usa para otro dato';
  return e;
}

/** Cuerpo `mapeo` para la API: solo lo elegido, con el enlace por UNA columna o por origen+destino. */
export function mapeoAPayload(m) {
  const salida = {};
  for (const c of ['servicio', 'cliente', 'tipo', 'capacidad', 'codigo', 'observacion']) if (m[c] !== '') salida[c] = Number(m[c]);
  if (m.enlaceModo === 'nodos') { salida.origen = Number(m.origen); salida.destino = Number(m.destino); } else salida.enlace = Number(m.enlace);
  return salida;
}

export const ETIQUETA_ACCION = { crear: 'Nuevo', actualizar: 'Se actualiza', sin_cambios: 'Sin cambios' };

/** Frases del resumen de la vista previa / del resultado, en orden de importancia. */
export function frasesResumen(r, modo = 'agregar') {
  const pl = (n, uno, varios) => `${n} ${n === 1 ? uno : varios}`;
  const f = [`${pl(r.servicios, 'servicio', 'servicios')} en el archivo: ${r.nuevos} nuevo${r.nuevos === 1 ? '' : 's'}, ${r.actualizados} por actualizar, ${r.sin_cambios} sin cambios`];
  f.push(`${pl(r.asignaciones_nuevas, 'enlace nuevo asignado', 'enlaces nuevos asignados')}${r.asignaciones_quitadas ? ` y ${pl(r.asignaciones_quitadas, 'enlace quitado', 'enlaces quitados')} (modo reemplazar)` : ''}`);
  if (r.filas_con_problemas) f.push(`${pl(r.filas_con_problemas, 'fila con problemas', 'filas con problemas')}: se omiten`);
  if (r.sin_enlaces) f.push(`${pl(r.sin_enlaces, 'servicio queda', 'servicios quedan')} sin enlaces`);
  return f;
}

/** Texto de una plantilla de ejemplo (con enlaces reales del catálogo si se pasan). Delimitado por «;» y con BOM, para que Excel lo abra bien. */
export function plantillaTexto(enlaces = []) {
  const ls = enlaces.slice(0, 3).map((l) => l.id_enlace);
  const a = ls[0] ?? 'ENL-NODO1-NODO2-01';
  const b = ls[1] ?? 'ENL-NODO2-NODO3-01';
  const filas = [
    ['Servicio', 'Cliente', 'Tipo de servicio', 'Capacidad', 'Enlace', 'Observación'],
    ['TV-SENAL-01', 'Canal 13', 'TV', '10G', `${a}, ${b}`, 'Varios enlaces en una celda, separados por coma'],
    ['TV-SENAL-01', '', '', '', `${b}`, 'Otra fila del mismo servicio: se suma, no se duplica'],
    ['INT-CORP-77', 'Tigo', 'Datos', '1G', `${enlaces[0]?.origen ?? 'NODO1'} → ${enlaces[0]?.destino ?? 'NODO2'}`, 'También se entiende por los nodos que une'],
  ];
  return `\uFEFF${filas.map((f) => f.join(';')).join('\r\n')}\r\n`;
}
