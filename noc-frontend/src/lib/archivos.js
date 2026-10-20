export const EXTENSIONES = ['pdf', 'docx', 'xlsx'];
export const MAX_MB = 15; // el servidor aplica su propio límite (MAX_UPLOAD_MB); esto solo evita subidas inútiles
export const ETIQUETA_TIPO = { pdf: 'PDF', docx: 'Word', xlsx: 'Excel' };
export const COLOR_TIPO = { pdf: '#f87171', docx: '#60a5fa', xlsx: '#4ade80' };

export const extensionDe = (nombre) => (String(nombre).includes('.') ? String(nombre).split('.').pop().toLowerCase() : '');

/** Primera comprobación en el navegador; la que cuenta (extensión + contenido) la hace el servidor. null = válido. */
export function validarArchivoCliente(file, { maxMb = MAX_MB } = {}) {
  if (!EXTENSIONES.includes(extensionDe(file.name))) return 'Solo se admiten archivos .docx, .pdf y .xlsx';
  if (file.size === 0) return 'El archivo está vacío';
  if (file.size > maxMb * 1024 * 1024) return `Supera el máximo de ${maxMb} MB`;
  return null;
}

/** 850 B · 42 KB · 1,3 MB */
export function fmtTamano(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1).replace('.', ',')} MB`;
}

/** Descarga un Blob con el nombre dado (los archivos requieren el token, por eso no se enlazan directamente). */
export function guardarBlob(blob, nombre) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = nombre;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}
