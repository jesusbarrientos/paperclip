FROM node:24-trixie-slim

# build-essential/python3 cover node-gyp postinstalls; the rest mirrors the
# tools the production image gives agent runs (git, gh, ripgrep, jq).
RUN apt-get update \
  && apt-get install -y --no-install-recommends \
    build-essential ca-certificates curl gh git jq less openssh-client \
    pkg-config procps python3 ripgrep sudo wget \
  && rm -rf /var/lib/apt/lists/* \
  && echo "node ALL=(root) NOPASSWD:ALL" > /etc/sudoers.d/node \
  && chmod 0440 /etc/sudoers.d/node \
  && corepack enable

# `pnpm dev` builds the runner's native binary with cargo before the server
# starts. Same pinned rustup as the root Dockerfile; the compiler version comes
# from the runner's rust-toolchain.toml.
ENV RUSTUP_HOME=/usr/local/rustup \
    CARGO_HOME=/usr/local/cargo \
    PATH=/usr/local/cargo/bin:$PATH
ARG RUSTUP_VERSION=1.29.0
ARG RUSTUP_SHA256_AMD64=4acc9acc76d5079515b46346a485974457b5a79893cfb01112423c89aeb5aa10
ARG RUSTUP_SHA256_ARM64=9732d6c5e2a098d3521fca8145d826ae0aaa067ef2385ead08e6feac88fa5792
RUN set -eux; \
    arch="$(dpkg --print-architecture)"; \
    case "$arch" in \
      amd64) rustTarget="x86_64-unknown-linux-gnu"; sha256="$RUSTUP_SHA256_AMD64" ;; \
      arm64) rustTarget="aarch64-unknown-linux-gnu"; sha256="$RUSTUP_SHA256_ARM64" ;; \
      *) echo "unsupported architecture: $arch" >&2; exit 1 ;; \
    esac; \
    curl -fsSLo /tmp/rustup-init "https://static.rust-lang.org/rustup/archive/${RUSTUP_VERSION}/${rustTarget}/rustup-init"; \
    echo "${sha256}  /tmp/rustup-init" | sha256sum -c -; \
    chmod +x /tmp/rustup-init; \
    /tmp/rustup-init -y --no-modify-path --profile minimal --default-toolchain none; \
    rm /tmp/rustup-init
COPY packages/paperclip-runner/rust-toolchain.toml /tmp/runner-toolchain/rust-toolchain.toml
# cargo writes its registry cache under CARGO_HOME, so node must own it.
RUN cd /tmp/runner-toolchain && rustup show \
  && chown -R node:node /usr/local/cargo /usr/local/rustup

# The local adapters shell out to these CLIs; without them the matching agent
# types fail at their first heartbeat.
RUN npm install --global --omit=dev @anthropic-ai/claude-code@latest @openai/codex@latest

# Docker seeds an empty named volume with the ownership of the image path it
# mounts over. Creating these as node keeps the volumes writable without sudo.
USER node
RUN mkdir -p /home/node/.paperclip /home/node/.claude /home/node/.codex

ENV COREPACK_ENABLE_DOWNLOAD_PROMPT=0
