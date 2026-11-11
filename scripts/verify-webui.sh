#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "${BASH_SOURCE[0]}")/../frontend"
prepare=false
if [[ "${1:-}" == '--prepare' ]]; then prepare=true; shift; fi
if [[ $# -ne 0 ]]; then echo 'Usage: scripts/verify-webui.sh [--prepare]' >&2; exit 2; fi
if $prepare; then
  npx --yes pnpm@10.22.0 install --frozen-lockfile
  npx --yes pnpm@10.22.0 exec playwright install --with-deps chromium
fi
if [[ ! -d node_modules ]]; then echo 'Missing frontend dependencies; run with --prepare.' >&2; exit 1; fi
npx --yes pnpm@10.22.0 check
