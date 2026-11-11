# Desarrollo distribuido con Paperclip: fases de desarrollo

## Contexto

Hoy los agentes y los repositorios viven en el servidor Ubuntu de Paperclip. Esto trae tres problemas:
- VS Code Remote SSH y Fork van lentos.
- El servidor concentra toda la carga.
- No se puede trabajar en iOS, porque hace falta macOS.

El documento `REQUERIMIENTOS_PAPERCLIP_DESARROLLO_DISTRIBUIDO.md` pide varias cosas:
- elegir en cada ejecución si el agente corre en una máquina propia autorizada o en Ubuntu;
- trabajar desde VS Code;
- aislar el trabajo de cada issue;
- ver los cambios del agente antes de hacer commit;
- pasar un trabajo de la Mac a Ubuntu;
- aprobar permisos desde cualquier interfaz.

Paperclip sigue siendo la fuente central de coordinación.

### Decisiones tomadas

| Tema | Decisión |
|---|---|
| Motor de ejecución | Paperclip Runner (`paperclip-runnerd`, protocolo PRP) con el perfil Claude ACPX |
| Ubuntu | Es el mismo host que el servidor de Paperclip |
| Dev Containers | En la máquina que el usuario elige (Mac, PC o Ubuntu), el agente corre dentro del devcontainer del repositorio si ese repo tiene uno, y en el host de esa máquina si no lo tiene. El devcontainer solo empaqueta las herramientas del repo; no decide dónde se ejecuta. Nunca hay enrutamiento automático por tipo de repo: la ubicación la elige siempre el usuario |
| Configuración del agente | La única fuente es el servidor. Instrucciones, skills, MCP, modelo, permisos y variables vienen de Paperclip en cada run, sin importar dónde se ejecute. La máquina local no aporta configuración propia, de modo que el trabajo es el mismo en Ubuntu que en la Mac |

### Lo que ya existe (verificado en el código)

**Paperclip Runner** (`doc/architecture/paperclip-runner.md`, `server/src/realtime/runner-prp-ws.ts`, `server/src/services/native-runtime/`)
- Tiene un outbox durable, acks, replay al reconectar y cancelación confirmada.
- Los permisos ACP ya llegan a las tarjetas de la UI y se resuelven con `POST /heartbeat-runs/:runId/runtime-requests/:requestId/resolve` (`server/src/routes/agents.ts:6970`). Si la decisión ya se tomó, responde 409.
- Admite el transporte `direct_outbound`: el runner se conecta al servidor por `wss` (`packages/adapter-utils/src/runner-connectivity.ts:108`).
- Limitaciones:
  - Es experimental y está detrás del flag `enableNativeRunner`.
  - El servidor lo lanza en cada ejecución.
  - No existe un proceso que corra en otra máquina, se registre y espere trabajo.
- Por qué el Runner y no `claude_local`: `claude_local` corre con `--dangerously-skip-permissions`, así que no puede pedir permisos.

**Entornos** (`server/src/services/environment-runtime.ts`)
- Drivers disponibles: `local`, `ssh`, `sandbox` y `plugin`.
- El entorno se elige así: el del agente, si no el de la instancia, si no el local (`execution-workspace-policy.ts:296`).
- No se puede elegir el entorno en cada ejecución: `WakeupOptions` no tiene ese campo (`heartbeat.ts:3727`).
- Los entornos no tienen dueño.

**Workspaces por issue**
- La estrategia `git_worktree` ya existe (`server/src/services/workspace-runtime.ts:3179`, `realizeExecutionWorkspace`).
- Los repos extra se clonan dentro del workspace de la tarea (`prepareProjectRepositoryWorkspaces`, `heartbeat.ts:2575`).
- Están detrás de los flags `enableIsolatedWorkspaces*`, desactivados por defecto, y no tienen UI.

**Transferencia de archivos**
- Snapshots y bundles de git (`packages/adapter-utils/src/git-workspace-sync.ts`).
- Merge de 3 vías contra una línea base (`workspace-restore-merge.ts`, `mergeDirectoryWithBaseline`).
- La transferencia es de ida y vuelta en cada ejecución, no continua.

**Sesiones**
- `agent_task_sessions` guarda una sesión por issue.
- El Runner tiene un respaldo durable de la sesión (`NativeHarnessBackupManifest`), pero solo para reemplazar un sandbox.
- Hay un resumen de traspaso que se arma desde la base de datos (`native-session-handoff.ts`).

**Concurrencia**
- El checkout es atómico y el issue se bloquea con `executionRunId` (`services/issues.ts:10995`, `heartbeat.ts:17649`).

**Clientes externos**
- Login de la CLI aprobado desde el navegador, que entrega una board API key (`cli/src/client/board-auth.ts`, `routes/access.ts:2688`).
- El chat usa comentarios con `clientRequestId` idempotente (`routes/issues.ts:16932`) y `agent-conversations.ts`.
- Las interacciones se aceptan o rechazan una sola vez.
- Cancelación: `POST /heartbeat-runs/:id/cancel`, con `resultJson.*Cancellation.state = acknowledged`.
- Los eventos del run llegan en vivo por `/api/events/ws` (`heartbeat.run.event`, `heartbeat.run.log`), y hay paginación en `GET /heartbeat-runs/:id/events?afterSeq=`.

**Lo que no existe**
- Un registro de máquinas, presencia o capacidades.
- Una forma de que un worker externo tome un run.
- Elegir dónde se ejecuta cada run.
- Sincronización continua.
- Mover un trabajo de un host a otro.
- Soporte de devcontainer o docker-compose.
- Una extensión de VS Code.
- Que el WebSocket acepte board API keys. Además, el WebSocket no filtra eventos por issue ni puede retomar desde un cursor.

## Arquitectura propuesta

### 1. Máquina de ejecución

Es un proceso daemon: `paperclipai machine`, un comando nuevo de la CLI (`cli/`). Se registra con un flujo de emparejamiento que reutiliza el login de la CLI (challenge aprobado en el navegador) y obtiene una credencial de máquina.

Mantiene un canal de control saliente por WebSocket (`/api/machines/v1/connect`), que usa para:
- enviar su presencia y sus capacidades: plataforma, arquitectura, Docker, devcontainer CLI y herramientas detectadas, solo como información para el usuario;
- recibir órdenes: iniciar, detener, sincronizar y entregar un contexto de trabajo.

**Ubuntu** se modela como una máquina compartida. Su daemon corre en el mismo host como servicio systemd. Así hay un solo camino de código para worktrees, devcontainers y sincronización. Elegir Ubuntu depende de un permiso; las máquinas personales solo las puede elegir su dueño.

**Por qué un daemon y no un nuevo driver de entorno manejado por SSH:** la Mac de un desarrollador no es alcanzable por SSH desde el servidor. El canal tiene que salir desde la máquina.

### 2. Despacho

- El servidor sigue tomando el run como hoy: checkout atómico, bloqueo del issue y presupuesto.
- Si la ubicación es una máquina, en vez de lanzar el proceso emite un ticket bootstrap de PRP y envía `run.start` al daemon.
- El daemon lanza `paperclip-runnerd` en modo `direct_outbound`, dentro del devcontainer o en el host.
- Toda la telemetría del run, los permisos y la cancelación pasan por PRP, que ya existe.
- Si la máquina no está conectada, el run se queda en "máquina desconectada". Nunca se manda a otro lado.

### 2b. Paridad de configuración del agente (§7)

**La regla:** la configuración se resuelve en el servidor y viaja con el run. Ninguna configuración se lee de la máquina.

**Qué viaja con el run:**
- Lo que manda el servidor en cada `run.start`, igual que para Ubuntu:
  - las instrucciones del agente (AGENTS.md y el prompt bundle);
  - los skills del agente y de la organización;
  - los servidores MCP configurados;
  - el modelo y sus parámetros;
  - la política de permisos;
  - el contexto del proyecto y del issue;
  - los secretos autorizados.
- El paquete lleva un hash de versión. El run registra ese hash, así se puede comprobar que un run en la Mac y otro en Ubuntu usaron exactamente la misma configuración.

**Aislamiento de la configuración local:**
- Claude corre con un directorio de configuración propio del run. Es el mismo mecanismo de `CLAUDE_CONFIG_DIR` que `claude_local` usa en destinos remotos (`packages/adapters/claude-local/src/server/execute.ts:684-697`).
- Por eso no se cargan el `~/.claude`, los MCP, los skills ni los `settings.json` personales del desarrollador.
- Las credenciales del proveedor se tratan como secretos del servidor, no como el login local.

**Requisitos de los MCP:**
- Los MCP que corren como proceso local se lanzan dentro del devcontainer o del host del run, con la misma definición del servidor.
- Los MCP remotos (HTTP) usan los mismos endpoints y credenciales.
- Si un MCP no puede arrancar en la máquina elegida, el run falla con un error claro. No se permite ejecutar sin ese MCP.

**Por qué no dejar que la extensión use el Claude Code local del desarrollador:** su configuración divergiría de la del servidor, y el resultado del agente dependería de la máquina.

### 3. Contexto de trabajo

Es una entidad nueva: issue × ubicación. Contiene:
- los worktrees por repositorio (se porta `realizeExecutionWorkspace` en modo `git_worktree` para que lo ejecute el daemon);
- la ubicación autoritativa, con un token de fencing contra ejecuciones concurrentes;
- el estado del bloqueo de edición;
- el estado de sincronización;
- el snapshot más reciente.

La ubicación es del contexto, no del issue. Elegirla no vincula el issue a una máquina de forma permanente.

### 4. Sincronización con un solo escritor que alterna

El bloqueo de §10 implica que en cada momento hay un solo escritor:
- el lado del agente mientras ejecuta;
- el lado del desarrollador cuando el contexto está desbloqueado.

**Cómo funciona:**
- El escritor genera snapshots git del worktree con debounce sobre cambios de archivos. Incluyen los archivos rastreados y los no rastreados que no están ignorados, así que respetan `.gitignore` (dependencias, cachés, generados) y no tocan volúmenes Docker.
- Los sube como bundles incrementales a un repositorio espejo en el servidor, bajo refs ocultas `refs/paperclip/wip/<contexto>/<seq>`.
- Las réplicas los descargan y los aplican con `mergeDirectoryWithBaseline`.
- Si una réplica tiene cambios propios (por ejemplo, de Fork o de otro editor), el contexto queda en "conflicto". Se conservan ambas versiones y nunca se sobrescribe en silencio.

**Por qué git y no Mutagen o rsync:**
- Reutiliza código que ya existe y está probado.
- Pasa por el servidor, que es el único punto alcanzable por ambas máquinas.
- Da historial recuperable.

**Costo:** la latencia es de segundos, no instantánea, y para repos muy grandes hay que medir el costo del snapshot (fase 0).

### 5. Extensión de VS Code

Es un paquete nuevo: `packages/vscode-extension`. Se apoya en la REST existente, más extensiones del WebSocket de eventos: autenticación con board key, suscripción por issue o run, y un cursor para recuperar eventos perdidos. Inicia el daemon local y lo supervisa.

### 6. Traspaso de una máquina a otra

1. Se detiene el run con cancelación confirmada.
2. Se toma el snapshot final.
3. Se respalda la sesión del harness (se extiende `NativeHarnessBackupManifest` a un destino entre máquinas). Si no se puede, se usa el resumen de traspaso que ya existe.
4. Se transfiere el token de fencing.
5. La máquina destino materializa el contexto y reanuda.

## Fases

Cada fase termina con `pnpm -r typecheck`, `pnpm test:run`, `pnpm build` y sus criterios de aceptación. Las fases que cambian el modelo de datos actualizan db, shared, server y ui juntos, y además `doc/SPEC-implementation.md`.

### Fase 0: validación técnica (spikes, sin código de producto)

Son siete preguntas, cada una con un resultado sí/no documentado:
1. ¿Funciona `paperclip-runnerd` con Claude ACPX en macOS, conectado por `direct_outbound` a Ubuntu a través de la ruta de red elegida en el punto 7, incluyendo permisos, cancelación y reconexión?
2. ¿Corre `runnerd` (Linux arm64/amd64) dentro de un devcontainer, lanzado con `devcontainer exec`?
3. ¿Qué partes de la configuración del agente en el servidor (instrucciones, skills, MCP, modelo, permisos) ya entrega hoy el Runner con Claude ACPX, y cuáles faltan? ¿Queda aislado del `~/.claude` local? Esto no es opcional: lo que falte se construye en la fase 2.
4. ¿Se pueden cambiar las carpetas de VS Code sin recargar la ventana? La idea es usar `updateWorkspaceFolders`, cambiando solo las carpetas que no sean la primera; se necesita confirmar el comportamiento. ¿Sirve `files.readonlyInclude` como bloqueo de edición?
5. ¿Cuánto cuestan y cuánta latencia tienen los snapshots y bundles git en el repo más grande que tienen?
6. ¿Se puede respaldar y restaurar una sesión de Claude ACPX entre hosts?
7. **Ruta de red.** Todas las conexiones salen de la máquina hacia el servidor (canal de control, `wss` del Runner y sincronización por HTTPS), así que basta con que el servidor sea alcanzable. Es el mismo requisito que ya impone el acceso desde el teléfono. Opciones:
   - Cloudflare Tunnel con Access (recomendada si hoy no hay acceso externo): no abre puertos y autentica antes de Paperclip.
   - HTTPS público con reverse proxy (Caddy o nginx, Let's Encrypt), endurecido y con mTLS opcional en los endpoints de máquinas.
   - Solo LAN, con una CA propia (`PAPERCLIP_RUNNER_CA_BUNDLE_PATH`).
   - Una overlay VPN (WireGuard, Headscale, ZeroTier).

   Hay que validar que los WebSocket largos sobreviven y que el daemon reconecta cuando el proxy o el túnel corta la conexión.

**Salida:** un documento en `doc/plans/` con los resultados y los ajustes necesarios a las fases siguientes. Si las preguntas 1 o 3 fallan, hay que replantear el motor antes de seguir.

### Fase 1: registro de máquinas, autorización y presencia (§3, §17)

- **Datos:** tabla `machines`, con:
  - `ownerUserId`, `name`, `platform`, `arch`, `capabilities` (jsonb), `shared`
  - `status`, `authorizedAt`, `revokedAt`, `lastSeenAt`
  - el hash de la credencial
- **Servidor:**
  - servicio y rutas de máquinas: emparejar, autorizar, revocar, listar;
  - un permiso nuevo para usar la máquina compartida;
  - el WebSocket de control con presencia (heartbeat y lease, siguiendo el patrón de `legacy-controller-lease.ts`);
  - registro en el activity log de cada mutación.
- **CLI:** `paperclipai machine pair | run | status`. El daemon por ahora solo reporta presencia y capacidades.
- **Ubuntu:** el daemon como unidad systemd en el host del servidor, registrado como máquina compartida.
- **UI web:** la página "Máquinas" (mis máquinas y la compartida), con estado de conexión.
- **Aceptación:**
  - registrar una Mac, autorizarla, verla conectada y desconectada, y revocarla;
  - una máquina revocada o desconectada no puede elegirse;
  - un usuario no ve ni elige las máquinas de otro.

### Fase 2: elegir la ubicación de cada run y ejecutar en una máquina (§4, §13)

- Agregar `executionLocation` a `WakeupOptions` y a las rutas que inician trabajo:
  - checkout y wake desde la UI, con un selector "Ejecutar en: Mi Mac / Ubuntu";
  - comentarios que despiertan al agente.
- Persistir `executionMachineId` en `heartbeat_runs`.
- Despacho: se emite el ticket PRP y se envía `run.start` al daemon. El daemon lanza `runnerd` en el host, todavía sin devcontainer.
- Primera versión del contexto de trabajo: una tabla `work_contexts` (issue, máquina, rutas de los worktrees, token de fencing). El daemon crea worktrees por issue con el código portado de `workspace-runtime.ts` (`git_worktree`). Se activa el aislamiento para los proyectos que usen máquinas.
- El selector muestra las capacidades que reporta cada máquina (plataforma, Docker, herramientas detectadas) para que el usuario decida. No se rechaza ni se redirige automáticamente según el repo.
- **Paquete de configuración del agente** (sección 2b):
  - se resuelve en el servidor y se envía con `run.start`, con un hash de versión que queda registrado en el run;
  - el daemon lo materializa en un directorio de configuración aislado por run;
  - se completa lo que la fase 0 haya encontrado faltante en el Runner.
- **Estados** en el issue y en el run: pendiente, ejecutando, esperando instrucciones, máquina desconectada, error.
- **Aceptación:**
  - un issue ejecuta en la Mac con el worktree local, y otro ejecuta en Ubuntu;
  - el issue muestra el agente, el estado y la máquina;
  - desconectar la Mac no mueve el trabajo a Ubuntu;
  - los permisos ACP se aprueban desde la web;
  - el mismo issue ejecutado en la Mac y en Ubuntu registra el mismo hash de configuración y usa los mismos skills y MCP;
  - un skill o MCP agregado al `~/.claude` local no aparece en el run.

### Fase 3: extensión de VS Code, versión mínima (§6, §7, §15, §16)

**Servidor:**
- El WebSocket de eventos acepta board API keys (`server/src/realtime/live-events-ws.ts:187`).
- Suscripciones por issue o run, filtradas por permisos.
- Retomar con `afterSeq`, apoyándose en `heartbeat_run_events`.
- Un evento explícito de "run detenido" (hoy solo existe el sondeo de `resultJson`).
- Un endpoint de estado compuesto por contexto: run, máquina, bloqueo, sincronización y aprobaciones pendientes.

**Extensión:**
- Login con el flujo de challenge de la CLI. El token se guarda en `SecretStorage`.
- Árbol de proyectos e issues autorizados, sin filtrar por el repo abierto.
- Panel de chat: comentarios con `clientRequestId` y transcripción en vivo (mensajes, tool calls, errores).
- Interrumpir el run, con espera de la confirmación.
- Tarjetas de permisos e interacciones que usan las rutas que ya existen.
- Barra de estado con el issue, la máquina, el agente y el entorno activos.
- La extensión inicia y supervisa el daemon local.

**Aceptación:** escenarios A (sin la parte de bloqueo) y F. Una decisión tomada en la web se refleja en VS Code y viceversa, y se procesa una sola vez.

### Fase 4: cambio de issue, bloqueo de edición y cierre de VS Code (§8, §9, §10, §14)

**Cambio de issue:**
1. Guardar los editores modificados (`workspace.saveAll`). Si falla, se bloquea el cambio y se avisa.
2. Cambiar las carpetas del contexto con la técnica validada en la fase 0.
3. Cambiar el chat.

**Bloqueo de edición:**
- El estado del bloqueo vive en el servidor y se libera cuando el run termina, queda esperando o tiene la cancelación confirmada.
- La extensión aplica la solo-lectura en las carpetas del contexto.
- Se documenta el límite: Fork y otros editores no quedan bloqueados. Esas ediciones se detectan como conflicto en la fase 5.

**Sesiones de VS Code:**
- Cada ventana tiene un `clientSessionId`.
- Los runs locales que inicia una ventana quedan asociados a esa sesión.
- Al cerrarse la ventana (o perderse su heartbeat), el daemon detiene solo esos runs con cancelación confirmada y deja el contexto en "pausado".
- Los runs en Ubuntu no se ven afectados.

**Aceptación:** escenarios B, D y G.

### Fase 5: sincronización antes del commit (§11)

- Repositorio espejo por contexto en el servidor, con endpoints para subir y bajar bundles con autenticación de máquina.
- El daemon:
  - observa los archivos del escritor;
  - genera snapshots con debounce;
  - aplica en la réplica con `mergeDirectoryWithBaseline`.
- Estados: al día, sincronizando, error y conflicto.
- Resolución de conflictos desde la extensión: comparar, quedarse con una versión o combinar. Nunca se sobrescribe sin confirmación.
- Recuperación de interrupciones: los bundles son idempotentes por `seq` y se reintentan.
- Retención de snapshots: se purgan al cerrar el issue o pasado un TTL.
- **Aceptación:** escenario C. Hay que probar con una red cortada a mitad de la sincronización y con una edición hecha desde Fork mientras el contexto está bloqueado.

### Fase 6: continuar en Ubuntu (§5)

- La acción "Continuar en Ubuntu" estará en la web (también en el teléfono) y en la extensión.
- Secuencia:
  1. Cancelación confirmada en la Mac.
  2. Snapshot final.
  3. Respaldo de la sesión.
  4. Transferencia del token de fencing.
  5. Ubuntu materializa el contexto y reanuda con la misma sesión, o con el resumen de traspaso si no hay sesión.
- Si la Mac no responde y el último snapshot no está en un punto consistente, el contexto queda en "pendiente de recuperación" y no se reanuda.
- **Aceptación:** escenario E. No hay ejecuciones duplicadas aunque se repita la orden o se reconecte la Mac a mitad del traspaso.

### Fase 7: Dev Containers y sistemas multirepositorio (§12, §13)

- En la máquina elegida (Mac, PC o Ubuntu), el daemon ejecuta `devcontainer up` sobre el worktree de cada repo que tenga devcontainer, y lanza `runnerd` con `devcontainer exec`. Así el host solo necesita Docker y el daemon; las herramientas del repo vienen en el contenedor. Si el repo no tiene devcontainer, el agente corre en el host.
- El paquete de configuración del agente se monta dentro del contenedor. Los MCP que corren como proceso local se lanzan ahí.
- Cada contexto tiene su propia red Docker, que se agrega con `--override-config`, con alias por nombre de repo para que los repos se comuniquen.
- Hay que levantar el conjunto de servicios que pide el issue y apagarlo al pausar o cerrar.
- **Aceptación:**
  - un issue con frontend y backend en contenedores separados que se comunican, en Mac y en Ubuntu;
  - el mismo issue, ejecutado en la Mac y en Ubuntu, usa el mismo devcontainer y produce el mismo entorno de herramientas;
  - en un repo sin devcontainer, el agente corre en el host de la máquina elegida y usa las herramientas instaladas ahí (por ejemplo, Xcode en la Mac).

### Fase 8: robustez, seguridad y cierre

- Revisión de seguridad:
  - alcance de las credenciales de máquina;
  - secretos que se entregan solo durante el run y no se escriben en la máquina;
  - aislamiento entre usuarios.
- Trazabilidad completa de quién inició, interrumpió, autorizó y trasladó cada run.
- **Windows, deseable y opcional.** No bloquea ninguna fase ni ningún criterio de aceptación. Se prueba el daemon sobre WSL2 con devcontainers. Si funciona sin cambios grandes, se documenta como soportado; si no, queda fuera por ahora. Mientras tanto, el código del daemon evita supuestos exclusivos de Unix donde no cueste nada (rutas, señales), para no cerrar esa puerta.
- Pruebas de carga: varios desarrolladores, cada uno con varios contextos.
- Agregar los escenarios A a G como pruebas end-to-end (Playwright y pruebas de la extensión con `@vscode/test-electron`).
- Documentación de operación: instalar el daemon y conectar la red.
- Exposición de red agnóstica de proveedor. El núcleo solo exige una URL pública HTTPS/WSS, y las rutas de máquina se autentican en la aplicación. Se documentan recetas para Cloudflare Tunnel, Traefik/Dokploy, Caddy y LAN con CA propia. No hay integración automática con ningún proveedor.

## Archivos clave

**Se reutilizan:**
- `server/src/realtime/runner-prp-ws.ts`
- `server/src/services/native-runtime/runner-prp-coordinator.ts`
- `packages/adapter-utils/src/runner-connectivity.ts`
- `server/src/services/workspace-runtime.ts`
- `packages/adapter-utils/src/git-workspace-sync.ts`
- `packages/adapter-utils/src/workspace-restore-merge.ts`
- `server/src/services/native-runtime/native-session-handoff.ts`
- `cli/src/client/board-auth.ts`
- `server/src/routes/agents.ts` (cancel, runtime-requests, events)
- `server/src/routes/issues.ts` (comments, interactions)

**Se modifican:**
- `server/src/services/heartbeat.ts` (despacho y `WakeupOptions`)
- `server/src/realtime/live-events-ws.ts`
- `server/src/services/execution-workspace-policy.ts`
- `packages/db/src/schema/` (`machines`, `work_contexts`, columnas nuevas en `heartbeat_runs`)
- `packages/shared` (tipos, validadores, constantes de estado)
- `ui/src/pages` (Máquinas, selector de ubicación, estados)

**Se crean:**
- `packages/vscode-extension/`
- `cli/src/commands/machine/`
- `server/src/services/machines.ts`
- `server/src/realtime/machine-control-ws.ts`
- `server/src/services/work-context-sync.ts`

## Verificación

- **Por fase:** typecheck, tests y build, más `pnpm check:token-gates` cuando se toca la UI, más los criterios de aceptación de la fase ejecutados con una Mac real y Ubuntu.
- **Escenarios A a G** del documento de requerimientos, como checklist manual desde la fase en que cada uno aplica, y automatizados en la fase 8.
- **Pruebas de fallo:**
  - cortar la red durante un run y durante la sincronización;
  - matar el daemon;
  - reiniciar el servidor durante un traspaso;
  - cerrar una de dos ventanas de VS Code.

## Riesgos y preguntas abiertas

- **El Runner es experimental.** Toda la propuesta depende de él; la fase 0 lo valida antes de invertir más.
- **Red:** solo se necesita que el servidor sea alcanzable desde las máquinas, sin VPN. La ruta se decide en la fase 0, punto 7. Si el servidor queda expuesto en internet, el endurecimiento de la fase 8 deja de ser opcional.
- **El bloqueo de edición solo cubre VS Code.** Las herramientas externas se detectan como conflicto, no se impiden.
- **El cambio de carpetas en VS Code** depende de un comportamiento de la API que hay que confirmar en la fase 0.
- **Rendimiento de los snapshots** en repos grandes y con muchos archivos no ignorados.
- **Secretos en máquinas personales:** si se exponen en un entorno del desarrollador, se pueden filtrar. Hay que mitigarlo con alcance por run y sin escribir a disco.
- Al aprobar el plan, se guarda como `doc/plans/2026-11-02-desarrollo-distribuido.md`, según la regla 5 de `AGENTS.md`.

## Estado al 2026-11-03

Primera versión de todas las fases, en la rama `distributed-dev`. La guía de
operación quedó en `doc/machines.md`.

| Fase | Estado | Verificación |
|---|---|---|
| 1. Registro y presencia | Hecha | E2E local: pareo, aprobación, conexión y revocación; tests con Postgres embebido |
| 2. Ubicación por run | Hecha. El run usa el proveedor integrado `paperclip_machine` sobre el sandbox existente | E2E: run despachado a la máquina, `executionMachineId` registrado y archivo escrito en el workspace de la máquina |
| 3. Extensión de VS Code | Hecha: login, árbol de issues, chat con transcripción en vivo, permisos, interrupción, barra de estado y supervisión del daemon | Typecheck, bundle y 24 tests unitarios. No se probó dentro de VS Code real |
| 4. Bloqueo y sesiones de ventana | Hecha. `files.readonlyInclude` en el workspace gestionado; pausa por cierre o por 90 s sin heartbeat | Tests unitarios y de servicio |
| 5. Sincronización | Hecha. Espejo por issue y snapshots git con un git-dir aparte; el servidor los pide por RPC | E2E con dos daemons y tests del módulo git |
| 6. Traspaso | Hecho: cancelación, snapshot final, fencing, materialización y `recovery_pending` | E2E: A→B, escritor obsoleto rechazado, origen desconectado y conflicto en el destino |
| 7. Dev Containers | Hecha. `devcontainer up` al adquirir el lease, montaje en la misma ruta del host, apagado al traspasar o pausar | Solo tests unitarios: esta laptop no tiene devcontainer CLI |
| 8. Endurecimiento | Parcial: auditoría de snapshots, rutas de máquina fuera del parseo de JWT, credencial que sobrevive a un 401 de proxy, documentación | Ver pendientes |

### Pendientes

- Probar la extensión con `@vscode/test-electron` y pasar los escenarios A a G a Playwright.
- Construir la UI de resolución de conflictos: comparar, quedarse con una versión o combinar.
- Que el daemon vigile el disco con debounce. Hoy los snapshots se toman al terminar un run, al traspasar o a pedido.
- Crear worktrees por issue desde el repo del proyecto. Hoy el contexto es el directorio que prepara el staging.
- Red Docker por contexto para sistemas multirepositorio; snapshots por repo cuando un contexto tiene varios.
- Ruta canónica dentro del contenedor, independiente de la máquina.
- Que el traspaso a la ubicación `server` desempaquete el snapshot en el workspace del agente. Mientras tanto, Ubuntu se registra como máquina compartida.
- Paquete de configuración del agente con hash por run (sección 2b).
- MCP gateway y Hindsight, pospuestos por decisión del usuario.
- Pruebas de carga y Windows con WSL2.
