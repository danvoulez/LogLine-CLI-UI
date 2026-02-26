# LogLine UI Roadmap

## Active

- Workspace-scoped persistence on shared Postgres for tabs, components, and settings.
- LLM gateway integration via settings cascade and tag bindings.
- Observability cards for `fuel`, `daily usage`, and `/metrics` from gateway endpoints.
- Chat persistence is now workspace-scoped.
- `/api/llm-gateway/*` now validates gateway host allowlist (`LLM_GATEWAY_ALLOWED_HOSTS`) and supports app-setting fallback URL.
- Frontend API hooks emit `x-workspace-id` on requests (default `default`, overridable via `localStorage.ublx_workspace_id`).

## Next

- Centralized pricing engine (single source of truth for billing):
  - Services report usage only (`app_name`, `mode`, tokens, day).
  - Pricing service computes billable cost from policy/rates.
  - Apps do not self-price their own clients.
- Auth-to-workspace mapping (replace header/manual workspace selection with signed identity).
- UI workspace switcher (header emission already implemented in hooks).
