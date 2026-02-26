# logline (v1 scaffold)

CLI-first architecture scaffold with runtime as source of truth.

## Crates
- `logline-api`: shared models + trait contracts
- `logline-auth`: JWT/JWKS verification + tenant/cookie helpers
- `logline-core`: domain policy + catalog validation
- `logline-connectors`: connector implementations/factory
- `logline-runtime`: runtime engine orchestration
- `logline-cli`: operator CLI
- `logline-daemon`: daemon process scaffold for remote UI

## Quickstart
```bash
cargo run -p logline-cli -- init
cargo run -p logline-cli -- status
cargo run -p logline-cli -- --json run --intent sync --arg source=iphone
LOGLINE_DAEMON_URL=https://api.logline.world LOGLINE_DAEMON_TOKEN=dev-token \
cargo run -p logline-cli -- auth whoami
LOGLINE_DAEMON_TOKEN=dev-token cargo run -p logline-daemon -- --host 127.0.0.1 --port 7600
LOGLINE_JWKS_URL=https://issuer.example/.well-known/jwks.json \
LOGLINE_JWT_ISSUER=https://issuer.example/ \
LOGLINE_JWT_AUDIENCE=logline-api \
cargo run -p logline-daemon -- --host 127.0.0.1 --port 7600
```

## Notes
- CLI/daemon load `connections.toml` from `~/.config/logline` by default.
- If config files are missing, they fall back to an in-code demo catalog.
- Daemon routes currently available:
  - `GET /v1/health`
  - `GET /v1/status`
  - `GET /v1/events?since=<cursor>`
  - `POST /v1/intents/run`
  - `POST /v1/intents/stop`
  - `POST /v1/backends/test`
  - `POST /v1/profiles/select`
  - `GET /v1/auth/whoami`
  - `POST /v1/auth/session/create` (admin/bootstrap token required)
  - `POST /v1/auth/session/revoke` (admin/bootstrap token required)
  - `GET /v1/auth/session/list` (admin/bootstrap token required)
- Auth:
  - `/v1/health` is public.
  - All other routes require `x-logline-token: <token>` or `Authorization: Bearer <token>`.
  - Token auth: set via `--token` or `LOGLINE_DAEMON_TOKEN`.
  - JWT auth: set JWKS via `--jwks-url` or `LOGLINE_JWKS_URL` and optionally issuer/audience via `LOGLINE_JWT_ISSUER` and `LOGLINE_JWT_AUDIENCE`.
  - Session tokens:
    - Create short-lived session token for mobile/UI.
    - Session token can call protected runtime routes.
    - Session token cannot mint/revoke other session tokens.
  - `GET /v1/auth/whoami` reports how the current token was authenticated (`bootstrap_token`, `session_token`, or `jwt`) and returns token metadata/claims.
  - Admin auth routes remain bootstrap-token only (JWT cannot mint/revoke/list sessions).
  - CLI helper:
    - `logline auth whoami --daemon-url <url> --token <token>`
    - Or set `LOGLINE_DAEMON_URL` and `LOGLINE_DAEMON_TOKEN`.
