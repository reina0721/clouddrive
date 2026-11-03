#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "${BASH_SOURCE[0]}")/../frontend"
npx --yes pnpm@10.22.0 install --frozen-lockfile
npx --yes pnpm@10.22.0 exec playwright install --with-deps chromium
npx --yes pnpm@10.22.0 check
