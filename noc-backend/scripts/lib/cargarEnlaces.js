import { ENLACES, idEnlace } from '../../data/enlaces.catalogo.js';
import { IncidenceLog } from '../../src/models/IncidenceLog.js';
import { Link } from '../../src/models/Link.js';
import { LinkType } from '../../src/models/LinkType.js';
import { filamentosIniciales } from '../../src/utils/filamentos.js';
import { NodeDoc } from '../../src/models/Node.js';

// Hace cuánto (min) se considera iniciado el estado actual de los enlaces que NO están en OK al cargar el catálogo
const ANTIGUEDAD_MIN = [135, 420, 60, 960, 2300, 185, 75, 310, 1500];

/** Validación sin BD: extremos existentes, sin autoenlaces, sin duplicados. Devuelve la lista de errores. */
export function validarCatalogoEnlaces(idsNodos, enlaces = ENLACES, clavesTipos = null) {
  const errores = [];
  const vistos = new Set();
  for (const e of enlaces) {
    const id = idEnlace(e);
    if (!idsNodos.has(e.origen)) errores.push(`${id}: el nodo origen "${e.origen}" no existe en el catálogo de nodos`);
    if (!idsNodos.has(e.destino)) errores.push(`${id}: el nodo destino "${e.destino}" no existe en el catálogo de nodos`);
    if (e.origen === e.destino) errores.push(`${id}: origen y destino son el mismo nodo`);
    if (clavesTipos && !clavesTipos.has(e.tipo ?? 'PROPIO')) errores.push(`${id}: tipo de línea desconocido "${e.tipo}"`);
    if (vistos.has(id)) errores.push(`${id}: enlace repetido`);
    vistos.add(id);
  }
  return errores;
}

/**
 * Carga (upsert por id_enlace) el catálogo de enlaces.
 *  - Enlace nuevo: se crea con el estado del catálogo; si no está en OK se abre su incidencia.
 *  - Enlace existente: solo se sincronizan origen/destino; el estado, ticket, proveedor y timeline NO se tocan
 *    (son datos operativos que pudo haber cambiado la sala).
 */
export async function cargarEnlaces({ operador, ahora = new Date(), modelos = { Link, NodeDoc, IncidenceLog, LinkType }, enlaces = ENLACES }) {
  const { Link: L, NodeDoc: N, IncidenceLog: I, LinkType: T } = modelos;

  const nodos = new Map((await N.find().select('id_nodo').lean()).map((n) => [n.id_nodo, n._id]));
  const tipos = new Map((await T.find().select('clave').lean()).map((t) => [t.clave, t._id]));
  if (!tipos.has('PROPIO')) throw new Error('Faltan los tipos de línea. Ejecute primero "npm run seed:tipos".');
  const faltan = validarCatalogoEnlaces(new Set(nodos.keys()), enlaces, new Set(tipos.keys()));
  if (faltan.length) throw new Error(`Catálogo de enlaces inconsistente con la BD:\n  - ${faltan.join('\n  - ')}`);

  const existentes = new Map((await L.find().select('id_enlace origen_nodo destino_nodo tipo_enlace filamentos').lean()).map((l) => [l.id_enlace, l]));
  const resultado = { creados: 0, actualizados: 0, sinCambios: 0, incidenciasAbiertas: 0, docs: new Map() };
  let k = 0;

  for (const e of enlaces) {
    const id = idEnlace(e);
    const origen = nodos.get(e.origen);
    const destino = nodos.get(e.destino);
    const previo = existentes.get(id);

    const tipo = tipos.get(e.tipo ?? 'PROPIO');

    if (previo) {
      // Solo se completa lo que falte (enlaces cargados antes de existir tipos/filamentos); lo operativo no se toca
      const cambios = {};
      if (String(previo.origen_nodo) !== String(origen)) cambios.origen_nodo = origen;
      if (String(previo.destino_nodo) !== String(destino)) cambios.destino_nodo = destino;
      if (!previo.tipo_enlace) cambios.tipo_enlace = tipo;
      if (previo.filamentos?.length !== 2) cambios.filamentos = [{ sentido: 'ida' }, { sentido: 'vuelta' }];
      if (Object.keys(cambios).length) {
        await L.updateOne({ _id: previo._id }, { $set: cambios });
        resultado.actualizados++;
      } else resultado.sinCambios++;
      continue;
    }

    const fueraDeOK = e.estado !== 'OK';
    const desde = fueraDeOK ? new Date(ahora.getTime() - ANTIGUEDAD_MIN[k++ % ANTIGUEDAD_MIN.length] * 60_000) : ahora;
    const timeline = [{ fecha: ahora, operador: operador._id, accion: 'Enlace creado', observacion: 'Carga del catálogo (captura del NMS)' }];
    if (fueraDeOK) {
      timeline.push({ fecha: desde, operador: operador._id, accion: `Estado inicial: ${e.estado}`, observacion: 'Según el color del enlace en la captura del NMS' });
    }

    const doc = await L.create({
      id_enlace: id, origen_nodo: origen, destino_nodo: destino, tipo_enlace: tipo,
      estado: e.estado, estado_desde: desde, filamentos: filamentosIniciales(e.estado, desde), proveedor: e.proveedor ?? '', ticket_actual: e.ticket ?? '', timeline,
    });
    resultado.creados++;
    resultado.docs.set(id, doc);

    if (fueraDeOK) {
      await I.create({ enlace: doc._id, severidad: e.estado, inicio: desde });
      resultado.incidenciasAbiertas++;
    }
  }
  return resultado;
}
