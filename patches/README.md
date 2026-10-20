# Patches

Cada carpeta es un fix independiente que se aplica sobre `/app` de la imagen oficial, en orden alfabético (`apply-all.sh`).

| Fix | Problema | Upstream | Retirar cuando |
|---|---|---|---|
| `slack-mcp-user-oauth` | El conector Slack "agent tool" falla con "Invalid permissions requested": usa los endpoints OAuth de bot en vez de los de user token que exige `mcp.slack.com` | issue #13935, PR #14037 | `apply.mjs` diga `already patched` |

## Cómo agregar un fix

1. Crea `patches/<nombre>/apply.mjs`. Recibe `/app` como argumento, tiene que ser idempotente y salir con un código distinto de 0 si el archivo base no está como espera. Así, un cambio de upstream rompe el build en vez de pasar en silencio.
2. Opcional: `patches/<nombre>/verify.mts`. Corre con tsx desde `/app/server`, igual que el server, y tiene que salir con 0 si el fix quedó activo.
3. Agrega una fila a la tabla de arriba.

Ten en cuenta que el server corre desde `server/dist` (JS compilado) y carga `@paperclipai/shared` desde `packages/shared/src` vía tsx. Si cambias lógica del server, parchea `server/dist/...js`, no `server/src`.
