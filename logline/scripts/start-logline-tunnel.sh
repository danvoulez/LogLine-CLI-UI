#!/usr/bin/env bash
set -euo pipefail

CFG="/Users/ubl-ops/UBLX App/logline/deploy/cloudflared.logline.yml"

if ! command -v cloudflared >/dev/null 2>&1; then
  echo "cloudflared not found"
  exit 1
fi

cloudflared tunnel --config "$CFG" run vvz-core
