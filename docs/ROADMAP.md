# LogLine UI Roadmap

## Active

- Workspace-scoped persistence on shared Postgres for tabs, components, and settings.
- LLM gateway integration via settings cascade and tag bindings.
- Observability cards for `fuel`, `daily usage`, and `/metrics` from gateway endpoints.
- Chat persistence is now workspace-scoped.
- `/api/llm-gateway/*` now validates gateway host allowlist (`LLM_GATEWAY_ALLOWED_HOSTS`) and supports app-setting fallback URL.
- Frontend API hooks emit `x-workspace-id` on requests (default `default`, overridable via `localStorage.ublx_workspace_id`).
- LAB256-Agent onboarding flow is wired (`CLI_JWT` -> `/v1/onboarding/sync` -> issued app key cache).

## Next

- Centralized pricing engine (single source of truth for billing):
  - Services report usage only (`app_name`, `mode`, tokens, day).
  - Pricing service computes billable cost from policy/rates.
  - Apps do not self-price their own clients.
- Auth-to-workspace mapping (replace header/manual workspace selection with signed identity).
- UI workspace switcher (header emission already implemented in hooks).
- Gateway provider reliability policy:
  - guarantee at least one healthy backend per mode (local/premium),
  - avoid long retry/hang behavior when upstreams are unavailable.

## Green Track (Architecture Execution)

- Foundational docs published:
  - `LOGLINE_OPERATING_POSTURE.md`
  - `LOGLINE_ECOSYSTEM_NORMATIVE_BASE.md`
  - `ECOSYSTEM_GREEN_TASKLIST.md`
- Immediate order of execution:
  1. HQ boundary freeze
  2. Canonical identity scope freeze
  3. Tier A/B/C risk posture freeze
  4. Shared middleware chain for Tier A endpoints
  5. Policy decision contract
  6. Usage ledger canon
  7. Central pricing derivation engine
