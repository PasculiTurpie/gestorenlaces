// Integración con iMaster NCE: lógica pura de presentación (sin React).

/** Estado de la conexión para mostrar: { clave, etiqueta, nivel } con nivel ok | warn | error | muted. */
export function estadoConexion(e) {
  if (!e) return { clave: 'cargando', etiqueta: 'Cargando…', nivel: 'muted' };
  if (e.error_configuracion) return { clave: 'config', etiqueta: 'Configuración inválida', nivel: 'error' };
  if (!e.configurado) return { clave: 'sin_config', etiqueta: 'Sin configurar', nivel: 'muted' };
  if (!e.habilitado) return { clave: 'desactivada', etiqueta: 'Desactivada', nivel: 'muted' };
  if (e.ultimo_error) return { clave: 'error', etiqueta: e.ultima_ok ? 'Con errores (mostrando la última lectura)' : 'Con errores', nivel: 'error' };
  if (!e.ultima_ok) return { clave: 'esperando', etiqueta: 'Esperando la primera lectura', nivel: 'warn' };
  return { clave: 'ok', etiqueta: 'Conectado', nivel: 'ok' };
}

/** ¿La app ya tiene tipificada esta alarma de NCE? Se casa por el código (nombre de la alarma). */
export const tipificacionDe = (alarma, catalogo) => catalogo.find((t) => t.codigo === alarma.codigo && t.activo !== false) ?? null;

/** Alarmas con su tipificación (si existe) y el enlace de la app (si la correspondencia lo encuentra). */
export function enriquecerAlarmas(alarmas, catalogo, enlaces) {
  const porCodigo = new Map(Object.values(enlaces).map((l) => [l.id_enlace, l]));
  return alarmas.map((a) => ({ ...a, tipificacion: tipificacionDe(a, catalogo), enlaceApp: a.enlace ? porCodigo.get(a.enlace.enlace) ?? null : null }));
}

/** Resumen en una línea de las alarmas leídas: cuántas se pueden relacionar y cuántas no. */
export function resumenAlarmas(lista) {
  const conEnlace = lista.filter((a) => a.enlace).length;
  const sinTipificar = lista.filter((a) => !a.tipificacion).length;
  return { total: lista.length, conEnlace, sinEnlace: lista.length - conEnlace, sinTipificar };
}

/** Texto del paso de una prueba de conexión: ✓ correcto · ✗ falló · – omitido. */
export const marcaPaso = (p) => (p.omitido ? '–' : p.ok ? '✓' : '✗');

/** Variables del archivo .env para activar la integración (el servidor las lee al arrancar). */
export const VARIABLES_ENV = [
  ['NCE_ENABLED', 'true', 'Activa la sincronización automática'],
  ['NCE_BASE_URL', 'https://nce.su-empresa.cl:26335', 'Dirección del servicio de NCE (ejemplo)'],
  ['NCE_USERNAME', 'usuario-de-integracion', 'Usuario de solo lectura'],
  ['NCE_PASSWORD', '********', 'Su contraseña (solo en el servidor, nunca se muestra)'],
  ['NCE_TLS_VERIFY', 'true', 'Verificar el certificado de NCE (recomendado)'],
  ['NCE_CA_FILE', './config/nce-ca.pem', 'Certificado de la autoridad de NCE, si no es pública'],
  ['NCE_POLL_SECONDS', '60', 'Cada cuántos segundos se leen las alarmas'],
];
