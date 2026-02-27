# Changelog

All notable documentation and platform changes should be recorded here.

## 2026-02-27

### Added
- Foundational docs:
  - `docs/README.md`
  - `docs/GETTING_STARTED.md`
  - `docs/ARCHITECTURE.md`
  - `docs/SETTINGS_CASCADE.md`
- Operations docs:
  - `docs/API_CONTRACTS.md`
  - `docs/OPERATIONS.md`
  - `docs/TROUBLESHOOTING.md`
  - `docs/LAB256_AGENT_GATEWAY_RUNBOOK.md`
- Governance docs:
  - `docs/DEPLOYMENT.md`
  - `docs/SECURITY.md`
  - `docs/CONTRIBUTING.md`
  - `docs/BRAND.md`
- Brand assets:
  - `public/brand/logline-mark-dark.svg`
  - `public/brand/logline-mark-light.svg`
  - `components/brand/LoglineMark.tsx`

### Changed
- `docs/LLM_START_HERE.md` now links to expanded doc suite.
- `docs/ROADMAP.md` reflects workspace scoping, gateway hardening, and onboarding status.
- Root `README.md` start pointers now reference `docs/README.md` and `docs/LLM_START_HERE.md`.
- PWA/app icon generators now use LogLine mark instead of placeholder letter icon.

### Runtime/Platform Notes
- UBLX app:
  - Workspace-scoped chat persistence.
  - Gateway proxy host allowlisting and safer base URL resolution.
  - Frontend hook emission of `x-workspace-id`.
- LAB256 agent:
  - CLI JWT onboarding path wired for gateway app-key lifecycle.
  - PM2 env handling updated to avoid stale static gateway key precedence.
