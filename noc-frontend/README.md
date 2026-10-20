# NOC Console — Frontend (topología en vivo + administración)

React 18 · Vite 5 · Tailwind 3 · @xyflow/react (React Flow 12) · Zustand · Socket.io client

```bash
npm install
npm run dev        # http://localhost:5173  (el backend debe estar en :4000)
npm test           # lógica pura y store (74 pruebas, sin navegador)
npm run build      # genera dist/
```

En desarrollo, Vite reenvía `/api` y `/socket.io` a `http://localhost:4000` (cambiable con `DEV_API_TARGET`),
así que no hay CORS ni configuración extra. Para producción sirviendo el front aparte, defina `VITE_API_URL`
(ver `.env.example`) y agregue ese origen a `CORS_ORIGINS` del backend.

## Qué incluye

- **Login** con JWT (se guarda en `localStorage`; un 401 cierra la sesión automáticamente).
- **Topología** (React Flow) con los nodos del catálogo y sus posiciones:
  - Nodos por tipo (estación, OLA, IBTP, NE), con borde/halo según el peor estado de sus enlaces.
  - Aristas: verde sólido (OK) · naranja (Degradado) · rojo punteado parpadeante (Caído) · azul punteado (Mantenimiento).
  - Enlaces paralelos entre el mismo par de nodos se separan en curvas.
  - Etiquetas de nodo se ocultan al alejar el zoom; minimapa y controles.
- **Alarmas por filamento y tipificación:** al registrar una alarma se elige si afecta a la **ida, la vuelta o ambas**, el nuevo
  estado y la **tipificación** (LOS, CORTE, ATEN…); al elegirla aparece su **significado, el procedimiento a seguir (pasos),
  el escalamiento y el tiempo de respuesta**. Cada filamento tiene su propio estado; el del enlace es el peor de los dos.
  La misma ficha está en la **Guía de alarmas** (`#/alarmas`, todos los roles), en el procedimiento de cada enlace del checklist
  del turno y en el modal del enlace. En el mapa, al desplegar un enlace cada filamento se dibuja con el color de SU estado y el
  «+» muestra un punto cuando solo uno está alarmado. Las incidencias y el dashboard muestran la tipificación.
- **Horario de los turnos** (Mañana 08:00–15:30, Tarde 15:30–23:00, Noche 23:00–08:00; lo define el backend): al abrir se propone el turno que corresponde por la hora
  (no el asignado al usuario) y se ve el horario en el selector y en el encabezado. Si el último turno cerrado no es el que corresponde (p. ej. se entra a la mañana
  y el último acta es de la tarde), el traspaso muestra un aviso: puede que el turno intermedio no se haya registrado.
- **Fecha del turno:** un turno pertenece al día en que empieza (Mañana, Tarde) o en que termina (Noche: quien entra el 19 a las 23:00 hace el turno noche del 20). Se muestra así en el
  encabezado, el historial (con la hora real de inicio debajo), el detalle, el traspaso y el acta; el filtro del historial busca por esta fecha.
- **Traspaso de turno:** antes de abrir el turno, el operador lee lo que dejó el turno anterior (su bitácora y los enlaces que siguen sin estar en OK, con el estado
  de AHORA). Con el turno abierto, cada fila del checklist muestra bajo el enlace lo que se hizo con él en el turno anterior; la tarjeta arranca plegada si ya hay avance.
  Si el turno anterior cerró hace más de 24 h, se avisa que puede estar desactualizado.
- **Documentos de procedimiento:** cada tipificación de alarma admite documentos **.docx, .pdf y .xlsx** (hasta 15 MB, 10 por alarma). El Admin
  los sube desde Administración → Alarmas (arrastrando o seleccionando; se suben al guardar, con mensaje por cada archivo rechazado). El operador los ve
  junto al procedimiento (guía, modal del enlace y checklist del turno): los PDF se abren en un visor y todos se pueden descargar.
- **Filamentos (ida y vuelta):** cada enlace tiene un «+» en su punto medio (como en el NMS). Al pulsarlo la línea se
  desdobla en dos filamentos paralelos con flecha de sentido, y aparece una tarjeta con el levantamiento de potencias
  (Tx/Rx en dBm) de cada uno. Pulsar «−» los pliega. Los filamentos conservan el estilo del estado del enlace.
- **Tipo de línea:** los enlaces de otra telco (WOM, Tigo, Claro, Entel…) llevan el color de su tipo en el «+» y en su
  etiqueta; el panel de la leyenda filtra el mapa por tipo.
- **Modal de cambio de estado** (clic en un enlace o en una alarma): observación, ticket y causa raíz al cerrar una falla;
  tipo de línea, resumen de filamentos e historial del enlace.
- **Panel lateral**: contadores por estado, alarmas activas (más severas y antiguas primero), detalle de nodo y actividad reciente.
- **Turno** (`#/turno`, todos los roles): abre el turno y precarga el **checklist** con los enlaces que no están en OK.
  Cada uno se marca como gestionado y se describe la acción tomada (se guarda al salir del campo). Si un enlace cae
  durante el turno aparece un aviso para incorporarlo. La bitácora general se guarda sola. **Cerrar** valida que todo
  esté resuelto (el servidor también lo exige) y abre la **vista previa imprimible** del acta (A4, «Guardar como PDF»
  desde el diálogo de impresión). El **historial** permite ver e imprimir actas anteriores (un Operador solo las suyas).
- **Indicadores** (`#/indicadores`, todos los roles): uptime y MTTR por mes con objetivo de disponibilidad configurable
  (99 % a 99,99 %, se recuerda), tarjetas de resumen, gráfico de los enlaces más afectados, tendencia de 6 meses,
  desglose por **tipo de línea**, tabla ordenable por enlace e **incidencias** del período (las cerradas sin causa
  raíz se resaltan; Supervisor/Admin la completan). Filtros por tipo de línea y zonal; opción de contar «Degradado»
  como falla. El mes se corta a medianoche en la zona horaria de la operación (`APP_TIMEZONE` del backend).
- **Administración** (`#/admin`, según rol):
  - *Enlaces* (Supervisor y Admin): tabla filtrable por tipo, levantamiento y zonal; alta de enlaces nuevos.
    **Levantamiento de potencias** por filamento (Tx, Rx, fecha, observación; la atenuación se calcula como Tx − Rx).
  - *Edición de un enlace* en 3 pestañas: **General** (tipo de línea, proveedor), **Potencias** (levantamiento por
    filamento) y **Tramos por zonal**: longitud total del enlace y qué kilómetros pertenecen a cada zonal
    (km 0 = nodo origen). Barra proporcional con los tramos; los solapes y los tramos que exceden la longitud
    impiden guardar; los kilómetros sin asignar solo se avisan.
  - *Nodos* (Supervisor y Admin; eliminar solo Admin): alta, edición, posición.
  - *Tipos de línea* (Admin): alta, color, activar/desactivar, eliminar (si ningún enlace lo usa).
  - *Sistema* (Admin): diagnóstico del servidor (base de datos, carpeta de documentos, espacio, límites) para encontrar el motivo cuando algo falla.
  - *Alarmas* (Admin): tipificación con significado, pasos del procedimiento (reordenables), escalamiento y tiempo de respuesta.
  - *Zonales* (Admin): zonas operativas con nombre y color; no se pueden eliminar si algún enlace tiene tramos en ellas.
  - *Usuarios* (Admin): alta, edición de rol/turno, desactivación (no se borran) y restablecer contraseña. No se puede
    desactivar la propia cuenta ni dejar el sistema sin Admin activo.
- **Tiempo real**: `link:*`, `node:*`, `linktype:changed`, `zonal:changed`. Los cambios de otros operadores muestran aviso; tras una reconexión se vuelve a leer el estado completo.
- **Posiciones**: Supervisor/Admin pueden arrastrar nodos (se guarda al soltar, con reversión si el servidor rechaza). Los Operadores ven la disposición en solo lectura.
- Búsqueda de nodo, filtro «Solo fallas», teclado (Esc cierra los diálogos), `prefers-reduced-motion` respetado.

## Estructura

```
src/lib/                 lógica pura (estados, selectores, geometría, levantamiento, eventos, API, socket)
src/store/               Zustand: authStore y topologyStore
src/components/turno/    TurnoPage, TurnoActual, ChecklistTabla, HistorialTurnos, VistaPreviaActa
src/components/indicadores/ IndicadoresPage, Graficos (Recharts, carga diferida), TablaMetricas, TablaIncidencias
src/components/          mapa: Consola, TopologyCanvas, NodoNOC, EnlaceNOC, MarcadorMedio, TarjetaFilamentos, Sidebar, StatusModal
src/components/admin/    AdminLayout, ui (diálogos, tablas), Enlaces/Nodos/Tipos/Usuarios
tests/                   node --test (sin dependencias de navegador)
```

## Límites conocidos

- Se cargan hasta 500 enlaces (`limit` máximo del backend).
- Las zonales no se dibujan en el mapa (solo en la edición y en el modal del enlace).
- Las incidencias y el uptime siguen siendo por enlace (un filamento caído cuenta como enlace caído); no hay uptime por filamento.
- Un enlace eliminado mientras está en el checklist de un turno abierto no se puede gestionar (se avisa en la fila).
