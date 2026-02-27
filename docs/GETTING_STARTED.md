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
DEFAULT_WORKSPACE_ID="default"

# Optional but recommended for server-side gateway defaults
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

## 5) First UI Checks

1. Create a tab if none exists.
2. Open Store, add a component (for example `ChatAI` or `ObservabilityHub`).
3. Confirm tab flip/settings open and save correctly.
4. Confirm drag/drop from Store to tab works.

## 6) Configure Main App Settings

In App Settings modal, set:
- `llm_gateway_base_url`
- `llm_gateway_api_key` (or onboarding-backed flows where applicable)
- `llm_gateway_admin_key` (for admin usage endpoints)

These values propagate through tag bindings and are consumed by components.

## 7) Validate API Health Paths

From project root:

```bash
curl -sS http://localhost:3000/api/panels | jq
curl -sS http://localhost:3000/api/settings | jq
```

If gateway is configured:

```bash
curl -sS http://localhost:3000/api/llm-gateway/v1/fuel | jq
```

## 8) Validate LogLine Workspace (Optional but Recommended)

```bash
cd "/Users/ubl-ops/UBLX App/logline"
cargo check
```

## 9) Validate LAB256 Agent Flow (Machine Ops)

Use:
- `docs/LAB256_AGENT_GATEWAY_RUNBOOK.md`

Critical success signal:
- `GET /health` from `agent-256` shows `gateway.auth_mode = "onboarded"` or expected mode.

## 10) Common Pitfalls

1. Dark/blank UI only:
- Check console/network and verify `/api/panels` returns data.
- Confirm `DATABASE_URL` is valid.

2. Chat returns `401 Invalid API key`:
- Verify gateway key/onboarding setup.
- Confirm no stale `LLM_GATEWAY_KEY` is injected by PM2.

3. Chat returns `502 upstream_error`:
- Backend provider/local model is unavailable or out of credits.
- Auth may already be correct; check gateway logs for upstream details.

## 11) Next Reading

- `ARCHITECTURE.md`
- `SETTINGS_CASCADE.md`
- `ROADMAP.md`
