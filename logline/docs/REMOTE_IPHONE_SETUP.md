# Remote iPhone Setup (PM2 + Cloudflare Tunnel)

This setup keeps `logline-daemon` private behind token auth and exposes it through your existing tunnel.

## 1. Start daemon with PM2
1. Edit token in:
   - `/Users/ubl-ops/UBLX App/logline/deploy/ecosystem.logline-daemon.cjs`
   - Set `LOGLINE_DAEMON_TOKEN` to a strong secret.
2. Start:
   ```bash
   /Users/ubl-ops/UBLX\ App/logline/scripts/start-logline-pm2.sh
   ```
3. Verify:
   ```bash
   pm2 logs logline-daemon --lines 50
   curl -i http://127.0.0.1:7613/v1/health
   ```

## 2. Add DNS route for the tunnel
Point a hostname to your existing tunnel:
```bash
cloudflared tunnel route dns vvz-core logline.voulezvous.tv
```

If you want a different hostname, update it in:
- `/Users/ubl-ops/UBLX App/logline/deploy/cloudflared.logline.yml`

## 3. Update tunnel ingress
Merge this rule into your active Cloudflare config (`~/.cloudflared/config.yml`) above the `http_status:404` fallback:
```yaml
- hostname: logline.voulezvous.tv
  service: http://127.0.0.1:7613
```

Then reload your existing PM2 cloudflared process:
```bash
pm2 restart ubl-cloudflared
```

## 4. Verify auth behavior
```bash
# public
curl -i https://logline.voulezvous.tv/v1/health

# should be 401
curl -i https://logline.voulezvous.tv/v1/status

# should be 200
curl -i https://logline.voulezvous.tv/v1/status \
  -H 'x-logline-token: <LOGLINE_DAEMON_TOKEN>'
```

## 5. Session token flow for iPhone app
1. Create short-lived session token (admin token required):
   ```bash
   curl -sS -X POST https://logline.voulezvous.tv/v1/auth/session/create \
     -H 'x-logline-token: <LOGLINE_DAEMON_TOKEN>' \
     -H 'content-type: application/json' \
     -d '{"ttl_seconds":3600,"label":"iphone"}'
   ```
2. Use returned `token` as `x-logline-token` from the iPhone client.
3. Revoke token when done:
   ```bash
   curl -sS -X POST https://logline.voulezvous.tv/v1/auth/session/revoke \
     -H 'x-logline-token: <LOGLINE_DAEMON_TOKEN>' \
     -H 'content-type: application/json' \
     -d '{"token":"<session-token>"}'
   ```

## Notes
- Health endpoint is intentionally public.
- All control endpoints require auth.
- Session tokens cannot call session-admin endpoints.
