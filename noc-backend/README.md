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
npm run seed:alarmas                       # tipificación de alarmas de partida: LOS, LOF, CORTE, ATEN, SD, ENERGIA, EQUIPO, TERCEROS, MANT (idempotente)
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
