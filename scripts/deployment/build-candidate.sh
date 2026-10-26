#!/bin/bash
# For an approved disposable, isolated build machine ONLY. Never production.
set -euo pipefail
umask 077
[[ $EUID -ne 0 ]] || { echo 'Refusing privileged build' >&2; exit 1; }
[[ $(hostname -s) != ip-172-31-18-248 ]] || { echo 'Production-host build is forbidden' >&2; exit 1; }
[[ ${COSTINSIGHTS_ISOLATED_BUILD:-} == approved ]] || { echo 'Approved isolated builder required' >&2; exit 1; }
[[ $# -ge 2 && $# -le 3 ]] || { echo 'Expected captured config, candidate, and optional approved new-token flag' >&2; exit 1; }
captured=$1
candidate=$2
new_token=()
if [[ $# -eq 3 ]]; then
  [[ $3 == '--allow-new-report-token' ]] || exit 1
  new_token=(--allow-new-report-token)
fi
# VM/container CPU, memory and volume quotas are provisioned separately. This
# script never creates a container, changes limits, or falls back to production.
python3 -B - "$candidate" <<'PY'
import os, sys
s = os.statvfs(sys.argv[1])
if s.f_bavail * s.f_frsize < 10 * 1024**3:
    sys.exit('Insufficient isolated-builder disk reserve')
PY
cd "$candidate"
npm ci --include=dev --ignore-scripts
# A new credential is NOT automatic. Use the separately approved preparation
# command first if none exists; otherwise preserve the captured credential.
node scripts/deployment/prepare-release.mjs --prepare --captured="$captured" --candidate="$candidate" "${new_token[@]}" --execute
npm run lint
npx tsc --noEmit
npm test
NODE_ENV=production NEXT_PUBLIC_BASE_URL=https://aws.develop.thebrilliantclub.org npm run build
# No production HTTP smoke checks belong on this machine.
