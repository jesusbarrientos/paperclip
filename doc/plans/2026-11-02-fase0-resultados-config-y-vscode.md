# Fase 0: resultados de los puntos 3 y 4

Este documento acompaña a [2026-11-02-desarrollo-distribuido.md](2026-11-02-desarrollo-distribuido.md). Cubre:
- **Punto 3:** qué parte de la configuración del agente entrega hoy el Paperclip Runner con Claude ACPX.
- **Punto 4:** si VS Code puede cambiar de carpeta y bloquear la edición sin recargar la ventana.

También cubre el punto 5 (costo de sincronizar con git), la decisión de red del punto 7 y la decisión sobre las variables del agente (Hindsight).

Los puntos 1, 2 y 6 siguen pendientes.

## Punto 3: paridad de configuración (Runner + Claude ACPX)

**Resultado: parcial.**
- El aislamiento de la configuración local ya está resuelto.
- Construir la configuración en el servidor ya está resuelto.
- Falta poder entregarla a un runner que no lanzó el servidor. Hoy toda la entrega supone que el servidor arranca `runnerd`, ya sea en local o por SSH/sandbox con el command runner del entorno.

### Lo que ya cumple el requisito

**Aislamiento del `~/.claude` local**
- `packages/paperclip-runner/src/drivers/acpx/runtime-sandbox.ts:468-524` lanza Claude con `HOME`, `XDG_*` y `CLAUDE_CONFIG_DIR` privados por sesión.
- El parche `patches/@agentclientprotocol__claude-agent-acp@0.73.0.patch:35` fija `settingSources: ["user"]` y descarta los `mcpServers` del usuario cuando `PAPERCLIP_ACPX_ISOLATED_CONTEXT=1`.
- Con esto no se cargan los settings, MCP, skills, plugins ni CLAUDE.md del desarrollador, ni el `.claude/` o `.mcp.json` del repo.
- Esto es mejor que `claude_local`, que reutiliza el directorio de configuración del host.

**Instrucciones**
- El servidor compone el texto y lo envía por PRP (`run.prepare`).
- Claude lo recibe como `systemPrompt.append`.
- Llega aunque el runner esté en otra máquina.

**Modelo**
- Viaja en el descriptor y se escribe en `settings.json` y en `sessionOptions.model`.
- Se verifica antes de admitir el run.

**Herramientas de Paperclip (MCP `paperclip`)**
- Es un bridge local del runner que vuelve al servidor por PRP.
- Funciona en remoto.

**Permisos**
- Las escalaciones llegan al ledger durable como `runtime_request` (permission_approval) y se resuelven desde la UI.

**Huella de configuración**
- `runtimeContext.aggregateDigest` (instrucciones, skills, MCP) se guarda en `heartbeat_runs.runner_profile_json`.
- Es la base del hash de configuración que pide el plan.

### Brechas que hay que cerrar en la fase 2

| Brecha | Detalle | Propuesta |
|---|---|---|
| Archivos del bundle de instrucciones y skills | Se pasan como rutas. Si el runner es remoto, el servidor los copia con su command runner (`native-session-executor.ts:11829-11871`). Un daemon independiente no los recibiría | Endpoint de descarga de artefactos verificado por digest (`bundle.digest`, `manifestDigest`), autenticado con la credencial del run. El daemon los materializa antes de lanzar `runnerd` |
| MCP configurados en Paperclip | Pasan por un gateway del servidor (`/mcp/gateways/<id>`) con un token en el entorno de `runnerd`. El relay por PRP solo existe para Codex (`native-session-executor.ts:10577`) | Habilitar el relay por PRP también para Claude ACPX. Así la Mac no necesita alcanzar el gateway por HTTPS y el token no viaja en el entorno |
| Variables y secretos del agente | Hoy solo llegan a Claude `ANTHROPIC_API_KEY` y `CLAUDE_CODE_OAUTH_TOKEN`. El resto de `runtimeConfig.env` se descarta (lista blanca en `acpx_sidecar_transport.rs` y `environment.ts`). Esto también pasa en Ubuntu, a diferencia de `claude_local` | Hay que decidir qué variables del agente llegan al proceso y a su herramienta Bash. Para la paridad Mac/Ubuntu basta con que la regla sea la misma en ambos lados |
| Credenciales del proveedor | Vienen del entorno con que se lanza `runnerd`. Un daemon las tomaría de su propio entorno, que es justo lo que hay que evitar | Entregarlas por PRP, o como lease que se obtiene con el ticket bootstrap, sin escribirlas a disco |
| `AGENT_HOME` y la copia de trabajo de archivos del agente | No se reenvían. Ya figura como P1 abierto en `doc/architecture/runner-rich-acp-capabilities.md:199` | Incluirlos en la entrega de artefactos |
| Parámetros del modelo (effort, thinking, max tokens) | No se transmiten para ACPX | Agregarlos al descriptor y a `sessionOptions` |
| Permiso predeterminado | `acpxPermissionMode` es `approve-all` por defecto (`packages/adapter-utils/src/paperclip-runner-permissions.ts:110`). Con ese valor, las herramientas de Claude nunca piden permiso y §16 no se ejercita | Configurar los agentes de desarrollo con `approve-reads` o `approve-paperclip`. Las listas de permitir/denegar distintas de las herramientas de Paperclip no son configurables hoy |
| Huella incompleta | No cubre el texto final de las instrucciones, el `settings.json` generado, el conjunto de variables ni la identidad de la credencial | Extender el hash del run con esos elementos |

### Pendiente de verificar en la Mac (va con el punto 1)

- Si Claude Code lee credenciales del Keychain de macOS aunque `CLAUDE_CONFIG_DIR` apunte a un directorio privado.
- Si se aplica una política administrada de Claude (`/Library/Application Support/ClaudeCode/managed-settings.json`) a pesar de `settingSources`.
- Que `settingSources: ["user"]` suprima del todo los CLAUDE.md del proyecto. Esto depende del SDK de Anthropic, no de este repo.

## Punto 4: cambio de carpeta y bloqueo de edición en VS Code

**Resultado: sí, con dos matices.**

**Cómo se probó**
- Una extensión mínima ejecutada con `@vscode/test-electron` sobre VS Code 1.144 (macOS arm64).
- Un workspace multi-root: carpeta 0 = carpeta de control fija; carpeta 1 = worktree del issue.
- Dos worktrees (`issue-a` e `issue-b`) del mismo repo.

| Prueba | Resultado |
|---|---|
| Reemplazar la carpeta 1 (`updateWorkspaceFolders(1, 1, …)`) | Funciona en 59 ms. Se emite `onDidChangeWorkspaceFolders` y el extension host no se reinicia (mismo PID) |
| SCM de git tras el cambio | El repositorio activo pasa de `wt-a` a `wt-b` sin intervención |
| Edición sin bloqueo | `editor.edit` y `applyEdit` modifican el documento |
| Bloqueo con `files.readonlyInclude` | La edición desde el editor (el camino del teclado) queda bloqueada y nada llega al disco. `workspace.applyEdit` sí modifica el modelo en memoria, pero no lo marca como sucio ni se puede guardar |
| `fs.stat().permissions` | No refleja el bloqueo. La extensión debe consultar su propio estado, no el sistema de archivos |

### Matices

**1. Dónde se escribe el bloqueo.** Si `files.readonlyInclude` se configura a nivel de carpeta, se crea `.vscode/settings.json` dentro del worktree, lo que ensucia el repo y se sincronizaría. Hay que configurarlo a nivel de workspace con un glob absoluto de la ruta del worktree. Eso se guarda en el archivo `.code-workspace`, que administra la extensión fuera del repo. Se probó y bloquea igual.

**2. Cambiar la carpeta 0.** El control salió inconcluso. La documentación de `updateWorkspaceFolders` dice que cambiar la primera carpeta reinicia el extension host, pero bajo el harness de pruebas no ocurrió. Esto no afecta al diseño, porque la carpeta 0 nunca se toca. Conviene confirmarlo una vez a mano en una ventana real.

### Implicaciones para la fase 4

- La extensión abre un `.code-workspace` propio. La carpeta 0 es fija (por ejemplo, `~/.paperclip/vscode/<ventana>`), y las carpetas 1..n son los worktrees del issue activo, uno por repositorio.
- El bloqueo de edición se aplica y se retira escribiendo `files.readonlyInclude` en ese `.code-workspace`.
- Las extensiones de terceros que usan `applyEdit` pueden alterar el modelo en memoria pero no guardar. Esto se documenta como límite, junto con Fork y otros editores externos.

## Ajustes al plan

- **Fase 2:** se suman las brechas del punto 3 (entrega de artefactos por digest, relay de MCP por PRP para Claude, credenciales y variables por PRP, `AGENT_HOME`, parámetros del modelo, huella extendida). Los agentes que se usen en desarrollo distribuido se configuran con un modo de permisos que escale (`approve-reads` o `approve-paperclip`).
- **Fase 4:** se adopta la técnica validada (carpeta 0 fija y bloqueo a nivel de workspace).
- **Decisión pendiente:** qué variables del agente deben llegar al proceso de Claude con el Runner. Hoy no llegan en ningún lado, y eso puede romper flujos que hoy funcionan con `claude_local`.

## Punto 5: costo de los snapshots y bundles git

**Resultado: sí. El costo es despreciable para el repo de referencia.**

**Repo medido:** `lea-portal`.
- 988 archivos rastreados.
- `.git` de 37 MB.
- 2.9 GB en disco, casi todo `.pnpm-store`, que está ignorado.

**Cómo se midió**
- Los escaneos se ejecutaron en solo lectura sobre el repo real, con `--no-optional-locks`.
- El commit de snapshot, los bundles y la aplicación en la réplica se hicieron en un clon dentro del scratchpad.
- La edición simulada fue de 15 archivos modificados y 3 nuevos.

| Operación | Tiempo | Tamaño |
|---|---|---|
| Los 4 escaneos de `readGitWorkspaceSnapshot` | ~35 ms cada uno | — |
| Materializar el contexto (clon inicial) | 1.6 s | — |
| Bundle completo / clon desde bundle | 0.25 s / 0.45 s | 5.4 MB |
| Commit de snapshot con índice temporal (`read-tree` + `add -A` + `commit-tree`) | ~220 ms | — |
| Bundle incremental, 18 archivos | 39 ms | 14 KB |
| Bundle incremental, 1 archivo | — | 464 B |
| Aplicar 2 bundles en la réplica (`fetch` + `read-tree -m -u` + `reset --mixed`) | ~250 ms | — |

**Verificación:** la réplica quedó idéntica al escritor (`diff -rq`). Los cambios quedaron como cambios sin commit, que es lo que pide §11.

**Conclusiones**
- La latencia de sincronización la marcan el debounce y la red, no git. Un ciclo cuesta menos de medio segundo.
- Las dependencias (`.pnpm-store`, `node_modules`) están ignoradas, así que nunca viajan. Cada máquina las instala por su cuenta. En la fase 7 esto se resuelve con un volumen del devcontainer.

**Hallazgo que afecta al plan:** el `devcontainer.json` local de `lea-portal` monta el repo en la misma ruta que tiene en el servidor (`/paperclip/instances/default/projects/...`), así las rutas que ve el agente coinciden en ambos lados. En la fase 7 se adopta como regla: el daemon monta el worktree en una ruta canónica que no depende de la máquina.

## Punto 7: exposición de red (genérica)

**Decisión: Paperclip no depende de ningún proveedor de red.**

**Contrato mínimo de una instancia**
- Una URL pública HTTPS/WSS (`PAPERCLIP_PUBLIC_URL`), alcanzable por las máquinas.
- Cómo se publica es responsabilidad de quien monta la instancia: Cloudflare Tunnel, reverse proxy con Let's Encrypt, LAN con CA propia o VPN.

**Consecuencia de diseño:** las rutas que usan las máquinas deben ser seguras aunque queden expuestas directamente en internet, sin una capa de proxy delante. Esas rutas son:
- `/api/machines/v1/*`
- `/api/runner/v1/*`
- `/mcp/gateways/*`
- la sincronización

Todas se autentican en la aplicación:
- tickets bootstrap de un solo uso;
- credencial de máquina con hash en reposo;
- tokens de gateway por run, que se revocan al terminar (`revokeHeartbeatRunGatewayTokens`, `server/src/services/heartbeat.ts:4557`).

Una capa como Cloudflare Access se suma como defensa en profundidad, pero la seguridad no depende de ella.

**Hallazgo:** `paperclip-runnerd` no puede enviar headers propios en el WebSocket.
- Arma la petición solo con la URL: `packages/paperclip-runner/runner/crates/runner-core/src/durable/transport.rs:274-279`.
- Por eso, detrás de Access, esas rutas necesitan una política *Bypass*, o hay que agregar a `runnerd` headers configurables (un cambio pequeño en Rust, para la fase 8).

**Sin aprovisionamiento automático de un proveedor.** Se descartó integrar Cloudflare (u otro proveedor) en Paperclip, para no anclar el producto a una tecnología. La fase 8 incluye recetas de despliegue como documentación: Cloudflare Tunnel, Traefik/Dokploy, Caddy con Let's Encrypt y LAN con CA propia.

**Despliegue de referencia (el actual):**
- Dokploy con Traefik asigna el DNS y el tunnel de Cloudflare publica el servicio.
- Paperclip tiene login propio, así que, igual que las demás apps con login, no lleva Access delante.
- Con eso, la limitación de headers de `runnerd` no aplica.

**Falta validar con el punto 1:** que los WebSocket largos sobrevivan al proxy elegido y que el daemon reconecte cuando el proxy corta la conexión.

## Decisión: variables, secretos y servicios internos (caso Hindsight)

Los agentes usan variables y secretos para Slack, Jira y Hindsight.

**Cómo usan Hindsight hoy.** Según `automated-onboarding-agents/.../tool-registry.yaml`:
- **Acceso:** por REST.
- **URL:** `http://hindsight:8888`.
- **Token:** `HINDSIGHT_API_KEY`.

**Problema:** `hindsight` es un nombre de la red Docker del servidor, así que no se puede alcanzar desde la Mac aunque la variable llegue. Además, si el agente pierde la memoria, no falla: sigue trabajando sin contexto.

**Decisión: el tool gateway de Paperclip es el único punto de acceso a los servicios del servidor.**

El gateway ya existe:
- `server/src/routes/tool-gateway.ts:247-250`
- `doc/MCP-ACCESS-GOVERNANCE.md`

Agrupa conexiones de tipo MCP remoto, MCP stdio que corre en el servidor y REST, todas detrás de un único endpoint MCP por run (`/mcp/gateways/<id>`). Además:
- guarda los secretos del proveedor en el servidor;
- aplica políticas, aprobaciones y auditoría.

**Cómo se usa para este caso**
- **Hindsight** se registra como conexión MCP HTTP apuntando a `http://hindsight:8888`, que el servidor sí alcanza. La memoria es la misma desde cualquier ubicación, por construcción.
- **Slack y Jira** pasan también por conexiones del gateway, así sus secretos no salen del servidor.
- **En la máquina solo existe el token del gateway del run.** Es de alcance limitado y se revoca al terminar el run.
- **Si el gateway no responde, el run falla**, según la regla de la sección 2b del plan.

**Cómo llega el agente al gateway**
- **Predeterminado: HTTPS directo a la URL pública.** Funciona con cualquier forma de exponer la instancia.
- **Alternativa: relay por PRP** (hoy existe solo para Codex). Evita que el token salga del canal del Runner. Queda como mejora, no como requisito.

**CLIs que operan sobre el worktree local (`git`, `gh`).** No se envuelven en un MCP. El MCP se ejecutaría en el servidor, que no tiene los archivos del worktree local, y un MCP genérico de "ejecutar comando" sería un shell remoto.

Paperclip ya resuelve esto con un broker de credenciales:
- `packages/adapter-utils/src/github-launcher.ts` instala wrappers de `git` y `gh` en el `PATH` del run.
- En cada invocación, el wrapper pide la credencial a `POST /api/runtime-tools/github/credentials` (`server/src/routes/connection-intents.ts:47`) con un capability token ligado al run.
- No hay secretos en archivos ni en el entorno permanente.
- Funciona igual en Mac y en Ubuntu siempre que la máquina alcance la URL pública.
- Hay que confirmar en la fase 2 que el wrapper se instala también en runs despachados a una máquina.

**Patrón general para CLIs**
- Si el CLI solo habla con una API remota (Jira, Slack), se usa una conexión del gateway.
- Si opera sobre archivos locales, se usa un wrapper con credencial pedida al broker por run, siguiendo el modelo de `github-launcher`.
- La lista de variables libres por agente queda solo como último recurso.

**Hindsight: conector MCP o MCP propio.** El conector MCP de Hindsight tuvo un problema que no está documentado, y por eso las skills usan `curl`. Antes de construir nada, hay que diagnosticarlo en el servidor (va con el punto 1): conectar el endpoint MCP de Hindsight como conexión del gateway y probar `retain` y `recall` con el bank real.

Causas probables:
- el transporte (streamable HTTP o SSE);
- el bank en la ruta de la URL;
- el header de autenticación.

Si no se puede corregir, se escribe un MCP propio y mínimo (retain, recall, reflect) que envuelve la API REST que ya funciona. Ese MCP se registra como conexión stdio que corre en el servidor.

**Trabajo de migración (fuera de Paperclip):** las skills que hoy llaman a Hindsight por REST con `curl` pasan a usar las tools MCP.
