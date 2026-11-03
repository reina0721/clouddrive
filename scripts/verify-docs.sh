#!/usr/bin/env bash
set -euo pipefail

root_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$root_dir"

args=(run ./internal/tools/docs-guard --config docs/documentation.yaml)
if [[ "${1:-}" != "" ]]; then
  args+=(--base "$1")
fi

go "${args[@]}"
