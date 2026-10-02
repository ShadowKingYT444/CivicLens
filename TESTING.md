# Verification

## Deterministic checks

```sh
pnpm setup
pnpm typecheck
pnpm lint
pnpm test
pnpm demo:build
pnpm demo
```

Unit tests remove real provider/database credentials and inject explicit mocks. They do not count as live API evidence. Lint currently has warnings and no errors.

In another terminal:

```sh
pnpm exec playwright install --with-deps chromium
# macOS/Linux, using the running production server:
PLAYWRIGHT_BASE_URL=http://127.0.0.1:3100 PORT=3100 \
  pnpm exec playwright test tests/e2e tests/mobile-ui.spec.ts \
  --project=chromium --project=mobile-390 --project=mobile-430
```

```powershell
$env:PLAYWRIGHT_BASE_URL = "http://127.0.0.1:3100"
$env:PORT = "3100"
pnpm exec playwright test tests/e2e tests/mobile-ui.spec.ts --project=chromium --project=mobile-390 --project=mobile-430
```

Do not set `CI` when reusing a local server: CI intentionally starts its own. Without an existing server, Playwright starts `pnpm dev`. Interception is used only for explicit fixture/loading/failure tests; earned-learning journeys use the actual API and quiz interactions.

## Live checks

Keep the key only in the server environment; run `pnpm build`, then `pnpm device`.

```sh
REQUIRE_LIVE_PROVIDERS=true REQUIRE_LIVE_CENSUS=true pnpm smoke:judge
REQUIRE_LIVE_PROVIDERS=true pnpm smoke:providers
```

In PowerShell, set variables with `$env:NAME = "true"`. Use `PROVIDER_SMOKE_BASE_URL` for a remote/alternate-port server. `smoke:judge` requires a running server and defaults to port 3100. `smoke:providers` starts/stops its own temporary server unless an external URL is explicitly supplied. The judge report is ignored at `artifacts/review/judge-smoke.json`.

A missing provider, invalid completion, or template fallback fails a required live check. Without `REQUIRE_LIVE_PROVIDERS=true`, a demo run does not prove live AI. Live NIM with curated citations is different from freshly fetched Congress.gov data. Census geocoding is different from current representative names. Rehearse immediately before recording because provider availability/latency/output can vary.

See [Android instructions](android/README.md) for package and physical-device acceptance. Inspect current-run artifacts; do not commit credential files, signing keys, or generated reports.
