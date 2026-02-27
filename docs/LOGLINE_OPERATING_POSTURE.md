# LogLine Operating Posture

This document defines how to keep the platform fun and fast while still safe.

## 1) Principle

`Operational-first, evidence-sufficient`.

The platform exists to produce outcomes.
Audit exists to protect trust boundaries, not to dominate every flow.

## 2) Three Operating Tiers

### Tier A: Critical (Strict)

Use full audit receipts for actions that affect:
- identity/auth/security posture,
- policy/rules,
- billing/usage integrity,
- irreversible or high-impact mutations,
- cross-context transitions.

Requirements:
- strong auth,
- explicit authorization decision,
- immutable audit record,
- correlation IDs and actor scope.

### Tier B: Normal (Light)

Use structured logs + scoped metadata for routine ops:
- standard config edits,
- normal operator actions,
- expected state transitions.

Requirements:
- access check,
- bounded logging,
- searchable telemetry.

### Tier C: Exploratory (Fast)

Keep low-risk exploratory behavior friction-light:
- read-only exploration,
- harmless UI interactions,
- local experimentation with no trust/billing impact.

Requirements:
- basic telemetry only,
- no heavy governance workflow.

## 3) Red Lines (Never Relax)

- No auth bypass for protected mutations.
- No policy bypass on sensitive actions.
- No billing-impact writes without evidence.
- No cross-tenant access leakage.

## 4) Product Experience Rule

When in doubt:
- default to speed and simplicity,
- escalate to strict controls only when money, identity, or irreversible state is at risk.

## 5) Decision Checklist

Before adding process overhead, ask:
1. Does this action affect money, identity, or irreversible trust state?
2. Can incident recovery work with lighter evidence?
3. Is this overhead improving safety or just adding ceremony?

If the answer to 1 is no, prefer Tier B/C treatment.
