# UBLX Documentation Index

This folder is the operational and technical source of truth for UBLX + LogLine integrations.

## Start Here

- `LLM_START_HERE.md`: Fast guide to run UI, daemon, and core flows.
- `LAB256_AGENT_GATEWAY_RUNBOOK.md`: Exact PM2/onboarding runbook for this machine setup.

## Core Product Docs

- `GETTING_STARTED.md`: First 10-minute setup, checks, and first successful workflow.
- `ARCHITECTURE.md`: Boundaries and responsibilities across UI, API, gateway, CLI/daemon.
- `SETTINGS_CASCADE.md`: App -> tab -> component settings inheritance and binding rules.
- `API_CONTRACTS.md`: App API endpoint contracts, payloads, and proxy behavior.
- `OPERATIONS.md`: Day-to-day PM2 runtime operations and health checks.
- `TROUBLESHOOTING.md`: Symptom -> cause -> fix playbook.
- `ROADMAP.md`: Active work and next priorities.

## Ecosystem/Institutional Context

- `LOGLINE.WORLD — Official Ecosystem Doc.md`: Internal ecosystem map.
- `UBLX — Beginner's Guide (Detailed Edit.md`: Human-friendly usage guide.

## Logline CLI Subdocs

- `logline-cli/ARCHITECTURE.md`
- `logline-cli/examples/*`

## Conventions

- Use absolute paths in operational commands.
- Prefer environment-driven configuration over hardcoded secrets.
- Keep docs updated in the same PR/commit as behavior changes.
