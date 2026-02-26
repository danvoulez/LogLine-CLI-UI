#!/usr/bin/env bash
set -euo pipefail

ROOT="/Users/ubl-ops/UBLX App/logline"
SECRETS="/Users/ubl-ops/.secrets/logline-daemon.env"

if [[ -f "$SECRETS" ]]; then
  # shellcheck disable=SC1090
  source "$SECRETS"
fi

if [[ -z "${LOGLINE_DAEMON_TOKEN:-}" ]]; then
  echo "LOGLINE_DAEMON_TOKEN not set (expected in $SECRETS)" >&2
  exit 1
fi

cd "$ROOT"
exec "$ROOT/target/release/logline-daemon" --host 127.0.0.1 --port 7613
