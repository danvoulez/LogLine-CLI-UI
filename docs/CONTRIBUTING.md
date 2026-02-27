# Contributing

This project favors small, verifiable changes with docs updated in the same commit.

## 1) Workflow

1. Pull latest `main`.
2. Create a branch (recommended prefix: `codex/` for agent-assisted work).
3. Make focused changes.
4. Run validation.
5. Update docs for behavior/config/API changes.
6. Open PR with test evidence and migration notes (if any).

## 2) Code Quality Baseline

App (Next.js):

```bash
cd "/Users/ubl-ops/UBLX App"
npm run lint
```

Logline workspace (Rust):

```bash
cd "/Users/ubl-ops/UBLX App/logline"
cargo check
```

LAB256 agent (TypeScript):

```bash
cd "/Users/ubl-ops/LAB256-Agent/agent"
npm run build
```

## 3) Change Scope Guidelines

Prefer one theme per commit:
- UI behavior
- API contract
- persistence/schema
- runtime/ops wiring
- docs only

Avoid bundling unrelated fixes.

## 4) Mandatory Docs Update Cases

Update docs when you change:
- endpoint behavior or payloads (`API_CONTRACTS.md`)
- env vars / deployment flow (`DEPLOYMENT.md`)
- auth or secret handling (`SECURITY.md`)
- operations procedures (`OPERATIONS.md`/runbooks)
- settings cascade semantics (`SETTINGS_CASCADE.md`)

## 5) PR Checklist

- [ ] Validation commands executed successfully.
- [ ] No real secrets committed.
- [ ] Workspace scoping preserved for affected routes.
- [ ] Backward compatibility considered (or migration documented).
- [ ] Docs updated.
- [ ] Rollback path described for risky runtime changes.

## 6) Commit Message Style

Use clear, action-oriented messages:
- `Harden gateway proxy and workspace-scope chat`
- `Add API contracts and troubleshooting docs`
- `Wire agent onboarding flow and PM2 env safeguards`

## 7) Sensitive Files

Treat these as high-risk:
- `.env*`
- PM2 ecosystem configs
- gateway config (`~/.llm-gateway/config.toml`)
- auth/token handling code

Double-check before pushing.
