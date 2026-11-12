#!/usr/bin/env bash
set -euo pipefail

repository_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "${repository_root}"

go_executable=go
while [[ $# -gt 0 ]]; do
  case "$1" in
    --go-executable) [[ $# -ge 2 ]] || { echo 'Missing Go executable' >&2; exit 2; }; go_executable="$2"; shift 2 ;;
    *) echo "Unknown argument: $1" >&2; exit 2 ;;
  esac
done
function go() { command "${go_executable}" "$@"; }

node --test scripts/verify-go-format.test.mjs
node scripts/verify-go-format.mjs
go mod tidy -diff
go run ./internal/tools/project-layout --check-identity
go run ./internal/tools/project-layout --check-webui
go generate ./...
openapi_output="$(node scripts/project-layout.mjs --field openapiOutput)"
operation_inventory_output="$(node scripts/project-layout.mjs --field operationInventoryOutput)"
git diff --exit-code -- "${openapi_output}" "${operation_inventory_output}" frontend/apps/web/src/generated/native-openapi.json
go test ./... -count=1
go test -race ./... -count=1
go vet ./...
CGO_ENABLED=0 go build -trimpath -buildvcs=false ./...
bash scripts/verify-artifacts.sh
