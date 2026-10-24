# NOC Console — Backend (Fases 1 y 2)

Node ≥ 20 · Express 4 · Mongoose 8 · Socket.io 4 · JWT + RBAC (Operador < Supervisor < Admin)

```bash
cp .env.example .env     # MONGODB_URI y JWT_SECRET son obligatorios
npm install
npm run seed             # usuarios + 89 nodos + 118 enlaces + historial (borra las colecciones)
npm run dev              # http://localhost:4000
```

Respuestas: `{ ok: true, data, meta? }` · errores: `{ ok: false, error: { message, details? } }`.
Todas las rutas (salvo `/health` y `POST /api/auth/login`) exigen `Authorization: Bearer <token>`.

## Catálogos de nodos y enlaces

Transcritos de la captura `DWDM.png` del NMS (detección de iconos + OCR de etiquetas, verificados contra la imagen):

- `data/nodos.catalogo.js`: **89 nodos** (49 `ESTACION`, 25 `OLA`, 7 `IBTP`, 8 `NE`) con su posición en el canvas.
  Los campos `verificar` marcan nombres truncados en el NMS y un tipo dudoso.
- `data/enlaces.catalogo.js`: **118 enlaces** (109 OK y 9 Degradado, según el color de la línea en la captura).
  `id_enlace` = `ENL-<origen>-<destino>-01`, con origen = nodo más al oeste (en verticales, el de arriba).

```bash
npm run seed                               # TODO desde cero: usuarios + nodos + enlaces + historial (borra datos)
npm run seed:nodos -- --dry-run            # valida el catálogo de nodos sin conectar a la BD
npm run seed:nodos                         # upsert de nodos (conserva posiciones ya guardadas)
npm run seed:nodos -- --reset-pos          # reaplica las posiciones del catálogo
npm run seed:nodos -- --prune              # borra nodos obsoletos (los que tengan enlaces se conservan)
npm run seed:tipos                         # tipos de línea base: Propio, WOM, Tigo, Claro, Entel (idempotente)
npm run seed:alarmas                       # catálogo de alarmas DWDM (14); renombra SPAN_LOSS y desactiva las genéricas anteriores (idempotente)
npm run seed:enlaces                       # crea los enlaces que falten y completa tipo/filamentos de los existentes (conserva estados)
```

Las cargas parciales (`seed:nodos`, `seed:enlaces`) son idempotentes y no tocan usuarios ni historial.

## Tipos de línea y filamentos

- Cada enlace tiene un **tipo de línea** (`tipo_enlace`): `PROPIO`, `WOM`, `TIGO`, `CLARO`, `ENTEL`… Lo administra un Admin.
  Los 5 enlaces que cuelgan de los nodos `WOM_*` quedan como WOM en el catálogo (inferido por el nombre; confirmar).
- Cada enlace tiene siempre **dos filamentos**: `ida` (origen → destino) y `vuelta` (destino → origen), cada uno con su
  **levantamiento**: potencia Tx y Rx (dBm, entre −60 y +40), fecha, observación y quién lo registró. La atenuación es Tx − Rx.
- Para actualizar una base ya cargada sin borrar nada: `npm run seed:enlaces` (crea los tipos base y completa los enlaces existentes).

## Alarmas por filamento y tipificación

- Cada **filamento** (ida y vuelta) tiene su propio estado (`OK`, `Degradado`, `Caido`, `Mantenimiento`) y, si está alarmado,
  su **alarma**: la tipificación (qué es y qué hacer) y una observación. Se puede alarmar solo la ida, solo la vuelta o ambas.
- El estado del **enlace** es el peor de sus dos filamentos (Caído > Degradado > Mantenimiento > OK). Las incidencias y las
  métricas siguen siendo por enlace; cada incidencia registra además la tipificación y los filamentos afectados.
- Los enlaces creados antes de esta función no tienen estado por filamento: heredan el del enlace (no requiere migración).
- Cambiar un filamento no pisa al otro: si la ida está Caída y la vuelta pasa a Degradada, el enlace sigue Caído con la misma incidencia.
- La **tipificación** (`AlarmType`) la administra un Admin. El catálogo de partida es GENÉRICO: revise y ajuste significados,
  procedimientos, escalamientos y tiempos a su operación real.
- El evento `link:updated` trae `cambio: { de, a, filamentos, fibraDe, fibraA, tipificacion }` (de/a = estado del enlace;
  fibraDe/fibraA = lo que cambió en los filamentos).

## Catálogo de alarmas DWDM

`npm run seed:alarmas` deja la tipificación según el catálogo DWDM (Huawei) de `scripts/lib/alarmasBase.js`: BEFFEC_EXC, SPAN_LOSS_EXCEED_EOL, SPAN_LOSS_EXCEED_BOL,
R_LOS, R_LOF, HARD_BAD, IN_PWR_HIGH, IN_PWR_LOW, MUT_LOS, OSC_LOS, TEMP_ALAM, OTU_LOF, ODU_AIS y FAN_FAIL. Cada una trae su definición (nombre) y su causa común (significado);
**no trae procedimientos, escalamientos ni tiempos**: son de la operación y se cargan en Administración → Alarmas (pasos propios y/o documentos adjuntos).
El estado sugerido (Caído/Degradado) es una propuesta que solo ordena las opciones al registrar; un Admin puede cambiarlo.

Es idempotente y no pisa lo que ya se editó:
- **Renombra** `SPAN_LOSS` → `SPAN_LOSS_EXCEED_EOL` conservando el mismo registro (procedimiento, escalamiento, tiempo y documentos adjuntos).
- **Crea** las que falten; las que ya existen no se modifican.
- **Desactiva** las genéricas de la primera versión (LOS, LOF, CORTE, ATEN, SD, ENERGIA, EQUIPO, TERCEROS, MANT) sin borrarlas, para no perder el historial de incidencias.
  Con `npm run seed:alarmas -- --conservar-genericas` no se desactivan. Las que no tengan uso se pueden eliminar desde Administración → Alarmas.
- Informa los conflictos (por ejemplo, un nombre ya usado por otra tipificación) en lugar de ocultarlos.

Incluye dos tipificaciones de **mantenimiento** (`MANT_PROG` programado y `MANT_CORR` correctivo), con estado sugerido «Mantenimiento»; un Admin puede agregar más
(p. ej. cambio de tarjeta, limpieza de conectores) con ese mismo estado sugerido. Para que existan en una base ya cargada, ejecute `npm run seed:alarmas` (no modifica lo que ya existe).
Desde ahora **pasar un enlace a Mantenimiento también exige elegir la tipificación**, igual que Caído y Degradado.

## Ítems de atención del turno

Lo que hay que atender **además de los enlaces** (corte de cable secundario, corte de energía, falla de climatización…). Son **transversales**: no pertenecen al acta de un operador sino a todo el NOC, así que
los ven y atienden todos los operadores que estén de turno y **siguen abiertos de un turno al siguiente** hasta que alguien los resuelve. Cada ítem lleva título, **ticket** (obligatorio), descripción y **quién lo ingresó**:
el nombre y el id salen de la sesión (el cliente no puede enviarlos ni cambiarlos después) junto con la fecha y el turno en que se ingresó.

| Ruta | Rol mínimo | Descripción |
|---|---|---|
| `GET /api/shift-items?estado=Abierto\|Resuelto\|todos&q=` | auth | Por defecto, los abiertos (más nuevos primero); los resueltos, por fecha de resolución |
| `POST /api/shift-items` | auth | Ingresa uno: `{ titulo, ticket, descripcion }` (cualquier otro campo se rechaza) |
| `PATCH /api/shift-items/:id` | auth | Corrige título, ticket o descripción mientras está abierto (queda en su historial) |
| `POST /api/shift-items/:id/seguimiento` | auth | Agrega una nota con el nombre de quien la escribe |
| `POST /api/shift-items/:id/resolver` | auth | Exige `resolucion`; guarda quién lo resolvió y cuándo (atómico: no se resuelve dos veces) |
| `POST /api/shift-items/:id/reabrir` | auth | Lo vuelve a abrir |

Avisa por Socket.io (`item:changed`). El acta imprimible (`GET /api/shifts/:id/print`) incluye los ítems ingresados durante el turno y los que seguían abiertos al cierre. Cerrar un turno **no** exige resolverlos.

## Conexión con iMaster NCE (solo lectura)

El servidor puede leer las alarmas activas de iMaster NCE, interpretarlas y relacionarlas con los enlaces. **Solo consulta**: no escribe en NCE ni cambia estados de enlaces por sí solo.
Está en `src/integraciones/nce/` y se ve en Administración → Integración NCE (Supervisor y Admin). Manual completo: capítulo 11 del manual de uso.

> **Importante:** no se dispone de la guía de la API de NCE-T de su versión. El perfil incluido (`config/nce.perfil.ejemplo.json`) es una **plantilla no verificada** que coincide con el simulador.
> Ajústelo a la guía real (rutas, autenticación, campos) y póngale `"verificado": true` cuando lo haya contrastado. No hace falta tocar el código.

- **Variables (`.env`)**: `NCE_ENABLED`, `NCE_BASE_URL`, `NCE_USERNAME`, `NCE_PASSWORD`, `NCE_TLS_VERIFY` (déjelo en `true`), `NCE_CA_FILE` (CA propia en PEM), `NCE_POLL_SECONDS` (mín. 10), `NCE_TIMEOUT_MS`, `NCE_PROFILE`, `NCE_MAPPINGS`.
  Las credenciales solo viven en el entorno: no se guardan en la base ni salen por la API.
- **Perfil** (`autenticacion`, `alarmas`, `campos`, `severidad`): describe cómo habla la API. Autenticación por token (JSON o formulario), básica o ninguna; paginación opcional. Si es inválido, el error indica el campo.
- **Correspondencias** (`config/nce.correspondencia.ejemplo.json`): `{ ne, puerto?, enlace, sentido? }`. Relacionan equipo/puerto de NCE con enlace y filamento; gana la regla con puerto.
- **Cliente**: tiempo máximo, tope de 10 MB, TLS verificado (error claro si el certificado no es de confianza), renovación del token (antes de vencer y ante 401), reintentos con espera creciente ante errores de red y 5xx, y **sin reintentos con credenciales rechazadas** (para no bloquear la cuenta).
- **Sincronización**: cada `NCE_POLL_SECONDS` (se espacia hasta 5× tras fallos); conserva la última lectura buena. `socket`: `nce:sincronizado`.

| Ruta | Rol mínimo | Descripción |
|---|---|---|
| `GET /api/integraciones/nce/alarmas` | auth | Última lectura, ya relacionada con los enlaces |
| `GET /api/integraciones/nce/estado` | Supervisor | Estado (sin contraseña), perfil, última lectura y último error |
| `POST /api/integraciones/nce/probar` | Supervisor | Prueba paso a paso (configuración → autenticación → consulta → interpretación → correspondencia); no guarda nada |
| `POST /api/integraciones/nce/sincronizar` | Supervisor | Lee las alarmas ahora |
| `POST /api/integraciones/nce/recargar` | Admin | Relee perfil y correspondencias sin reiniciar |

**Probar sin un NCE real:** `npm run nce:simulador` (puerto 4600, usuario `integracion`, clave `cambiar-esta-clave`) y, en el `.env`:
`NCE_ENABLED=true`, `NCE_BASE_URL=http://127.0.0.1:4600`, `NCE_USERNAME=integracion`, `NCE_PASSWORD=cambiar-esta-clave`.

## Servicios que pasan por cada enlace

Cada servicio (una señal de TV, un circuito de datos…) tiene nombre, cliente, tipo, capacidad, código y observación, y **los enlaces por los que pasa** (en orden). Sirve para saber
a qué servicios afecta una falla o un mantenimiento: se ve al consultar un enlace y, en las alarmas activas, cuántos servicios afecta cada una. El nombre identifica al servicio
(sin distinguir mayúsculas ni tildes), por eso volver a subir un archivo no duplica nada.

| Ruta | Rol mínimo | Descripción |
|---|---|---|
| `GET /api/services?enlace=&q=&page=&limit=` | auth | `enlace`: código o id → los servicios que pasan por él. `q`: nombre, cliente, tipo o código |
| `GET /api/services/resumen` | auth | `{ servicios, por_enlace: { <idEnlace>: n } }` |
| `POST /api/services` · `PATCH /api/services/:id` · `DELETE /api/services/:id` | Supervisor | Alta, edición (los enlaces se reemplazan, conservando el orden indicado) y baja |
| `POST /api/services/import` | Supervisor | Importación desde Excel o texto (ver abajo) |

Al eliminar un enlace, sale de los servicios que lo referían.

**Importación** (`multipart/form-data`: `archivo` + campos). El navegador envía el mismo archivo en tres fases:
1. sin `mapeo` → `fase: "columnas"`: hojas, columnas con una muestra, las primeras filas y el mapeo sugerido por los encabezados;
2. con `mapeo` (JSON con el índice de cada columna) → `fase: "vista_previa"`: qué se crearía/actualizaría y qué filas tienen problemas. **No guarda nada**;
3. con `confirmar=true` → `fase: "aplicado"`: guarda. Las filas con problemas se omiten y se informan; repetir el archivo no cambia nada.

Campos: `mapeo`, `modo` (`agregar` suma enlaces a los que ya tiene; `reemplazar` sustituye la ruta, solo para servicios que el archivo trae con enlaces válidos), `confirmar`, `hoja`, `fila_encabezado`.

- **Formatos:** `.xlsx` (no `.xls`: «Guardar como .xlsx»), `.txt` y `.csv` (se detecta tabulador, `;`, `,` o `|`; UTF-8 o Windows-1252; comillas). Fórmulas: se lee su valor guardado. Celdas combinadas
  verticalmente: el servicio se repite en cada fila. Se rechazan libros con macros.
- **Límites:** 5 MB, 20 000 filas, 40 columnas y 100 MB al descomprimir (protege de «bombas ZIP»).
- **Enlace:** una columna con el código (`ENL-VLDV-LANC-01`, o sin el prefijo), los nodos que une (`VLDV-LANC`, `VLDV → LANC`, `LANC ⇄ VLDV`) o un recorrido (`VLDV → LANC → PNGP` = dos enlaces); varios
  separados por coma, `;` o salto de línea. También sirven dos columnas, origen y destino. Si hay más de un enlace entre los mismos nodos, se pide el código. Si algo del recorrido no se reconoce, no se toma nada de esa referencia.

## Mantenimientos programados y en curso

Para que todo el NOC sepa que se va a trabajar (o se está trabajando) en uno o varios enlaces. Un mantenimiento tiene título, enlaces (1–50), tipificación de mantenimiento,
ventana (inicio y fin previsto), ticket, descripción y si se prevé corte. Estados: **Programado → En curso → Finalizado**, o **Cancelado** (solo si no se inició).

| Ruta | Rol mínimo | Descripción |
|---|---|---|
| `GET /api/maintenance?estado=&enlace=&desde=&hasta=` | auth | Por defecto, los activos (Programado y En curso). `estado` admite una lista: `Finalizado,Cancelado` |
| `GET /api/maintenance/:id` | auth | Con historial |
| `POST /api/maintenance` | Operador | Programa uno (no modifica enlaces; el fin no puede estar en el pasado) |
| `PATCH /api/maintenance/:id` | Operador | Edita; en curso no se cambian enlaces, tipificación ni inicio |
| `POST /api/maintenance/:id/start` | Operador | Los enlaces pasan a **Mantenimiento** (con la tipificación y el ticket) |
| `POST /api/maintenance/:id/finish` | Operador | Los filamentos que sigan en Mantenimiento vuelven a **OK** |
| `POST /api/maintenance/:id/cancel` | Operador | Solo Programado; exige `motivo` |

Iniciar y finalizar usan el mismo cambio de estado auditado que el resto (timeline del enlace e incidencias coherentes) y avisan por Socket.io (`link:updated` por cada enlace y
`maintenance:changed`). Si algún enlace no se puede actualizar, el resto sí se aplica y la respuesta trae `resultado.fallidos`; finalizar con errores deja el mantenimiento En curso
para reintentar. Lo que cambió durante el trabajo se respeta (un enlace que volvió a fallar no se pisa). No hay procesos automáticos: iniciar y finalizar son acciones del operador.

## Horario de los turnos

Definido una sola vez en `src/config/turnos.js` (hora local de `APP_TIMEZONE`, con cambio de horario incluido):

| Turno | Horario | Recibe de |
|---|---|---|
| Mañana | 08:00 – 15:30 | Noche |
| Tarde | 15:30 – 23:00 | Mañana |
| Noche | 23:00 – 08:00 (cruza la medianoche) | Tarde |

El límite pertenece al turno que empieza (15:30 ya es Tarde). Al abrir se propone el turno que corresponde por la hora, o el que empieza en los próximos
`TOLERANCIA_APERTURA_MIN` minutos (por defecto 30; admite 0–120). Para cambiar un horario, edite `HORARIOS`: el frontend lo toma de `GET /api/shifts/schedule`.

**Fecha del turno** (`fecha_turno`, "AAAA-MM-DD"): Mañana y Tarde pertenecen al día en que empiezan; la **Noche pertenece al día en que termina**
(quien entra el 19 a las 23:00 hace el turno noche del 20). Se fija al abrir, según el horario y no según la hora exacta de apertura: abrir a las 22:40 o a las 02:00
da el mismo día. El historial (`GET /api/shifts?desde=&hasta=`, fechas `AAAA-MM-DD`) filtra por esta fecha, no por la hora de inicio.
Las actas anteriores a este campo se completan solas al arrancar el servidor (también con `npm run migrar:fecha-turno`, o `-- --dry` para solo contarlas);
la escritura no modifica `updatedAt`.

## Documentos de procedimiento (.docx, .pdf, .xlsx)

Cada tipificación de alarma puede llevar documentos adjuntos (hasta 10, 15 MB cada uno; `MAX_UPLOAD_MB`). Los sube un Admin y los ven
y descargan todos los roles junto al significado y los pasos de la alarma.

- **Almacenamiento:** el archivo se guarda en disco, en `UPLOADS_DIR` (por defecto `./uploads`), con un nombre generado por el
  servidor (`<id>.<ext>`); en MongoDB solo se guardan los metadatos y una huella SHA-256. **Incluya `UPLOADS_DIR` en los respaldos** y, en
  contenedores, móntelo como volumen persistente. Si un archivo falta en el disco, la descarga responde 410 con un mensaje claro.
- **Validación (servidor):** solo .docx, .pdf y .xlsx, comprobando también el **contenido** (cabecera %PDF-, o contenedor ZIP con las partes
  de Word/Excel): un ejecutable renombrado a .pdf se rechaza. Se rechazan los documentos con macros. El nombre se sanea (sin rutas ni saltos de línea).
- **Descarga:** `Content-Disposition` seguro, `nosniff`, sin caché; solo los PDF pueden mostrarse en línea.
- **No hay análisis antivirus.** Si la política de la empresa lo exige, intégrelo en `guardarAdjunto()` (`services/adjuntos.service.js`) antes de escribir el archivo.

### Si falla la subida de documentos

1. **Administración → Sistema** (Admin): muestra si la carpeta de documentos se puede leer y escribir, el espacio libre y la conexión a la base.
2. **Consola del backend:** al arrancar escribe `[docs] Carpeta de documentos lista: <ruta>` o `[docs] ⚠ NO se puede usar la carpeta…` con el motivo.
   Cada error 5xx deja `[error REF] POST /ruta` con el detalle; la pantalla muestra la misma referencia `(ref. REF)`.
3. Un «Error 500 … sin detalle» en pantalla no viene de la API: es el proxy de desarrollo (terminal de Vite: «http proxy error») y significa que el backend no respondió.
4. Detrás de nginx/ALB, el servidor mantiene abiertas las conexiones inactivas 65 s (`keepAliveTimeout`) para evitar cortes esporádicos.

## Longitud y tramos por zonal

Un enlace puede cruzar varias zonales. Cada enlace guarda su **longitud total** (`longitud_km`, opcional) y una lista de
**tramos** `{zonal, km_desde, km_hasta}`, con los kilómetros medidos desde el nodo origen (km 0) hacia el destino.
Reglas: cada tramo termina después de empezar, los tramos no se solapan, y ninguno excede la longitud. Pueden quedar
kilómetros sin asignar. Las zonales las crea un Admin (no se siembran: dependen de la operación real).

## Endpoints

| Método y ruta | Rol mínimo | Descripción |
|---|---|---|
| `POST /api/auth/login` · `GET /api/auth/me` | — / auth | Login (10 fallos / 15 min por IP) y usuario actual |
| **Enlaces** | | |
| `GET /api/links` | auth | `?estado=Caido,Degradado&nodo=VLDV&proveedor=&tipo=WOM&page=&limit=` |
| `GET /api/links/:id` | auth | Detalle + timeline + incidencia abierta (`:id` = ObjectId o `id_enlace`) |
| `GET /api/links/metrics` · `GET /api/links/:id/metrics` | auth | Uptime % y MTTR mensual (`?year=&month=&incluirDegradado=`) |
| `PATCH /api/links/:id/status` | Operador | Único camino para cambiar el estado. Body: `{estado, filamentos?: ["ida"\|"vuelta"], tipificacion?: "LOS", observacion?, ticket?, causa_raiz?}`. Sin `filamentos` aplica a ambos (como antes) |
| `POST /api/links/:id/timeline` | Operador | Nota manual |
| `POST /api/links` · `PUT /api/links/:id` | Supervisor | Alta / edición: origen, destino, proveedor, `tipo_enlace` (clave u ObjectId; por defecto la red propia) |
| `PUT /api/links/:id/filamentos/:sentido` | Supervisor | Levantamiento de potencias de un filamento (`ida` o `vuelta`): `{potencia_tx_dbm, potencia_rx_dbm, fecha, observacion}`; `null` borra un valor |
| `DELETE /api/links/:id` | Admin | 409 si tiene historial salvo `?force=true` |
| **Tipos de línea** | | A quién pertenece un enlace: red propia u otra telco |
| `GET /api/link-types` | auth | Catálogo con nº de enlaces por tipo |
| `POST /api/link-types` · `PUT /api/link-types/:id` | Admin | Alta / edición (`clave` inmutable) |
| `DELETE /api/link-types/:id` | Admin | 409 si algún enlace lo usa o es la red propia |
| `PUT /api/links/:id/tramos` | Supervisor | Reparto del enlace por zonal: `{longitud_km?, tramos:[{zonal, km_desde, km_hasta}]}` (reemplaza el reparto completo; km 0 = nodo origen) |
| **Tipificación de alarmas** | | Qué significa cada alarma y el procedimiento a seguir |
| `GET /api/alarm-types` | auth | Catálogo con nº de incidencias y alarmas activas por tipo |
| `POST /api/alarm-types` · `PUT /api/alarm-types/:id` | Admin | Alta / edición: nombre, estado sugerido, significado, pasos del procedimiento, escalamiento, tiempo de respuesta (`codigo` inmutable) |
| `POST /api/alarm-types/:id/adjuntos` | Admin | Sube un documento de procedimiento (`multipart/form-data`, campo `archivo`, opcional `descripcion`): .docx, .pdf o .xlsx |
| `GET /api/adjuntos/:id/archivo` | auth | Descarga el documento (`?disposicion=inline` solo para PDF) |
| `DELETE /api/adjuntos/:id` | Admin | Elimina el documento (base y disco) |
| `DELETE /api/alarm-types/:id` | Admin | 409 si alguna incidencia o alarma activa la usa (se desactiva en su lugar). Elimina también sus documentos |
| **Sistema** | | Solo Admin |
| `GET /api/sistema/diagnostico` | Admin | Comprueba base de datos, carpeta de documentos (lectura/escritura), espacio libre, límites y entorno |
| **Zonales** | | Zonas operativas a las que pertenecen los tramos de un enlace |
| `GET /api/zonales` | auth | Catálogo con nº de enlaces que tienen tramos en cada zonal |
| `POST /api/zonales` · `PUT /api/zonales/:id` | Admin | Alta / edición (`clave` inmutable) |
| `DELETE /api/zonales/:id` | Admin | 409 si algún enlace tiene tramos en ella |
| **Usuarios** | | Solo Admin |
| `GET /api/users` · `POST /api/users` | Admin | Listado / alta |
| `PATCH /api/users/:id` | Admin | nombre, correo, rol, turno, `activo` (no se borran; no puede desactivarse a sí mismo ni dejar el sistema sin Admin) |
| `PATCH /api/users/:id/password` | Admin | Restablecer contraseña |
| **Nodos** | | |
| `GET /api/nodes` · `GET /api/nodes/:id` | auth | Lista / detalle con sus enlaces |
| `PATCH /api/nodes/:id/position` | Supervisor | `{x, y}` al soltar el nodo (emite `node:moved`) |
| `PUT /api/nodes/positions` | Supervisor | `{nodos:[{id,x,y}]}` guarda el layout completo (todo o nada) |
| `POST /api/nodes` · `PUT /api/nodes/:id` | Supervisor | Alta / edición (`id_nodo` inmutable) |
| `DELETE /api/nodes/:id` | Admin | 409 si participa en enlaces |
| **Turnos** | | Un Operador solo ve/edita sus actas; Supervisor/Admin todas |
| `POST /api/shifts/open` | auth | Abre turno y precarga el checklist con los enlaces ≠ OK |
| `GET /api/shifts/schedule` | auth | Horario de los turnos, cuál está en curso y cuál proponer al abrir |
| `GET /api/shifts/previous?antes=` | auth | **Traspaso:** último turno CERRADO de cualquier operador (con bitácora y checklist), o `data: null` si no hay. `antes` = fecha ISO: el que terminó antes de ese momento |
| `GET /api/shifts/current` | auth | Turno abierto del usuario + `pendientes_nuevos` (cayeron después de abrir) |
| `GET /api/shifts` · `GET /api/shifts/:id` | auth | Historial (`?cerrado=&tipo_turno=&desde=&hasta=&operador=`) / detalle |
| `PATCH /api/shifts/:id` | auth | Bitácora general |
| `PATCH /api/shifts/:id/checklist/:enlaceId` | auth | `{gestionado, accion_tomada}` |
| `POST /api/shifts/:id/checklist/sync` | auth | Agrega al checklist los enlaces que cayeron durante el turno |
| `POST /api/shifts/:id/close` | auth | Cierra (400 con detalle si hay enlaces sin gestionar). Acta cerrada = inmutable |
| `GET /api/shifts/:id/print` | auth | HTML imprimible A4 (ver nota) |
| **Incidencias** | | |
| `GET /api/incidents` · `GET /api/incidents/:id` | auth | `?enlace=&severidad=&abierta=&desde=&hasta=` |
| `PATCH /api/incidents/:id` | Supervisor | Completar `causa_raiz` / `ticket` (post-mortem) |

**Impresión:** `/print` necesita el header `Authorization`, así que el frontend debe hacer
`fetch` con el token, convertir la respuesta a Blob/`srcdoc` de un iframe y llamar a `print()`;
no sirve abrir la URL directamente en una pestaña. Ejemplo visual: `docs/ejemplo-acta-turno.html`.

## Eventos Socket.io (sala `noc`, handshake: `io(url, { auth: { token } })`)

| Evento | Payload |
|---|---|
| `link:created` · `link:updated` | `{ link, cambio: {de,a} \| {campos} \| null, por, ts }` |
| `link:deleted` | `{ id, id_enlace, por, ts }` |
| `node:created` · `node:updated` | `{ node, por, ts }` |
| `node:moved` | `{ id, id_nodo, posicion: {x,y}, por, ts }` |
| `node:layout` | `{ nodos: [{ id_nodo, posicion }], por, ts }` |
| `node:deleted` | `{ id, id_nodo, por, ts }` |
| `shift:opened` | `{ id, operador, tipo_turno, pendientes, ts }` |
| `shift:closed` | `{ id, operador, fecha_fin, ts }` |
| `linktype:changed` · `zonal:changed` · `alarmtype:changed` | `{ por, ts }` (los clientes releen enlaces y catálogos) |

## Secuencia de prueba (Postman)

1. `POST /api/auth/login` (Body → raw JSON) con `operador.noche@noc.local`.
2. `POST /api/shifts/open` → debe traer 3 enlaces en el checklist (Caído, Degradado, Mantenimiento).
3. `POST /api/shifts/:id/close` → **400** indicando qué enlaces faltan por gestionar.
4. `PATCH /api/shifts/:id/checklist/ENL-CHIL1-VLDV-01` con `{"gestionado":true,"accion_tomada":"Escalado a proveedor"}`; repetir para los otros dos.
5. `GET /api/shifts/:id/print` → HTML con marca BORRADOR (turno abierto). Luego `close` → 200 y sin marca.
6. Con `supervisor@noc.local`: `PATCH /api/nodes/VLDV/position` `{"x":640,"y":300}`; con operador → **403**.
7. `PATCH /api/links/ENL-CHIL1-VLDV-01/status` `{"estado":"OK","causa_raiz":"Fibra reparada"}` y revisar `GET /api/incidents?enlace=ENL-CHIL1-VLDV-01`.

## Notas operativas

- Fechas del acta impresa: `APP_TIMEZONE` (por defecto `America/Santiago`).
- Las métricas mensuales cortan el mes a medianoche en `APP_TIMEZONE` (por defecto `America/Santiago`; `rangoMes()` en `metrics.service.js`), considerando el cambio de horario. La respuesta de `GET /api/links/metrics` incluye en `meta` la ventana exacta (`desde`, `hasta`, `corte`) para consultar incidencias del mismo período.
- Detrás de nginx/ALB define `TRUST_PROXY=1` para que el rate limit vea la IP real.
