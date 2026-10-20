#!/bin/sh
# Applies every fix under /opt/paperclip-patches/<name>/ in alphabetical order.
# Each fix provides:
#   apply.mjs   node apply.mjs /app   (idempotent; non-zero exit = unexpected base)
#   verify.mts  optional; runs from /app/server with tsx, the same way the server
#               loads code. Non-zero exit fails the build.
set -eu
PATCHES_DIR="${1:-/opt/paperclip-patches}"
APP_DIR="${2:-/app}"

for dir in "$PATCHES_DIR"/*/; do
  name="$(basename "$dir")"
  echo "==> [$name] apply"
  node "$dir/apply.mjs" "$APP_DIR"
  if [ -f "$dir/verify.mts" ]; then
    echo "==> [$name] verify"
    tmp="$APP_DIR/server/.patch-verify-$name.mts"
    cp "$dir/verify.mts" "$tmp"
    (cd "$APP_DIR/server" && node --import ./node_modules/tsx/dist/loader.mjs "./$(basename "$tmp")")
    rm -f "$tmp"
  fi
done
rm -rf /tmp/tsx-* 2>/dev/null || true
echo "==> all patches applied"
