# LogLine UI Roadmap

## Active

- Workspace-scoped persistence on shared Postgres for tabs, components, and settings.
- LLM gateway integration via settings cascade and tag bindings.
- Observability cards for `fuel`, `daily usage`, and `/metrics` from gateway endpoints.

## Next

- Centralized pricing engine (single source of truth for billing):
  - Services report usage only (`app_name`, `mode`, tokens, day).
  - Pricing service computes billable cost from policy/rates.
  - Apps do not self-price their own clients.
- Auth-to-workspace mapping (replace header/manual workspace selection with signed identity).
- UI workspace switcher + explicit `x-workspace-id` emission in client requests.
