# paperclip (fork de imagen)

Imagen de [Paperclip](https://github.com/paperclipai/paperclip) con fixes propios que todavía no están en upstream. No es un fork del código: es un overlay sobre la imagen oficial `ghcr.io/paperclipai/paperclip:<versión>`, así que no recompila Rust ni Node.

Los fixes activos, con su issue/PR de upstream y cuándo retirarlos, están en [`patches/README.md`](patches/README.md).

## Estructura

```
Dockerfile                 FROM imagen oficial + apply-all.sh
patches/apply-all.sh       aplica cada patches/<fix>/ en orden y corre su verify
patches/<fix>/apply.mjs    el cambio (idempotente; falla si la base cambió)
patches/<fix>/verify.mts   comprobación con tsx, igual que el server
```

## Build y publicación

GitHub Actions construye en cada push a `main` y publica en `ghcr.io/jesusbarrientos/paperclip`:

| Tag | Uso |
|---|---|
| `<versión>-<sha>` | inmutable; es el que conviene fijar en Dokploy |
| `<versión>` | últimos fixes sobre esa versión de upstream |
| `latest` | último build |

Para subir de versión de Paperclip, cambia `ARG PAPERCLIP_VERSION` en el `Dockerfile`, o usa *Run workflow* con `paperclip_version` para probar una versión sin commitear.

Build local:

```bash
docker build --build-arg PAPERCLIP_VERSION=2026.1012.0 -t paperclip-local .
```

## Uso en Dokploy

En el compose, cambia solo la imagen del servicio de Paperclip:

```yaml
    image: ghcr.io/jesusbarrientos/paperclip:2026.1012.0-<sha>
```

Si el paquete de GHCR es privado, registra `ghcr.io` en Dokploy (Settings → Registry) con un PAT con `read:packages`, o haz público el paquete.

## Fix: Slack MCP (`slack-mcp-user-oauth`)

El conector **Slack → "Use this connection as an agent tool"** fallaba con **"Invalid permissions requested"**: Paperclip usaba los endpoints OAuth de bot, pero `mcp.slack.com` solo acepta user tokens. Con el fix, la app de Slack necesita:

1. **OAuth & Permissions → User Token Scopes** con los scopes que pide Paperclip (no Bot Token Scopes).
2. **Redirect URLs**: `https://<tu-paperclip>/api/tools/oauth/callback`.
3. **Features → Agents & AI Apps**: activar *Model Context Protocol*.
4. La app tiene que ser interna del workspace o estar publicada en el Marketplace.
