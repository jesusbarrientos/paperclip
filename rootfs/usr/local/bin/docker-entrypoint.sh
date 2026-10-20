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
  for dir in "$(dirname "$CLOUDSDK_CONFIG")" "$CLOUDSDK_CONFIG" "$(dirname "$KUBECONFIG")"; do
    mkdir -p "$dir" && chown node:node "$dir" 2>/dev/null || true
  done
  gosu node /usr/local/bin/paperclip-gcloud-init || true
else
  /usr/local/bin/paperclip-gcloud-init || true
fi

exec /usr/local/bin/docker-entrypoint.upstream.sh "$@"
