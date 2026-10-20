# Paperclip with local fixes and extra agent tooling
# (fork image: ghcr.io/jesusbarrientos/paperclip).
#
# Overlay on the official release image: same server, UI, CLIs and entrypoint.
#   patches/  code fixes, one folder per fix (see patches/README.md)
#   rootfs/   extra tooling for agents: gcloud + kubectl, OpenVPN (see README.md)
# Rebuilding Paperclip from source (Rust runner + Node) is not needed.
#
# Bump PAPERCLIP_VERSION to follow upstream. A fix that upstream has merged
# reports "already patched" and the build still succeeds.
ARG PAPERCLIP_VERSION=2026.1012.0
FROM ghcr.io/paperclipai/paperclip:${PAPERCLIP_VERSION}

ARG PAPERCLIP_VERSION
LABEL org.opencontainers.image.title="paperclip" \
      org.opencontainers.image.description="Paperclip ${PAPERCLIP_VERSION} with local fixes, gcloud/kubectl and OpenVPN" \
      org.opencontainers.image.source="https://github.com/jesusbarrientos/paperclip" \
      io.github.jesusbarrientos.paperclip.base-version="${PAPERCLIP_VERSION}"

# --- Agent tooling ----------------------------------------------------------
# gcloud, kubectl and the GKE auth plugin from Google's apt repo (armored key,
# so no gpg is needed); OpenVPN + iproute2 for the staging VPN; sudo only for
# the fixed VPN wrapper.
RUN set -eux; \
    apt-get update; \
    apt-get install -y --no-install-recommends apt-transport-https ca-certificates curl; \
    curl -fsSL https://packages.cloud.google.com/apt/doc/apt-key.gpg -o /usr/share/keyrings/cloud.google.asc; \
    echo "deb [signed-by=/usr/share/keyrings/cloud.google.asc] https://packages.cloud.google.com/apt cloud-sdk main" \
      > /etc/apt/sources.list.d/google-cloud-sdk.list; \
    apt-get update; \
    apt-get install -y --no-install-recommends \
      google-cloud-cli google-cloud-cli-gke-gcloud-auth-plugin kubectl \
      openvpn iproute2 sudo \
      ruby ruby-bundler; \
    rm -rf /var/lib/apt/lists/*

# gcloud and kubectl state on the persistent /paperclip volume. Set explicitly
# so it does not depend on the HOME an adapter gives an agent run.
ENV CLOUDSDK_CONFIG=/paperclip/.config/gcloud \
    KUBECONFIG=/paperclip/.kube/config \
    USE_GKE_GCLOUD_AUTH_PLUGIN=True \
    CLOUDSDK_CORE_DISABLE_PROMPTS=1

# Our entrypoint wraps upstream's, which keeps its name and job.
RUN mv /usr/local/bin/docker-entrypoint.sh /usr/local/bin/docker-entrypoint.upstream.sh
COPY rootfs/ /
RUN set -eux; \
    chmod 0755 /usr/local/bin/docker-entrypoint.sh /usr/local/bin/vpn \
               /usr/local/bin/paperclip-gcloud-init /usr/local/sbin/paperclip-vpn; \
    chown root:root /usr/local/sbin/paperclip-vpn /etc/sudoers.d/paperclip-vpn; \
    chmod 0440 /etc/sudoers.d/paperclip-vpn; \
    visudo -cf /etc/sudoers.d/paperclip-vpn; \
    mkdir -p /etc/openvpn/paperclip; \
    gcloud version; kubectl version --client; gke-gcloud-auth-plugin --version; openvpn --version | head -1; ruby --version; bundle --version

# --- Code fixes -------------------------------------------------------------
COPY patches/ /opt/paperclip-patches/
# Applies and verifies every fix; any failure fails the build.
# writeFileSync keeps the existing node:node ownership of the patched files.
RUN sh /opt/paperclip-patches/apply-all.sh /opt/paperclip-patches /app

# ENTRYPOINT, CMD, EXPOSE 3100 and the node user remapping are inherited.
