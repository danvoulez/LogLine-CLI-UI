# Template Contract (Frozen API)

This file defines the stable API surface for component template settings.

## Versioning

- Current version: `template_contract_version = 1`
- Any key add/remove/rename requires:
  1. version bump,
  2. migration note,
  3. migration utility update,
  4. checker/test updates.

## Merge Precedence

1. scoped app defaults (`app_scope`)
2. panel defaults
3. component instance overrides

Exception:
- `override_cascade = true` -> instance-only values are used.

## Stable Keys (v1)

- `template_contract_version`
- `app_scope`
- `override_cascade`
- `template_size`
- `health`
- `health_source`
- `info_tone`
- `display_density`
- `interaction_mode`
- `refresh_policy`
- `empty_state_label`
- `error_state_mode`
- `import_app_tags`
- `import_tab_tags`
- `required_bindings`
- `optional_bindings`
- `connection_type`
- `connection_ref`
- `connection_contract`
- `cli_command`
- `cli_contract`
- `permissions`
- `mobile_priority`
- `telemetry_hooks`

## Required Telemetry Hooks

- `rendered`
- `flip_opened`
- `settings_saved`
- `action_clicked`
- `error_shown`

## Enforcement

- API write path normalizes and validates persisted template keys.
- Template checker validates critical architectural invariants.
