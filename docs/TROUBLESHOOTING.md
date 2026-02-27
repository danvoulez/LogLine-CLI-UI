# Troubleshooting

Fast symptom -> cause -> fix guide.

## 1) UI Loads Only Dark/Empty Background

Likely causes:
- `DATABASE_URL` missing/invalid.
- API errors loading `/api/panels`.

Checks:

```bash
curl -i http://localhost:3000/api/panels
```

Fix:
1. Set valid `DATABASE_URL` in `.env.local`.
2. Restart Next.js app.
3. Recheck browser network tab for 5xx responses.

## 2) App Settings Save But Components Do Not Reflect Them

Likely causes:
- Wrong workspace scope.
- Missing binding tags for component.

Checks:

```bash
curl -sS "http://localhost:3000/api/effective-config/<instanceId>" | jq
```

Fix:
1. Confirm `bindings` includes expected tags.
2. Confirm `missing_required_tags` is empty.
3. Verify `x-workspace-id` and settings are aligned.

## 3) `/api/settings` Returns `401` or `403`

Likely causes:
- Running with `AUTH_PROVIDER_MODE=jwt` + `RBAC_STRICT=1` and no Bearer token.
- User is `member` and route needs `private_read` (`app_admin`).

Checks:

```bash
curl -i http://localhost:3000/api/settings
```

Fix:
1. For local UI work, use `AUTH_PROVIDER_MODE=compat` and `RBAC_STRICT=0`.
2. For strict mode, send a valid Supabase JWT in `Authorization`.
3. Confirm app membership role is `app_admin`.

## 4) `401 Invalid API key` From Agent Chat

Likely causes:
- Stale `LLM_GATEWAY_KEY`.
- Onboarding not active.
- PM2 injecting inherited env key.

Checks:

```bash
curl -sS -H "Authorization: Bearer $AGENT_TOKEN" http://127.0.0.1:4256/health | jq
```

Fix:
1. Use onboarding mode (`CLI_JWT`) in agent `.env`.
2. Remove `LLM_GATEWAY_KEY` from agent `.env`.
3. Ensure PM2 config forces `LLM_GATEWAY_KEY=""`.
4. Reload `agent-256`.

## 5) `gateway.auth_mode = env-key` But You Expect Onboarded

Likely causes:
- PM2 env precedence still providing `LLM_GATEWAY_KEY`.

Fix:
1. Set `env: { LLM_GATEWAY_KEY: "" }` in ecosystem config.
2. `pm2 startOrReload ... --only agent-256`.

## 6) `502 upstream_error` From Gateway/Agent

Likely causes:
- Provider billing/credits issue.
- Local model backend unavailable.

Checks:

```bash
pm2 logs llm-gateway --lines 120 --nostream
```

Fix:
1. Restore provider credits/keys.
2. Ensure local backend (for example Ollama) is reachable and model exists.
3. Set deterministic mode to known healthy backend.

## 7) Chat Request Hangs/Times Out

Likely causes:
- Gateway retries all unavailable candidates.

Fix:
1. Use explicit gateway mode (for example `LLM_GATEWAY_MODE=premium` or `local`).
2. Reduce unhealthy candidates in gateway config.
3. Restart gateway after config changes.

## 8) `/api/llm-gateway/*` Returns `400` Missing/Disallowed Base URL

Likely causes:
- No base URL configured in app settings/env.
- Host not in allowlist.

Fix:
1. Set `llm_gateway_base_url` in App Settings.
2. Set `LLM_GATEWAY_BASE_URL` server env fallback.
3. Update `LLM_GATEWAY_ALLOWED_HOSTS` to include intended host.

## 9) Panel/Component Not Found in Workspace

Likely causes:
- Wrong workspace header/query.

Fix:
1. Check emitted `x-workspace-id`.
2. Confirm resources were created in same workspace.
3. Verify `DEFAULT_WORKSPACE_ID` consistency.

## 10) PM2 Restarted But Behavior Did Not Change

Likely causes:
- Updated file not loaded by PM2 command used.
- App not rebuilt (for TypeScript agent).

Fix:
1. Rebuild where needed (`npm run build` for agent).
2. Use `pm2 startOrReload <ecosystem> --only <app>`.
3. Check process `uptime` and logs.

## 11) Useful One-Liners

List API routes:

```bash
find "/Users/ubl-ops/UBLX App/app/api" -type f -name "route.ts" | sort
```

Show active PM2 processes:

```bash
pm2 list
```

Tail key service logs quickly:

```bash
pm2 logs agent-256 --lines 60 --nostream
pm2 logs llm-gateway --lines 80 --nostream
```
