# paperclip (fork de imagen)

Imagen de [Paperclip](https://github.com/paperclipai/paperclip) con fixes propios y herramientas extra para los agentes. No es un fork del código: es un overlay sobre la imagen oficial `ghcr.io/paperclipai/paperclip:<versión>`, así que no recompila Rust ni Node.

| Capa | Qué agrega |
|---|---|
| `patches/` | fixes de código (ver [`patches/README.md`](patches/README.md)) |
| `rootfs/` + `Dockerfile` | `gcloud`, `kubectl`, `gke-gcloud-auth-plugin`, OpenVPN (`vpn up/down/status/log`) |

## Estructura

```
Dockerfile                                FROM imagen oficial + herramientas + apply-all.sh
patches/apply-all.sh                      aplica cada patches/<fix>/ y corre su verify
rootfs/usr/local/bin/docker-entrypoint.sh envuelve el entrypoint oficial (VPN + gcloud al arrancar)
rootfs/usr/local/bin/paperclip-gcloud-init activa la cuenta de servicio y genera el kubeconfig
rootfs/usr/local/sbin/paperclip-vpn       wrapper de OpenVPN (root, config fija)
rootfs/usr/local/bin/vpn                  comando para los agentes (sudo solo a ese wrapper)
```

## Build y publicación

GitHub Actions construye en cada push a `main` y publica en `ghcr.io/jesusbarrientos/paperclip`:

| Tag | Uso |
|---|---|
| `<versión>-<sha>` | inmutable; es el que conviene fijar en Dokploy |
| `<versión>` | último build sobre esa versión de upstream |
| `latest` | último build |

Para subir de versión de Paperclip, cambia `ARG PAPERCLIP_VERSION` en el `Dockerfile`, o usa *Run workflow* con `paperclip_version`.

## gcloud + kubectl con una cuenta siempre activa

Usa una **cuenta de servicio** de GCP, no tu cuenta personal. Una key JSON de service account no expira ni pide reautenticación. Un `gcloud auth login` personal sí puede expirar por las políticas de sesión de Google Workspace y hay que volver a entrar a mano.

1. En GCP, crea una service account para los agentes, por ejemplo `paperclip-agents@<proyecto>.iam.gserviceaccount.com`, con solo lo necesario: `roles/container.viewer` para leer en GKE, o `roles/container.developer` si también deben cambiar cosas. Ajusta el RBAC de Kubernetes si hace falta.
2. Crea una key JSON y guárdala en el host de Dokploy, por ejemplo en `/srv/paperclip/secrets/gcp-sa.json`, con `chown 1000:1000` y `chmod 400`.
3. Monta la key y define las variables en el compose (ver abajo). Al arrancar, el contenedor activa la cuenta y genera el kubeconfig de cada cluster en `GKE_CLUSTERS`.

El estado de gcloud vive en el volumen: `CLOUDSDK_CONFIG=/paperclip/.config/gcloud` y `KUBECONFIG=/paperclip/.kube/config`. Si prefieres tu cuenta personal, entra una vez con `docker exec -it -u node <contenedor> gcloud auth login --no-launch-browser` y la sesión sobrevive a redeploys. Si la sesión expira, hay que repetir el login.

## OpenVPN para staging

El contenedor puede levantar el túnel, pero necesita `NET_ADMIN` y `/dev/net/tun`. El túnel es **split**: se ignora `redirect-gateway` y solo pasan por la VPN las rutas que empuja el servidor, así que Paperclip, Slack y las APIs de los modelos siguen saliendo por la red normal.

1. Copia tu `.ovpn` al host como `/srv/paperclip/vpn/client.conf`. Si usa usuario y contraseña, agrega `auth-user-pass auth.txt` y crea `auth.txt` en la misma carpeta (usuario en la línea 1, contraseña en la 2). Deja la carpeta con `chown -R root:root` y `chmod 600`.
2. Monta la carpeta en `/etc/openvpn/paperclip` (solo lectura). Los agentes corren como `node` y no pueden leerla; solo pueden ejecutar el wrapper.
3. Con `OPENVPN_AUTOSTART=1` el túnel sube al arrancar. Si no, los agentes usan `vpn up`, `vpn status`, `vpn down` y `vpn log`.

No sirve una VPN con MFA interactiva (un código o push en cada conexión): nadie va a estar ahí para aprobarla. Para eso hace falta un perfil o certificado de máquina sin MFA, que suele dar IT.

## Compose en Dokploy

```yaml
  paperclip:
    image: ghcr.io/jesusbarrientos/paperclip:2026.1012.0-<sha>
    # ... lo que ya tenías (env, puertos, volumen paperclip-data:/paperclip)
    cap_add:
      - NET_ADMIN            # solo si usas la VPN
    devices:
      - /dev/net/tun:/dev/net/tun
    environment:
      # ... tus variables actuales
      GCP_SA_KEY_FILE: /run/secrets/gcp-sa.json
      GCP_PROJECT: mi-proyecto
      GKE_CLUSTERS: "staging:us-central1 prod:us-central1:otro-proyecto"   # nombre:ubicación[:proyecto]
      OPENVPN_AUTOSTART: "1"
    volumes:
      - paperclip-data:/paperclip
      - /srv/paperclip/secrets/gcp-sa.json:/run/secrets/gcp-sa.json:ro
      - /srv/paperclip/vpn:/etc/openvpn/paperclip:ro
```

Comprobación después del deploy:

```bash
docker exec -u node <contenedor> sh -c 'gcloud auth list; kubectl config get-contexts; vpn status'
```

## Fix: Slack MCP (`slack-mcp-user-oauth`)

El conector **Slack → "Use this connection as an agent tool"** fallaba con **"Invalid permissions requested"**: Paperclip usaba los endpoints OAuth de bot, pero `mcp.slack.com` solo acepta user tokens. Con el fix, la app de Slack necesita:

1. **OAuth & Permissions → User Token Scopes** con los scopes que pide Paperclip (no Bot Token Scopes).
2. **Redirect URLs**: `https://<tu-paperclip>/api/tools/oauth/callback`.
3. **Features → Agents & AI Apps**: activar *Model Context Protocol*.
4. La app tiene que ser interna del workspace o estar publicada en el Marketplace.
