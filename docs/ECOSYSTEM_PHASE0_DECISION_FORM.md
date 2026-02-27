# Ecosystem Phase 0 Decision Form

Purpose: approve root decisions in one pass so downstream architecture work can proceed without ambiguity.

How to use:
- Keep or edit the proposed default.
- Mark status as `Approved`, `Approved with changes`, or `Deferred`.
- Add owner/date.

---

## D-0.1 HQ Product Boundary

Status: [ ] Approved  [ ] Approved with changes  [ ] Deferred
Owner: ____________
Date: ____________

Decision statement:
- HQ owns all cross-app concerns: integrations, identity/auth, policy, observability, metering, pricing/billing derivation.
- App surfaces own domain UX and local presentation behavior only.

Proposed default (recommended):
- Accept as written.

Allowed exception policy:
- Temporary exception requires expiry date and migration plan.

Notes:
- ____________________________________________________________

---

## D-0.2 Canonical Identity Scope

Status: [ ] Approved  [ ] Approved with changes  [ ] Deferred
Owner: ____________
Date: ____________

Decision statement:
- Canonical scope tuple is `tenant_id`, `app_id`, `user_id`.
- Protected operations must resolve scope before read/write.
- Client-provided scope is untrusted until validated.

Proposed default (recommended):
- Required for Tier A and Tier B writes.
- Reads may fallback to safe defaults only in local/dev mode.

Resolution precedence (proposed):
1. validated token/session claims
2. trusted server context
3. request headers/query only when explicitly allowed by mode

Notes:
- ____________________________________________________________

---

## D-0.3 Risk Posture by Tier

Status: [ ] Approved  [ ] Approved with changes  [ ] Deferred
Owner: ____________
Date: ____________

Decision statement:
- Platform runs `operational-first, evidence-sufficient`.
- Tier A is strict, Tier B is light, Tier C is fast.

Proposed default (recommended):
- Tier A: auth + policy + immutable audit receipt.
- Tier B: auth/access + structured telemetry.
- Tier C: minimal telemetry, no heavy governance friction.

Red lines (proposed):
- no auth bypass on protected mutations
- no policy bypass for sensitive actions
- no billing-impact writes without evidence
- no cross-tenant leakage

Notes:
- ____________________________________________________________

---

## D-0.4 Pricing Philosophy

Status: [ ] Approved  [ ] Approved with changes  [ ] Deferred
Owner: ____________
Date: ____________

Decision statement:
- Apps emit normalized fuel usage only.
- Pricing/billing logic is centralized and versioned.
- Apps must not self-price customers.

Proposed default fuel event core fields:
- `event_id`
- `idempotency_key`
- `tenant_id`
- `app_id`
- `user_id`
- `units`
- `unit_type`
- `occurred_at`
- `source`

Proposed default billing invariant:
- Every invoice line item references source usage events and `pricing_version`.

Notes:
- ____________________________________________________________

---

## Final Approval Block

Phase 0 result:
- [ ] Approved as a whole
- [ ] Approved with listed modifications
- [ ] Not approved (requires rework)

Blocking modifications (if any):
1. ____________________________________________________________
2. ____________________________________________________________
3. ____________________________________________________________

Approval owner: ____________________
Approval date: _____________________

Next action after approval:
- Execute `ECOSYSTEM_GREEN_TASKLIST.md` in order: 0.1 -> 0.2 -> 0.3 -> 0.4 -> 1.2 -> 3.1 -> 3.2 -> 3.3.
