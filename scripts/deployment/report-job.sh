#!/bin/bash
# Root-owned code, but ALWAYS executed as the application account.
set -euo pipefail
umask 077
export TZ=Europe/London
state_root=/home/ubuntu/costinsights-deploy-state
response_file=''
fail() { /usr/bin/logger -t costinsights-report-job -- 'Scheduled report failed; details suppressed'; printf '%s\n' 'Scheduled report failed; details suppressed' >&2; exit 1; }
cleanup() { if [[ -n "$response_file" ]]; then /usr/bin/rm -f -- "$response_file"; fi; }
trap cleanup EXIT
trap fail ERR
[[ $EUID -ne 0 ]] || fail
[[ $# -ge 2 && $1 == '--credential-file' ]] || fail
credential_file=$2
shift 2
[[ $credential_file =~ ^/home/ubuntu/costinsights-deploy-state/[A-Za-z0-9_-]+/report-job\.curl\.conf$ ]] || fail
[[ -f "$credential_file" && ! -L "$credential_file" ]] || fail
[[ $(/usr/bin/stat -c '%u:%a' "$credential_file") == "$EUID:600" ]] || fail
[[ -d "$state_root" && ! -L "$state_root" && $(/usr/bin/stat -c '%u:%a' "$state_root") == "$EUID:700" ]] || fail
exec 9>"$state_root/report.lock"
/usr/bin/flock -n 9 || fail
month=$(/usr/bin/date -d "$(/usr/bin/date +%Y-%m-01) -1 day" +%Y-%m)
if [[ $# -gt 0 ]]; then
  [[ $# -eq 2 && $1 == '--month' ]] || fail
  month=$2
fi
[[ $month =~ ^[0-9]{4}-(0[1-9]|1[0-2])$ ]] || fail
response_file=$(/usr/bin/mktemp "$state_root/response.XXXXXX")
status=$(/usr/bin/curl --disable --config "$credential_file" --silent --fail --noproxy '*' --proto '=http' \
  --connect-timeout 10 --max-time 900 --retry 0 --output "$response_file" --write-out '%{http_code}' \
  "http://127.0.0.1:3024/api/reports/generate?month=$month" 2>/dev/null) || fail
[[ $status == '200' ]] || fail
/usr/bin/python3 -I -B - "$response_file" "$month" <<'PY'
import json, sys
try:
    with open(sys.argv[1]) as stream:
        value = json.load(stream)
    month = sys.argv[2]
    valid = value.get('message') == 'Report generated' and value.get('month') == month and value.get('key') == 'reports/aws-cost-' + month + '.pdf'
except Exception:
    valid = False
sys.exit(0 if valid else 1)
PY
/usr/bin/logger -t costinsights-report-job -- "Scheduled report completed for $month"
