# Paperclip with local fixes (fork image: ghcr.io/jesusbarrientos/paperclip).
#
# Overlay on the official release image: same server, UI, CLIs and entrypoint.
# Each folder in patches/ is one fix (see patches/README.md). Rebuilding
# Paperclip from source (Rust runner + Node) is not needed for these fixes.
#
# Bump PAPERCLIP_VERSION to follow upstream. A fix that upstream has merged
# reports "already patched" and the build still succeeds.
ARG PAPERCLIP_VERSION=2026.1012.0
FROM ghcr.io/paperclipai/paperclip:${PAPERCLIP_VERSION}

ARG PAPERCLIP_VERSION
LABEL org.opencontainers.image.title="paperclip" \
      org.opencontainers.image.description="Paperclip ${PAPERCLIP_VERSION} with local fixes (see patches/)" \
      org.opencontainers.image.source="https://github.com/jesusbarrientos/paperclip" \
      io.github.jesusbarrientos.paperclip.base-version="${PAPERCLIP_VERSION}"

COPY patches/ /opt/paperclip-patches/

# Applies and verifies every fix; any failure fails the build.
# writeFileSync keeps the existing node:node ownership of the patched files.
RUN sh /opt/paperclip-patches/apply-all.sh /opt/paperclip-patches /app

# ENTRYPOINT, CMD, ENV, EXPOSE 3100 and the node user remapping are inherited.
