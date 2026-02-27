# Permanent Auth Plan (Supabase-Backed)

Status: Draft v1  
Date baseline: February 27, 2026  
Scope: LogLine ecosystem (web UI, CLI, daemon, multi-tenant apps)

## 1) Objective

Build a permanent, scalable auth and authorization model with:

- Supabase Auth as identity provider.
- Mandatory tenant membership for every user.
- App-scoped roles and permissions.
- User-owned external keys (no shared tenant/app provider keys by default).
- CLI login by QR approval from authenticated mobile/web session.
- Founder-only protected operations requiring signed intents and auditable execution.

## 2) Design Principles

- Identity and authorization are separate concerns.
- Identity is centralized in Supabase Auth (`auth.users` + sessions).
- Authorization is explicit in domain tables (`tenants`, `apps`, memberships, capabilities).
- Tenant admins govern membership but cannot automatically access private app secrets.
- App admins can manage app configuration and private app data.
- Protected infra/process operations require founder capability + cryptographic signature.
- All privileged actions are auditable and replay-safe.

## 3) Roles and Capabilities

Tenant role:

- `member`
- `admin`

App role:

- `member`
- `app_admin`

Capability layer:

- `founder`

Rules:

- User must belong to at least one tenant.
- `member`: read/use only; cannot mutate tenant or app governance/config.
- `tenant admin`: manages tenant membership and policy, but no implicit private app read.
- `app_admin`: can mutate app config and read private app settings for that app.
- `founder`: can execute protected operations only with signed intents.

## 4) Permanent Data Model

Core identity linkage:

- `users` (maps to Supabase `auth.users.id`)
  - `user_id` (uuid/text from auth)
  - `email`, `display_name`, `created_at`

Tenant/app model:

- `tenants`
  - `tenant_id`, `slug` (unique), `name`, `created_at`
- `apps`
  - `app_id`, `tenant_id`, `name`, `created_at`

Memberships:

- `tenant_memberships`
  - `(tenant_id, user_id)` unique
  - `role` in (`member`, `admin`)
- `app_memberships`
  - `(tenant_id, app_id, user_id)` unique
  - `role` in (`member`, `app_admin`)

Capabilities:

- `user_capabilities`
  - `(user_id, capability)` unique
  - capability includes `founder`

Onboarding authorization:

- `tenant_email_allowlist`
  - `(tenant_id, email_normalized)` unique
  - optional `role_default`, `app_defaults`, `expires_at`

Secrets/key ownership:

- `user_provider_keys`
  - `(tenant_id, app_id, user_id, provider, key_label)` unique
  - encrypted key material
  - metadata only readable by owner and constrained app admins (policy controlled)

Protected operations and signatures:

- `founder_signing_keys`
  - `key_id`, `user_id`, `public_key`, `status`, `created_at`
- `protected_intents`
  - `intent_id`, `actor_user_id`, `tenant_id`, `app_id`, `nonce`, `payload_hash`, `expires_at`, `signature`, `verification_status`
- `protected_action_audit`
  - immutable event trail: actor, device, intent, decision, execution result, timestamps

## 5) Onboarding Flows

### 5.1 Tenant Creation

1. Founder or platform-allowed creator creates tenant.
2. Initial tenant admin assigned.
3. Tenant admin configures:
   - email allowlist
   - default app role policy
   - invite policy

### 5.2 User Onboarding (Mandatory Tenant)

1. User enters tenant slug or invite code.
2. Supabase signup/login starts.
3. `before_user_created` hook validates email against `tenant_email_allowlist`.
4. If approved:
   - user record is linked
   - tenant membership is created
   - optional app memberships are created
5. If not approved:
   - signup rejected with explicit reason.

### 5.3 App Onboarding

1. Tenant admin or founder creates app under tenant.
2. Assign app memberships:
   - members
   - app admins
3. Configure app policy and defaults.

### 5.4 User-Owned Keys Onboarding

1. User opens app settings and adds provider key.
2. Key is encrypted and stored in `user_provider_keys`.
3. App uses reference/selection of user key for execution.
4. No shared app or tenant raw provider key by default.

## 6) Request and Session Model

Identity input:

- Supabase JWT (`sub` as user id).
- Additional scoped claims can include `tenant_id`, `app_id` where applicable.

Server context resolution:

1. Resolve authenticated user from JWT.
2. Resolve tenant/app context from route + claim + request selector.
3. Authorize through membership + capability checks.

Session policy:

- Short access token lifetime.
- Refresh token rotation.
- Idle timeout.
- Optional single-session enforcement per app for sensitive roles.
- Device revocation support.

## 7) Supabase Integration Plan

Auth features used:

- Email/password and/or magic link.
- MFA for step-up (required for founder operations).
- Auth hooks:
  - `before_user_created` for tenant allowlist gate.
  - `custom_access_token` for claim shaping.

RLS:

- Enable RLS on all multi-tenant tables.
- Policies keyed by current user id + membership tables + tenant/app scope.
- Private settings tables require `app_admin` or stricter capability.

## 8) CLI Auth and QR Login

Command:

- `logline auth login --qr`

Flow:

1. CLI requests auth challenge from backend.
2. CLI renders QR encoding challenge URL and nonce.
3. Mobile/web user (already Supabase-authenticated) opens challenge.
4. User approves login for CLI device.
5. Backend mints scoped CLI session token + refresh token.
6. CLI stores token securely and confirms identity via `logline auth whoami`.

Security controls:

- Challenge TTL (short-lived).
- One-time nonce.
- Device binding and friendly device name.
- Audit event for approve/deny.

## 9) Founder Protected Actions and Signing

Founder actions include:

- protected file writes (allowlisted paths)
- protected process control (allowlisted commands/services)
- privileged deployment/runtime operations

Enforcement:

1. User must have `founder` capability.
2. User must pass step-up auth (MFA / high assurance).
3. Action must include signed intent:
   - canonical payload
   - nonce
   - expiration
   - key id
4. Backend verifies signature (ed25519), nonce freshness, role/capability.
5. Execution result is committed to immutable audit log.

## 10) API Surface (Target)

Auth and identity:

- `POST /v1/auth/tenant/resolve` (slug/invite -> tenant context)
- `POST /v1/auth/onboard/claim` (post-auth membership claim)
- `GET /v1/auth/whoami`

Membership/admin:

- `POST /v1/tenants/:tenant_id/members/allowlist`
- `POST /v1/tenants/:tenant_id/members/invite`
- `POST /v1/apps/:app_id/members`
- `PATCH /v1/apps/:app_id/members/:user_id`

Keys:

- `POST /v1/apps/:app_id/keys/user`
- `GET /v1/apps/:app_id/keys/user`
- `DELETE /v1/apps/:app_id/keys/user/:key_id`

CLI QR:

- `POST /v1/cli/auth/challenge`
- `POST /v1/cli/auth/challenge/:id/approve`
- `GET /v1/cli/auth/challenge/:id/status`

Founder/signing:

- `POST /v1/founder/keys/register`
- `POST /v1/founder/intents/verify`
- `POST /v1/founder/actions/execute`

## 11) Rollout Phases

**Phase A (Weeks 1-2): Supabase Identity Migration**

1. Goal: API trusts Supabase JWT identity instead of header-only identity.
2. Build: implement JWT verification middleware, map `sub` to `users`, keep temporary compatibility fallback for existing sessions.
3. Data: backfill `users` from current active actors and attach stable `user_id`.
4. Observability: add auth success/failure metrics and structured logs by endpoint and reason.
5. Exit criteria: 100% protected endpoints accept Supabase JWT; no critical auth regression for existing users.
6. Rollback plan: feature flag `AUTH_PROVIDER_MODE=compat` to re-enable previous header identity path.

**Phase B (Weeks 2-3): Mandatory Tenant Onboarding**

1. Goal: no user can operate without tenant membership.
2. Build: tenant slug/invite resolution, `tenant_email_allowlist`, `before_user_created` hook enforcement.
3. UX: onboarding screen requires tenant slug or invite code before account completion.
4. Policy: reject non-allowlisted email signup attempts with explicit reason code.
5. Exit criteria: all newly created users have tenant membership; unauthorized tenant signup attempts are blocked.
6. Rollback plan: allowlist enforcement flag can be relaxed to invite-only while preserving tenant checks.

**Phase C (Weeks 3-4): App Role Strictness**

1. Goal: enforce `member` vs `app_admin` at every route and query path.
2. Build: route-level permission matrix, private-read classification, write lock for non-admin app members.
3. DB: finalize RLS policies so server and DB agree on authorization rules.
4. QA: role-based integration tests for each critical endpoint group.
5. Exit criteria: members cannot mutate app/tenant data; app admins can perform all required admin operations.
6. Rollback plan: route-guard fallback to server-only checks if RLS policy bug appears in production.

**Phase D (Weeks 4-5): User-Owned Keys Model**

1. Goal: remove shared provider keys as default; each user uses own key scope.
2. Build: `user_provider_keys` storage, encryption-at-rest, key reference resolution in runtime.
3. Policy: app and tenant config store only references and usage policy, never raw user key values.
4. Migration: import existing shared keys into controlled legacy slots marked for deprecation.
5. Exit criteria: default execution paths resolve user-owned key references; shared key path is disabled for new apps.
6. Rollback plan: temporary dual-mode resolver (`user_first`, `shared_fallback`) behind feature flag.

**Phase E (Weeks 5-6): CLI QR Login**

1. Goal: CLI can authenticate without manual token copy, using QR approval from logged-in user device.
2. Build: challenge create/status/approve endpoints, terminal QR renderer, secure device session issuance.
3. Security: challenge TTL, one-time nonce, device binding, explicit approve/deny logs.
4. UX: `logline auth login --qr` + `logline auth whoami` verification flow.
5. Exit criteria: QR login works on Mac + iPhone reliably and produces scoped CLI sessions.
6. Rollback plan: keep token-based CLI auth path as fallback until QR flow stability target is reached.

**Phase F (Weeks 6-7): Founder Signed Intents**

1. Goal: protected operations require founder capability plus verified signature.
2. Build: founder key registration, canonical intent payload spec, signature verification service, nonce replay guard.
3. Execution guard: block protected files/process actions unless signature and capability checks pass.
4. Audit: immutable logs for verify decision and execution outcome.
5. Exit criteria: every protected action path refuses unsigned or invalidly signed intents.
6. Rollback plan: emergency founder lock mode that disables all protected execution paths.

**Phase G (Weeks 7-8): Hardening, Compliance, and Full Cutover**

1. Goal: production-ready auth posture and operational controls.
2. Build: session rotation/revocation tooling, device kill switch, anomaly alerts, incident runbook.
3. Compliance: exportable audit report format for privileged actions and membership changes.
4. SLOs: define and monitor auth latency/error budgets and lockout false-positive rate.
5. Exit criteria: old auth compatibility paths removed; Supabase identity + permanent RBAC is sole active model.
6. Rollback plan: blue/green auth deployment with fast switchback to previous release artifact.

**Cross-Phase Delivery Gates**

1. Each phase must ship with migration scripts, test coverage, and updated docs in same release.
2. Each phase requires staging soak with real multi-tenant test accounts before production rollout.
3. No phase can advance if audit logging is incomplete for new privileged operations.

## 12) Execution Board (Owner / ETA / Dependencies)

Use this board as the operational tracker for delivery.

| Phase | Primary Owner | Supporting Owners | ETA Window | Dependencies | Status |
| --- | --- | --- | --- | --- | --- |
| A. Supabase Identity Migration | Auth Lead | API Lead, Data Lead | Week 1-2 | Supabase project linked, JWT verification middleware ready | Planned |
| B. Mandatory Tenant Onboarding | Product + Auth Lead | Frontend Lead, Data Lead | Week 2-3 | Phase A stable in staging, allowlist schema deployed | Planned |
| C. App Role Strictness | API Lead | Auth Lead, QA Lead | Week 3-4 | Phase B complete, permission matrix approved | Planned |
| D. User-Owned Keys Model | Security Lead | API Lead, Runtime Lead | Week 4-5 | Phase C complete, key encryption strategy approved | Planned |
| E. CLI QR Login | CLI Lead | Mobile/Web Lead, API Lead | Week 5-6 | Phase A-C complete, challenge endpoints available | Planned |
| F. Founder Signed Intents | Security Lead | CLI Lead, Runtime Lead | Week 6-7 | Phase E complete, key registry + nonce store ready | Planned |
| G. Hardening + Full Cutover | Platform Lead | Auth Lead, SRE Lead | Week 7-8 | All prior phases accepted in staging | Planned |

Per-phase completion checklist:

1. Schema migrations applied and verified.
2. API contract updated in docs and examples.
3. Integration tests passing for positive and negative authorization paths.
4. Monitoring dashboards and alerts updated.
5. Rollback switch tested in staging.
6. Release notes and operator runbook updated.

Recommended owner mapping:

1. Auth Lead: identity, claims, hooks, role semantics.
2. API Lead: route guards, middleware, DB policy integration.
3. Data Lead: migrations, backfills, RLS correctness.
4. Security Lead: key management, signing, replay protection.
5. CLI Lead: QR/device auth flow and local token handling.
6. Platform/SRE Lead: rollout orchestration, observability, rollback.

## 13) Non-Negotiable Security Requirements

- No protected execution without verified signature.
- No private app settings read for plain members.
- No raw provider key exposure to frontend.
- All high-privilege actions emit immutable audit entries.
- Replay protection is mandatory for signed intents.

## 14) Open Decisions

- Whether tenant admins can see app-level encrypted key metadata.
- Whether app admins can request temporary delegated use of user keys.
- Exact founder key custody method:
  - local device keypair only
  - optional HSM/KMS-backed server verification anchor

## 15) Supabase Capability References

- Auth overview: https://supabase.com/docs/guides/auth
- MFA: https://supabase.com/docs/guides/auth/auth-mfa
- Identity linking: https://supabase.com/docs/guides/auth/auth-identity-linking
- Auth hooks: https://supabase.com/docs/guides/auth/auth-hooks
- Before user created hook: https://supabase.com/docs/guides/auth/auth-hooks/before-user-created-hook
- Custom access token hook: https://supabase.com/docs/guides/auth/auth-hooks/custom-access-token-hook
- Sessions: https://supabase.com/docs/guides/auth/sessions
- OAuth 2.1 server: https://supabase.com/docs/guides/auth/oauth/oauth-20-server
- OAuth flows: https://supabase.com/docs/guides/auth/oauth/oauth-20-flows
- Third-party auth overview: https://supabase.com/docs/guides/auth/third-party/overview
