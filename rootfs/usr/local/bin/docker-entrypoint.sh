#!/bin/sh
# Wrapper around the upstream entrypoint (moved to docker-entrypoint.upstream.sh
# at build time), so upstream's ENTRYPOINT/CMD stay untouched across versions.
set -e

if [ "$(id -u)" -eq 0 ]; then
  # The VPN goes first: private GKE endpoints may only be reachable through it.
  if [ "${OPENVPN_AUTOSTART:-0}" = "1" ]; then
    /usr/local/sbin/paperclip-vpn up \
      || echo "docker-entrypoint: VPN autostart failed; Paperclip starts anyway (see: vpn log)" >&2
  fi
  # gcloud/kubectl state lives on the /paperclip volume and must be node-owned
  # (root-owned files there cause EACCES later). Upstream repairs the rest of
  # the tree recursively right after this.
  # Recursive: a `docker exec` as root (e.g. `gcloud auth login` without -u node)
  # leaves root-owned 600 files that break gcloud for agents. Upstream's own
  # repair runs later, after gcloud-init, so fix these dirs here first.
  for dir in "$(dirname "$CLOUDSDK_CONFIG")" "$CLOUDSDK_CONFIG" "$(dirname "$KUBECONFIG")" "$GEM_HOME"; do
    mkdir -p "$dir" && chown -R node:node "$dir" 2>/dev/null || true
  done
  gosu node /usr/local/bin/paperclip-gcloud-init || true
else
  /usr/local/bin/paperclip-gcloud-init || true
fi

exec /usr/local/bin/docker-entrypoint.upstream.sh "$@"
