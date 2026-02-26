# UBLX Start Here (Simple Guide)

This is the fastest way to understand what you can do, from terminal to UI to new logic.

## 1) Open Terminal and Enter the Project

```bash
cd "/Users/ubl-ops/UBLX App"
```

From this folder, you have two systems:
- Next.js app (UI + API + Postgres via `DATABASE_URL`)
- `logline` Rust workspace (CLI + daemon/API)

## 2) Run the UI App (what you use day-to-day)

```bash
npm install
npm run dev
```

Open `http://localhost:3000`.

What you can do now in UI:
- Create new tabs/panels
- Rename tabs
- Delete tabs
- Open Store and add/remove components
- Work with component layouts using size presets (`S`, `M`, `L`, `XL`, `WIDE`)
- Use settings inheritance (app -> tab/panel -> component instance)

Main UI files:
- `app/page.tsx`
- `components/shell/AppShell.tsx`
- `components/panel/GridCanvas.tsx`
- `components/panel/ComponentRenderer.tsx`

## 3) Run the Rust CLI/Daemon (logic/API layer)

```bash
cd "/Users/ubl-ops/UBLX App/logline"
cargo check
```

Run CLI locally:

```bash
cargo run -p logline-cli -- init
cargo run -p logline-cli -- status
```

Run daemon locally:

```bash
LOGLINE_DAEMON_TOKEN=dev-token cargo run -p logline-daemon -- --host 127.0.0.1 --port 7600
```

Query identity:

```bash
LOGLINE_DAEMON_URL=http://127.0.0.1:7600 LOGLINE_DAEMON_TOKEN=dev-token \
cargo run -p logline-cli -- --json auth whoami
```

## 4) Existing Logic: UI vs Code

Use existing logic via UI:
- Run `npm run dev`
- Use tab bar + Store + component interactions
- UI talks to API routes under `app/api/*`

Use existing logic via code (without UI):
- Use React Query hooks in `lib/api/db-hooks.ts`
- Call REST routes in `app/api/*`
- Use Rust CLI/daemon in `logline/`

Key settings inheritance implementation:
- Resolver: `lib/config/effective-config.ts`
- API endpoint: `app/api/effective-config/[instanceId]/route.ts`
- Panel settings: `app/api/panel-settings/[panelId]/route.ts`
- Instance settings: `app/api/instance-configs/[instanceId]/route.ts`
- App settings: `app/api/settings/route.ts`
- Gateway proxy (allowlisted): `app/api/llm-gateway/[...path]/route.ts`

## 5) LLM Gateway + Onboarding Basics

UI side:
- Save `llm_gateway_base_url` and `llm_gateway_api_key` in App Settings.
- Those are applied through tag bindings and consumed by Chat/Observability widgets.
- Proxy route `/api/llm-gateway/*` only forwards to allowlisted hosts.

Agent side (LAB256-Agent):
- Agent uses `POST /v1/onboarding/sync` with `CLI_JWT` to get/rotate app key.
- Issued key is cached locally and used to call `/v1/chat/completions`.
- If onboarding fails, cached key is used as fallback.

## 6) How to Add New Logic

### A) Add a new visual component (UI component)

1. Create component file in `components/component-catalog/`, for example `MyWidget.tsx`.
2. Register manifest in `mocks/ublx-mocks.ts`:
- add `component_id`
- add `allowed_size_presets`
- add `default_size_preset`
- add size `limits`
3. Add render case in `components/panel/ComponentRenderer.tsx` switch.
4. If it needs config persistence, use:
- app-level: `app/api/settings/route.ts`
- panel-level: `app/api/panel-settings/[panelId]/route.ts`
- instance-level: `app/api/instance-configs/[instanceId]/route.ts`

### B) Add a new API logic path in Next.js

1. Add route under `app/api/.../route.ts`.
2. Add client hook in `lib/api/db-hooks.ts`.
3. Use the hook from a UI component.
4. If needed, add DB schema/table updates in:
- `db/schema.ts`
- `db/seed.ts`

### C) Add new CLI/daemon logic in Rust (`logline`)

1. Add CLI command in `logline/crates/logline-cli/src/main.rs`.
2. Add daemon endpoint in `logline/crates/logline-daemon/src/main.rs`.
3. If contract/model changes are needed, update:
- `logline/crates/logline-api/src/lib.rs`
- `logline/crates/logline-runtime/src/*`
- `logline/crates/logline-core/src/lib.rs`
4. Validate:

```bash
cd "/Users/ubl-ops/UBLX App/logline"
cargo check
```

## 7) Quick Mental Model

- UI is the operator surface.
- `app/api/*` is the app-side logic bridge.
- `logline` daemon/CLI is runtime logic and remote-control layer.
- Config priority is designed as app defaults -> panel settings -> instance settings.
