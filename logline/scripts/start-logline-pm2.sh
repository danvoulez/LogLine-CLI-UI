#!/usr/bin/env bash
set -euo pipefail

ROOT="/Users/ubl-ops/UBLX App/logline"
ECOSYSTEM="$ROOT/deploy/ecosystem.logline-daemon.cjs"

if ! command -v pm2 >/dev/null 2>&1; then
  echo "pm2 not found"
  exit 1
fi

if grep -q "change-me-before-start" "$ECOSYSTEM"; then
  echo "update LOGLINE_DAEMON_TOKEN in $ECOSYSTEM before starting"
  exit 1
fi

pm2 start "$ECOSYSTEM"
pm2 save
pm2 describe logline-daemon
