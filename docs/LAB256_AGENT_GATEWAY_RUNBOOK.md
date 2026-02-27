# LAB256 Agent + LLM Gateway Runbook

This runbook describes the current working setup for `agent-256` on this machine, with CLI-JWT onboarding and real gateway calls.

## 1) Scope

- Agent process: `agent-256` (PM2)
- MCP process: `agent-256-mcp` (PM2)
- Gateway process: `llm-gateway` (PM2)
- Agent source: `/Users/ubl-ops/LAB256-Agent/agent`
- Gateway config: `/Users/ubl-ops/.llm-gateway/config.toml`

## 2) Current Auth Model

- Agent does **not** rely on a hardcoded gateway key.
- Agent uses `CLI_JWT` to call `POST /v1/onboarding/sync`.
- Gateway issues per-app key (`api_clients` table in gateway DB).
- Agent caches issued key in:
  - `~/.lab256-agent/gateway-key.json`

Health should show:
- `gateway.auth_mode = "onboarded"`

## 3) Required Files

Agent env:
- `/Users/ubl-ops/LAB256-Agent/agent/.env`

Agent PM2 app config:
- `/Users/ubl-ops/LAB256-Agent/ecosystem.config.cjs`

Gateway app config:
- `/Users/ubl-ops/.llm-gateway/config.toml`

## 4) Required Env (Agent)

In `/Users/ubl-ops/LAB256-Agent/agent/.env`:

```env
AGENT_PORT=4256
AGENT_NAME=LAB256
AGENT_TOKEN=...

LLM_GATEWAY_URL=http://localhost:7700/v1
LLM_MODEL=auto
LLM_GATEWAY_MODE=premium

CLI_JWT=...
LLM_GATEWAY_APP_NAME=lab256-agent
LLM_GATEWAY_ONBOARD_ROTATE=false

MCP_LOCAL_URL=http://127.0.0.1:4257/mcp
```

Important:
- Keep `LLM_GATEWAY_KEY` unset/absent for onboarding mode.

## 5) Required Config (Gateway)

In `/Users/ubl-ops/.llm-gateway/config.toml`:

```toml
[security]
onboarding_jwt_audience = "logline-cli"
onboarding_jwt_secret = "..."
```

## 6) Restart Sequence

```bash
pm2 restart llm-gateway --update-env
pm2 startOrReload /Users/ubl-ops/LAB256-Agent/ecosystem.config.cjs --only agent-256
```

## 7) Verification Commands

Load agent token:

```bash
set -a; source /Users/ubl-ops/LAB256-Agent/agent/.env; set +a
```

Agent health:

```bash
curl -sS -H "Authorization: Bearer $AGENT_TOKEN" http://127.0.0.1:4256/health | jq
```

Expected:
- `ok: true`
- `gateway.ok: true`
- `gateway.auth_mode: "onboarded"`

Agent chat probe:

```bash
curl -sS -H "Authorization: Bearer $AGENT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"message":"Reply with exactly: online"}' \
  http://127.0.0.1:4256/chat | jq
```

## 8) Known Failure Modes

1. `401 Invalid API key`
- Cause: stale static key path.
- Fix: remove `LLM_GATEWAY_KEY`, keep `CLI_JWT`, reload PM2 app.

2. `gateway.auth_mode = env-key`
- Cause: inherited PM2 env still injecting static key.
- Fix: keep `env: { LLM_GATEWAY_KEY: "" }` in ecosystem config and reload app.

3. `502 ... upstream_error`
- Cause: provider/local model unavailable, not auth.
- Current observed case: provider credit failure and/or local Ollama route unavailable.

4. chat hangs/timeouts
- Cause: route retries with unavailable upstreams.
- Fix: set deterministic mode (`LLM_GATEWAY_MODE=premium` or `local`) and ensure selected backend is healthy.

## 9) Operational Note (Current)

As of 2026-02-27:
- Onboarding path works end-to-end.
- Agent authenticates via onboarding (`auth_mode: onboarded`).
- Remaining failures are upstream/provider availability or billing, not onboarding/auth wiring.
