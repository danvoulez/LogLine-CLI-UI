# UBLX Getting Started

This guide gets a new machine/operator from zero to a working UBLX + LogLine flow.

## 1) Prerequisites

- Node.js 20+ and npm
- Rust toolchain (`cargo`) for `logline` workspace tasks
- A Postgres connection string for persistence (`DATABASE_URL`)

## 2) Open Project

```bash
cd "/Users/ubl-ops/UBLX App"
```

## 3) Configure Environment

Create `.env.local` in project root and set at minimum:

```env
DATABASE_URL="postgresql://user:pass@host/db?sslmode=require"
DATABASE_URL_UNPOOLED="postgresql://user:pass@host/db?sslmode=require"
APP_URL="http://localhost:3000"
DEFAULT_WORKSPACE_ID="default"
DEFAULT_APP_ID="ublx"

# Auth mode
AUTH_PROVIDER_MODE="compat" # use "jwt" for Supabase JWT mode
RBAC_STRICT="0"             # set to "1" to require real memberships/JWT

# Optional but recommended
SUPABASE_JWT_SECRET="..."
LLM_GATEWAY_BASE_URL="https://api.logline.world"
LLM_GATEWAY_ALLOWED_HOSTS="api.logline.world,localhost,127.0.0.1"
```

## 4) Start UI/API

```bash
npm install
npm run dev
```

Open:
- `http://localhost:3000`

## 5) Choose Auth Mode

### Fast local mode (recommended for UI building)

- `AUTH_PROVIDER_MODE=compat`
- `RBAC_STRICT=0`
- Uses `x-user-id`/defaults and auto-bootstraps local memberships.

### Strict auth mode (recommended for integration and production parity)

- `AUTH_PROVIDER_MODE=jwt`
- `RBAC_STRICT=1`
- Requires `Authorization: Bearer <Supabase JWT>`.
- Requires tenant/app memberships in DB.

## 6) First UI Checks

1. Create a tab if none exists.
2. Open Store, add a component (for example `ChatAI` or `ObservabilityHub`).
3. Confirm tab flip/settings open and save correctly.
4. Confirm drag/drop from Store to tab works.

## 7) Configure Main App Settings

In App Settings modal, set:
- `llm_gateway_base_url`
- `llm_gateway_api_key` (or onboarding-backed flows where applicable)
- `llm_gateway_admin_key` (for admin usage endpoints)

These values propagate through tag bindings and are consumed by components.

## 8) Validate API Health Paths

From project root:

```bash
curl -sS http://localhost:3000/api/panels | jq
curl -sS -H "x-user-id: local-dev" http://localhost:3000/api/settings | jq
curl -sS http://localhost:3000/api/v1/cli/auth/challenge -X POST -H "content-type: application/json" -d '{}' | jq
```

If gateway is configured:

```bash
curl -sS http://localhost:3000/api/llm-gateway/v1/fuel | jq
```

## 9) Validate LogLine Workspace (Optional but Recommended)

```bash
cd "/Users/ubl-ops/UBLX App/logline"
cargo check
```

## 10) Validate LAB256 Agent Flow (Machine Ops)

Use:
- `docs/LAB256_AGENT_GATEWAY_RUNBOOK.md`

Critical success signal:
- `GET /health` from `agent-256` shows `gateway.auth_mode = "onboarded"` or expected mode.

## 11) Common Pitfalls

1. Dark/blank UI only:
- Check console/network and verify `/api/panels` returns data.
- Confirm `DATABASE_URL` is valid.

2. Chat returns `401 Invalid API key`:
- Verify gateway key/onboarding setup.
- Confirm no stale `LLM_GATEWAY_KEY` is injected by PM2.

3. Chat returns `502 upstream_error`:
- Backend provider/local model is unavailable or out of credits.
- Auth may already be correct; check gateway logs for upstream details.

## 12) Next Reading

- `ARCHITECTURE.md`
- `SETTINGS_CASCADE.md`
- `API_CONTRACTS.md`
- `TESTING.md`
- `ROADMAP.md`
