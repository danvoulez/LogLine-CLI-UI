# Repository Split — February 28, 2026

This monorepo (`LogLine-CLI-UI`) has been split into two purpose-built repositories:

## logic.logline.world
**Core logic + CLI** — The single binary that is the ecosystem.

- Repository: https://github.com/danvoulez/logic.logline.world
- Contents: Rust workspace (crates), Supabase migrations, CI/CD config, ecosystem docs
- Binary: `logline-cli` — auth, deploy, cicd, db, secrets, app onboarding
- Security: macOS Keychain + Touch ID, no secrets on disk

## obs-api.logline.world
**Observability + API** — Dashboard that reads and displays data.

- Repository: https://github.com/danvoulez/obs-api.logline.world
- Contents: Next.js app, API routes (data readers only), UI components
- Auth: Supabase (same users/JWT as CLI)
- Persistence: Vercel Postgres (internal UI state only)

## Rules

1. `logic.logline.world` owns all business logic and infrastructure commands
2. `obs-api.logline.world` is read-only observability — API routes never make decisions
3. Supabase migrations live in `logic.logline.world/supabase/migrations/`
4. This monorepo is now archived
