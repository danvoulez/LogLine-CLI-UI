# Ecosystem Green Tasklist

Goal: make the external ecosystem architecture executable with clear boundaries and minimal paranoia.

Legend:
- `Status: ✅ Green` means defined, dependency-mapped, and ready for execution.
- `Decision: USER` means founder-level decision needed.
- `Decision: DELEGATE` means implementation can be delegated.

## Phase 0: Foundational Decisions (Dependency Roots)

### 0.1 Finalize HQ Product Boundary
- Status: ✅ Green
- Decision: USER
- Deliverable: signed boundary statement of what lives in HQ vs app surfaces.
- Depends on: none.
- Exit criteria: every active endpoint maps to one owner domain.

### 0.2 Freeze Canonical Identity Scope
- Status: ✅ Green
- Decision: USER
- Deliverable: canonical scope tuple and precedence rules.
- Depends on: 0.1.
- Exit criteria: docs + middleware enforce `tenant_id/app_id/user_id` resolution.

### 0.3 Set Risk Posture by Tier
- Status: ✅ Green
- Decision: USER
- Deliverable: approved Tier A/B/C matrix from `LOGLINE_OPERATING_POSTURE.md`.
- Depends on: 0.1, 0.2.
- Exit criteria: every route/action classified by tier.

### 0.4 Approve Pricing Philosophy
- Status: ✅ Green
- Decision: USER
- Deliverable: policy statement for usage-driven centralized pricing.
- Depends on: 0.1, 0.2.
- Exit criteria: apps are prohibited from self-pricing in docs/contracts.

## Phase 1: Platform Guardrails

### 1.1 Enforce Rust-Authority Route Rule
- Status: ✅ Green
- Decision: DELEGATE
- Deliverable: lint/review guard against domain logic in Rust-owned Next routes.
- Depends on: 0.1.
- Exit criteria: CI check fails when non-proxy logic appears in owned routes.

### 1.2 Shared Middleware Chain
- Status: ✅ Green
- Decision: DELEGATE
- Deliverable: standard chain `auth -> scope -> policy -> handler -> audit` for sensitive paths.
- Depends on: 0.2, 0.3.
- Exit criteria: all Tier A endpoints use the chain.

### 1.3 Contract Governance Gate
- Status: ✅ Green
- Decision: DELEGATE
- Deliverable: schema diff checks + compatibility policy.
- Depends on: 0.1.
- Exit criteria: contract-breaking change blocked without version bump.

## Phase 2: External Protocol Consolidation

### 2.1 Unified Ingress Envelope
- Status: ✅ Green
- Decision: DELEGATE
- Deliverable: normalized request envelope for API/MCP/WebSocket/Webhooks/SSE.
- Depends on: 1.2.
- Exit criteria: all channels emit shared internal command/event format.

### 2.2 Replay and Idempotency Rules
- Status: ✅ Green
- Decision: DELEGATE
- Deliverable: idempotency key standard + replay-safe mutation behavior.
- Depends on: 2.1.
- Exit criteria: duplicate writes are deterministic and auditable.

### 2.3 External Error Model
- Status: ✅ Green
- Decision: DELEGATE
- Deliverable: canonical error schema with trace/correlation identifiers.
- Depends on: 2.1.
- Exit criteria: external integrations can programmatically act on error types.

## Phase 3: Policy, Metering, Billing

### 3.1 Policy Decision Contract
- Status: ✅ Green
- Decision: USER (approve), DELEGATE (implement)
- Deliverable: policy decision payload (`allow/deny`, reason, policy version).
- Depends on: 0.3, 1.2.
- Exit criteria: all Tier A actions produce explainable decision records.

### 3.2 Usage Ledger Canon
- Status: ✅ Green
- Decision: USER (schema approval), DELEGATE (implementation)
- Deliverable: immutable normalized fuel event schema.
- Depends on: 0.4.
- Exit criteria: ingestion rejects malformed or non-idempotent events.

### 3.3 Pricing Derivation Engine
- Status: ✅ Green
- Decision: USER (pricing model), DELEGATE (engine)
- Deliverable: reproducible billing outputs from ledger + pricing version.
- Depends on: 3.2.
- Exit criteria: any invoice line maps back to source usage evidence.

## Phase 4: Observability and Incident Homeostasis

### 4.1 Tiered Telemetry Model
- Status: ✅ Green
- Decision: DELEGATE
- Deliverable: telemetry matrix aligned with Tier A/B/C posture.
- Depends on: 0.3.
- Exit criteria: high-risk actions have full receipts; low-risk flows remain lightweight.

### 4.2 Conflict Handling MVP
- Status: ✅ Green
- Decision: DELEGATE
- Deliverable: conflict taxonomy + reconciliation receipt minimum fields.
- Depends on: 4.1, 3.1.
- Exit criteria: divergent evidence can be preserved and resolved without deletion.

### 4.3 SLO and Alert Prioritization
- Status: ✅ Green
- Decision: USER (priority), DELEGATE (implementation)
- Deliverable: SLO targets for auth/policy/metering/billing first.
- Depends on: 4.1.
- Exit criteria: paging and dashboards track agreed critical surfaces.

## Phase 5: External Platform Readiness

### 5.1 Public Contract Docs
- Status: ✅ Green
- Decision: DELEGATE
- Deliverable: external-facing API/event docs with versioning and migration rules.
- Depends on: 1.3, 2.3.
- Exit criteria: external team can integrate without private tribal knowledge.

### 5.2 Sandbox Onboarding Journey
- Status: ✅ Green
- Decision: USER (experience level), DELEGATE (flow)
- Deliverable: self-serve sandbox for identity, usage, and billing preview.
- Depends on: 3.2, 3.3.
- Exit criteria: partner can complete onboarding without manual engineering intervention.

## Phase 6: Ongoing Governance (Lightweight)

### 6.1 Quarterly Invariant Review
- Status: ✅ Green
- Decision: USER
- Deliverable: review of invariants, exceptions, and drift.
- Depends on: all prior phases.
- Exit criteria: approved report with explicit keep/change decisions.

### 6.2 Minimal Ceremony Rule
- Status: ✅ Green
- Decision: USER
- Deliverable: governance rule that process overhead must justify risk reduction.
- Depends on: 0.3.
- Exit criteria: any new mandatory process includes measurable risk rationale.

## Immediate Execution Order (Recommended)

1. 0.1 Boundary
2. 0.2 Identity
3. 0.3 Tiered risk posture
4. 1.2 Middleware chain
5. 3.1 Policy decision contract
6. 3.2 Usage ledger canon
7. 3.3 Pricing derivation engine
8. 4.1 Tiered telemetry
9. 5.1 Public contract docs
10. 5.2 Sandbox onboarding
