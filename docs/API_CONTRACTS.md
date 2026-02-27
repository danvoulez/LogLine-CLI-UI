# API Contracts

This document defines the app-side API surface under `app/api/*`.

## Conventions

- Base URL: same origin as Next.js app (for local dev: `http://localhost:3000`).
- Content type: `application/json`.
- Workspace scoping:
  - Most routes accept `x-workspace-id` header.
  - If absent, server falls back to `DEFAULT_WORKSPACE_ID` (`default` unless overridden).

## 1) Panels

### GET `/api/panels`

- Returns ordered panel manifests with embedded components.
- Seeds default data on first call per workspace.

Response:
- `200` array of panels.

### POST `/api/panels`

Body:

```json
{ "name": "New Tab" }
```

Response:
- `201` created panel row.
- `400` invalid payload.

### PATCH `/api/panels/:panelId`

Body:

```json
{ "name": "Ops", "position": 1 }
```

Response:
- `200` `{ "ok": true }`

### DELETE `/api/panels/:panelId`

Response:
- `200` `{ "ok": true }`

## 2) Panel Components

### GET `/api/panels/:panelId/components`

Response:
- `200` array of component instances for panel.

### POST `/api/panels/:panelId/components`

Body:

```json
{ "componentId": "chat-ai" }
```

Response:
- `201` component instance object.
- `404` panel not in workspace.
- `409` no grid space available.

### PATCH `/api/panels/:panelId/components/:instanceId`

Body:

```json
{
  "rect": { "x": 0, "y": 0, "w": 8, "h": 8 },
  "front_props": { "size_preset": "M" }
}
```

Response:
- `200` `{ "ok": true }`
- `400` invalid payload.

### DELETE `/api/panels/:panelId/components/:instanceId`

Response:
- `200` `{ "ok": true }`

## 3) Instance, Panel, and Effective Config

### GET `/api/instance-configs/:instanceId`

Response:
- `200` instance config object or `null` if not found in workspace.

### PUT `/api/instance-configs/:instanceId`

Body (all optional):
- `source_*`, `proc_*` fields used by runtime/component behavior.

Response:
- `200` `{ "ok": true }`
- `404` instance not in workspace.

### GET `/api/panel-settings/:panelId`

Response:

```json
{ "panel_id": "...", "settings": { } }
```

### PUT `/api/panel-settings/:panelId`

Body:
- arbitrary JSON object (validated as string-key object).

Response:
- `200` `{ "ok": true }`

### GET `/api/effective-config/:instanceId`

Response:
- `200` merged/cascade-resolved payload:
  - `layers`
  - `effective`
  - `bindings`
  - `binding_sources`
  - `missing_required_tags`
- `404` instance not found in workspace.

## 4) App Settings + Tab Meta + Installed Components

### GET `/api/settings`

Response:
- `200` map of workspace-scoped setting keys -> JSON values.

### PATCH `/api/settings`

Body:

```json
{ "key": "component_defaults", "value": { "llm_gateway_base_url": "..." } }
```

Response:
- `200` `{ "ok": true }`

### GET `/api/tab-meta/:panelId`

Response:
- `200` tab meta object or `null`.

### PUT `/api/tab-meta/:panelId`

Body:

```json
{ "icon": "Activity", "label": "Ops", "shortcut": 1 }
```

Response:
- `200` `{ "ok": true }`

### GET `/api/installed-components`

Response:
- `200` array of installed component records for workspace.

### POST `/api/installed-components`

Body:

```json
{ "componentId": "chat-ai" }
```

Response:
- `201` `{ "component_id": "...", "installed_at": "..." }`

### DELETE `/api/installed-components/:componentId`

Response:
- `200` `{ "ok": true }`

## 5) Chat + Status Log

### GET `/api/chat?session_id=...`

Response:
- `200` ordered chat messages for session and workspace.
- `400` if `session_id` missing.

### POST `/api/chat`

Body:

```json
{
  "session_id": "chat-panel-instance",
  "role": "user",
  "content": "hello",
  "panel_id": "optional",
  "instance_id": "optional",
  "model_used": "optional",
  "latency_ms": 123
}
```

Response:
- `201` created chat message row.

### GET `/api/status-log?limit=50`

Response:
- `200` latest status rows (global log; not workspace-scoped).

### POST `/api/status-log`

Body:

```json
{ "service_name": "llm-gateway", "status": "ok", "latency_ms": 42 }
```

Response:
- `201` `{ "ok": true }`

## 6) Proxy Endpoints

### ANY `/api/llm-gateway/*`

- Server-side proxy to configured LLM gateway base URL.
- Allowed hostnames are enforced (`LLM_GATEWAY_ALLOWED_HOSTS` + built-in defaults).
- Base URL resolution order:
  1. request header `x-llm-gateway-base-url`
  2. workspace setting `component_defaults.llm_gateway_base_url`
  3. env `LLM_GATEWAY_BASE_URL`

Auth forwarding:
- `Authorization: Bearer ...` forwarded when present.

Errors:
- `400` if base URL missing/disallowed.
- `502` if upstream unreachable.

### ANY `/api/logline/*`

- Proxy to LogLine daemon via `lib/api/logline-client.ts`.
- Returns upstream status/body/content-type.
- `502` if daemon unreachable.

## 7) Operational Note

For machine-specific runtime checks of `agent-256` and gateway onboarding, see:
- `LAB256_AGENT_GATEWAY_RUNBOOK.md`
