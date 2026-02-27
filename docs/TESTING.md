# Testing Guide

This is the canonical validation checklist for UBLX + LogLine auth/runtime changes.

## 1) Preflight

From project root:

```bash
cd "/Users/ubl-ops/UBLX App"
```

Recommended env baseline:

```env
DATABASE_URL=...
AUTH_PROVIDER_MODE=compat
RBAC_STRICT=0
DEFAULT_WORKSPACE_ID=default
DEFAULT_APP_ID=ublx
```

## 2) Static Quality Gates

Web app:

```bash
npm run lint
npm run build
```

LogLine workspace:

```bash
cd "/Users/ubl-ops/UBLX App/logline"
cargo check --workspace
cargo test --workspace
```

Return to app root:

```bash
cd "/Users/ubl-ops/UBLX App"
```

## 3) Supabase and Migration Validation

If project is linked with Supabase CLI:

```bash
supabase db lint --linked --workdir "/Users/ubl-ops/UBLX App"
```

Validate CLI wrapper:

```bash
cd "/Users/ubl-ops/UBLX App/logline"
cargo run -p logline-cli -- supabase check --workdir "/Users/ubl-ops/UBLX App"
```

## 4) Runtime Smoke Test (Compat Mode)

Start server:

```bash
cd "/Users/ubl-ops/UBLX App"
npm run dev
```

In another terminal:

```bash
curl -sS http://localhost:3000/api/panels | jq
curl -sS -H "x-user-id: local-dev" http://localhost:3000/api/settings | jq
curl -sS -X POST http://localhost:3000/api/v1/cli/auth/challenge \
  -H "content-type: application/json" \
  -d '{}' | jq
```

Expected:
- `/api/panels` returns array.
- `/api/settings` returns JSON object in compat local-dev mode.
- challenge endpoint returns `challenge_id`, `nonce`, `expires_at`, `challenge_url`.

## 5) Runtime Smoke Test (Strict JWT Mode)

Run with strict settings:

```bash
AUTH_PROVIDER_MODE=jwt RBAC_STRICT=1 npm run dev
```

Without Bearer token, sensitive/protected routes should fail with `401`:

```bash
curl -i http://localhost:3000/api/settings
curl -i http://localhost:3000/api/v1/auth/onboard/claim -X POST -H "content-type: application/json" -d '{}'
curl -i http://localhost:3000/api/v1/founder/keys/register -X POST -H "content-type: application/json" -d '{}'
```

## 6) Auth Flow Spot Checks

Tenant resolve:

```bash
curl -sS -X POST http://localhost:3000/api/v1/auth/tenant/resolve \
  -H "content-type: application/json" \
  -d '{"slug":"default"}' | jq
```

Whoami in compat mode:

```bash
curl -sS http://localhost:3000/api/v1/auth/whoami -H "x-user-id: local-dev" | jq
```

## 7) Regression Focus Areas

When changing auth or settings cascade, always retest:
- app settings read/write (`/api/settings`)
- private config read/write (`/api/instance-configs/*`, `/api/effective-config/*`)
- component CRUD in panel routes
- `/api/v1/apps/:appId/keys/user` (must not trust tenant/user from body)
- founder verify/execute endpoints authorization

## 8) Pass Criteria

All of the following must be true:
- lint and build pass
- cargo check/test pass
- Supabase lint passes (if linked)
- compat smoke and strict smoke produce expected auth behavior
- no unexpected `500` for baseline API calls
