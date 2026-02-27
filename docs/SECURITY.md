# Security Guide

This document defines the minimum security posture for UBLX, gateway proxying, and agent onboarding.

## 1) Secret Handling Rules

1. Never commit live secrets/tokens.
2. Use `.env*` for local runtime only.
3. Keep production secrets in deployment secret managers (for example Vercel env).
4. Rotate compromised/old keys immediately.

Sensitive values include:
- DB credentials (`DATABASE_URL`)
- gateway admin key / app keys
- `CLI_JWT` and onboarding secret
- daemon bootstrap token

## 2) Workspace Isolation

- API routes resolve workspace from:
  - `x-workspace-id`
  - `workspace_id` query
  - fallback default
- Persistence should always scope by workspace where applicable.
- Chat persistence is workspace-scoped.

## 3) Gateway Proxy Controls (`/api/llm-gateway/*`)

Controls currently enforced:
- allowlisted target hosts (`LLM_GATEWAY_ALLOWED_HOSTS` + defaults)
- URL protocol validation (`http/https`)
- fallback base URL from trusted server-side settings/env

Why:
- Prevent open-proxy/SSRF behavior.

## 4) Authentication Boundaries

### UBLX app API
- mostly same-origin browser calls
- workspace scoping is primary isolation primitive today

### Logline daemon proxy (`/api/logline/*`)
- upstream daemon should enforce token/JWT auth

### LAB256 agent
- protected by `AGENT_TOKEN`
- gateway auth should use onboarding flow:
  - `CLI_JWT` -> `/v1/onboarding/sync` -> issued app key

## 5) Onboarding Security

Gateway side:
- set `[security].onboarding_jwt_secret`
- set `[security].onboarding_jwt_audience`

Agent side:
- provide `CLI_JWT` with short TTL where possible
- avoid hardcoded static `LLM_GATEWAY_KEY`

## 6) PM2 Environment Hygiene

Risk:
- inherited PM2 env can override local `.env` expectations.

Mitigation:
- explicitly set dangerous overrides in PM2 ecosystem config.
- for onboarding mode, force:
  - `LLM_GATEWAY_KEY=""`

## 7) Transport Exposure

If exposing local services via tunnel:
- keep health endpoints minimal/public.
- require auth for all control routes.
- prefer short-lived session tokens for mobile clients.

## 8) Incident Response (Minimum)

If secret leakage suspected:
1. Revoke/rotate affected keys and tokens.
2. Restart impacted services with updated env.
3. Audit logs for unauthorized requests.
4. Verify auth mode and health endpoints.
5. Document incident in changelog/ops notes.

## 9) Immediate Security Backlog

1. Signed identity -> workspace mapping (remove manual workspace trust).
2. Add rate limiting for gateway proxy and sensitive endpoints.
3. Add audit log for settings writes and auth events.
4. Add secret scan automation in CI.
