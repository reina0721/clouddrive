#!/usr/bin/env bash
set -euo pipefail

repository_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
tool_dir="$(node "${repository_root}/scripts/project-layout.mjs" --field toolsRoot)"
release_dir="$(node "${repository_root}/scripts/project-layout.mjs" --field releaseRoot)"
[[ -n "${tool_dir}" && -n "${release_dir}" ]] || { echo "layout did not provide release paths" >&2; exit 1; }
export PATH="${tool_dir}:${PATH}"
export SYFT_CHECK_FOR_APP_UPDATE=false
cd "${repository_root}"

for tool in goreleaser syft cosign; do
  command -v "${tool}" >/dev/null || { echo "missing ${tool}; run scripts/install-tools.sh" >&2; exit 1; }
done

export GORELEASER_DIST="${release_dir}"
goreleaser release --snapshot --clean --skip=sign,publish,announce

temporary_key_dir="$(mktemp -d)"
cleanup() { rm -rf "${temporary_key_dir}"; }
trap cleanup EXIT
export COSIGN_PASSWORD="$(printf '%s' "${RANDOM}-${RANDOM}-${RANDOM}-${RANDOM}" | sha256sum | cut -d' ' -f1)"
cosign generate-key-pair --output-key-prefix "${temporary_key_dir}/local-rc" >/dev/null
cosign sign-blob --yes --tlog-upload=false \
  --key "${temporary_key_dir}/local-rc.key" \
  --bundle "${release_dir}/checksums.txt.bundle" \
  --output-signature "${release_dir}/checksums.txt.sig" \
  "${release_dir}/checksums.txt"
cp "${temporary_key_dir}/local-rc.pub" "${release_dir}/local-rc.pub"
cosign verify-blob --insecure-ignore-tlog \
  --key "${release_dir}/local-rc.pub" \
  --bundle "${release_dir}/checksums.txt.bundle" \
  --signature "${release_dir}/checksums.txt.sig" \
  "${release_dir}/checksums.txt"

(cd "${release_dir}" && sha256sum --check checksums.txt)
