# Settings Cascade Specification

This document defines how configuration is resolved across app, tab, and component layers.

## 1) Layers and Priority

Resolution order (lowest to highest):

1. App layer (`component_defaults` in app settings)
2. Tab layer (`panel_settings.settings`)
3. Component instance layer (`instance_configs` + `front_props`)

Merge rule:
- Objects merge deeply.
- Primitive values at higher layers override lower layers.

Implementation reference:
- `logline/crates/logline-daemon/src/main.rs` (`get_effective_config` + cascade helpers)

## 2) Storage Mapping

App layer:
- API: `app/api/settings/route.ts`
- Key used: `component_defaults` (workspace-scoped key in DB)

Tab layer:
- API: `app/api/panel-settings/[panelId]/route.ts`
- Data: JSON object stored by panel

Component layer:
- API: `app/api/instance-configs/[instanceId]/route.ts`
- Plus `front_props` from panel component instance row

Effective config endpoint:
- `app/api/effective-config/[instanceId]/route.ts`

## 3) Binding Tags

Components request required/optional binding tags from manifest metadata.

Binding sources are searched in this order:
1. instance layer bindings
2. panel layer bindings
3. app layer bindings

Binding match rule:
- Exact tag match preferred.
- Wildcard support: requested tag can match candidate tags ending in `*` prefix style.

Returned by effective-config API:
- `bindings`
- `binding_sources`
- `missing_required_tags`

## 4) Implicit Tag Mapping

The resolver auto-generates tag bindings from common setting keys, including:

- `llm_api_key` -> `llm:api_key`, `secret:llm`
- `api_key` -> `secret:api`
- `llm_gateway_base_url` -> `backend:llm_gateway:url`
- `llm_gateway_api_key` -> `secret:llm_gateway:key`
- `llm_gateway_admin_key` -> `secret:llm_gateway:admin`
- `webhook_url` -> `transport:webhook`
- `websocket_url` -> `transport:websocket`
- `sse_url` -> `transport:sse`

Explicit `tag_bindings` in any layer augment/override these implicit values for that layer.

## 5) Typical Ownership Model

App settings:
- Shared cross-tab values (keys, gateway URLs, transport endpoints).

Tab settings:
- Tab/app-mode defaults (source hub, processing behavior) that apply to that tab.

Component settings:
- Instance-only operational overrides and rendering/front props.

## 6) Example Resolution

Given:

- App: `proc_error_mode = "RETRY"`, `llm_gateway_base_url = "https://api.logline.world"`
- Tab: `proc_error_mode = "STOP"`
- Component: `proc_command = "sync --fast"`

Effective output:
- `proc_error_mode = "STOP"` (tab overrides app)
- `proc_command = "sync --fast"` (instance value)
- gateway binding available from app tag mapping unless overridden by tab/instance.

## 7) UI/Runtime Usage

UI reads effective config and resolved bindings to render component behavior.
- Chat and observability components read gateway tags from resolved bindings.

Runtime logic:
- Should depend on resolved config contracts rather than raw layer-specific fields.

## 8) Workspace Scope

Settings and effective resolution are workspace-aware.
- Workspace determined from request header/query/default.
- Effective config query constrains instance to panel in same workspace.

## 9) Failure Modes

1. Missing required tags:
- Component still renders but should surface `missing_required_tags` warning.

2. Wrong gateway host:
- `/api/llm-gateway/*` rejects base URL not in allowlist.

3. Unexpected value types:
- Resolver uses defensive parsing and defaults for booleans/numbers/strings.

## 10) Change Rules

When adding a new global key:
1. Add field to app settings UI.
2. Persist under `component_defaults`.
3. Add implicit mapping in resolver if it should become a binding tag.
4. Document it here.
