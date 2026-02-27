# UBLX Documentation Index

This folder is the technical source of truth for UBLX + LogLine UI/API/CLI.

## Read By Goal

If you are new and want to run the app:
- `GETTING_STARTED.md`
- `TESTING.md`

If you are implementing features:
- `ARCHITECTURE.md`
- `SETTINGS_CASCADE.md`
- `API_CONTRACTS.md`
- `RBAC_MODEL.md`

If you are operating services:
- `OPERATIONS.md`
- `DEPLOYMENT.md`
- `TROUBLESHOOTING.md`

If you are working on auth/security:
- `AUTH_PERMANENT_PLAN.md`
- `SUPABASE_FOUNDATION.md`
- `SECURITY.md`

## Core Docs

- `LLM_START_HERE.md`: Fast path to run UI + gateway flows.
- `LOGLINE_OPERATING_POSTURE.md`: Operational-first safety posture (strict where it matters, lightweight elsewhere).
- `LOGLINE_ECOSYSTEM_NORMATIVE_BASE.md`: Non-negotiable invariants and architecture boundaries.
- `ECOSYSTEM_GREEN_TASKLIST.md`: Dependency-mapped execution checklist with decision ownership.
- `ECOSYSTEM_PHASE0_DECISION_FORM.md`: One-page founder approval form for root architecture decisions.
- `ECOSYSTEM_PHASE0_APPROVED_V1.md`: Approved Phase 0 baseline for execution.
- `GETTING_STARTED.md`: First setup and first successful run.
- `TESTING.md`: Validation suite for web, auth, CLI, and migrations.
- `ARCHITECTURE.md`: System boundaries and component responsibilities.
- `SETTINGS_CASCADE.md`: App -> tab -> component inheritance contract.
- `API_CONTRACTS.md`: API route contracts including `/api/v1/*`.
- `RBAC_MODEL.md`: Tenant/app/user role model and permission semantics.
- `AUTH_PERMANENT_PLAN.md`: Long-term auth rollout and execution plan.
- `SUPABASE_FOUNDATION.md`: Persistence and Supabase operating model.
- `SECURITY.md`: Security posture and hardening checklist.
- `OPERATIONS.md`: PM2 runbook and daily commands.
- `DEPLOYMENT.md`: Deployment topologies and env matrix.
- `TROUBLESHOOTING.md`: Symptom -> cause -> fix.
- `CONTRIBUTING.md`: Workflow and quality bar.
- `CHANGELOG.md`: Notable changes.
- `ROADMAP.md`: Upcoming priorities.
- `BRAND.md`: Logo usage references.

## Ecosystem Context

- `LOGLINE.WORLD — Official Ecosystem Doc.md`: Internal ecosystem map.
- `UBLX — Beginner's Guide (Detailed Edit.md`: Friendly operator guide.
- `LAB256_AGENT_GATEWAY_RUNBOOK.md`: Machine-specific PM2/onboarding runbook.

## CLI Subdocs

- `logline-cli/ARCHITECTURE.md`
- `logline-cli/examples/*`

## Documentation Rules

- Prefer explicit command examples over abstract description.
- Keep env var names and endpoint paths exact.
- Update docs in the same change set as behavior changes.
