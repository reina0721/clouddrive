#!/usr/bin/env bash
set -euo pipefail
root_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "${root_dir}"
if [[ $# -ne 0 ]]; then
  echo 'Usage: scripts/verify-docs.sh' >&2
  exit 2
fi
go run ./internal/tools/docs-guard --config docs/documentation.yaml
