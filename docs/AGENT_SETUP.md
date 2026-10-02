# Agent setup and runbook

Use the existing isolated cloud checkout; do not create a Git worktree unless requested. Inspect Git status, preserve user edits, and use Node 24+ with pinned pnpm 11.7.0. Run `pnpm setup`.

In this cloud, use `COREPACK_HOME=/workspace/.cache/corepack corepack pnpm` when activation is needed. The package store is `/workspace/.cache/pnpm-store`. Export `PLAYWRIGHT_BROWSERS_PATH=/workspace/.cache/ms-playwright` to use retained browsers. Configuration/snapshots do not preserve running processes.

## Startup

- Deterministic demo: `pnpm demo:build`, then `pnpm demo`.
- Live enabled providers: confirm a nonempty `NIM_API_KEY` or `NVIDIA_NIM_API_KEY` without displaying it; `pnpm build`, then `pnpm device`.
- Fast Refresh: `pnpm device:dev`.

Device helpers listen on all interfaces on port 3100; override `PORT` in the launching shell. A `.env.local` file can hold local server credentials and must remain ignored. Do not copy the archive's historical patch, dependency directories, or build output into Git.

The supplied cloud binding is `NIM_API_KEY`; do not request another key just because a different alias is unset. The working default is `meta/llama-3.2-11b-vision-instruct`; the old 3.1 8B model returned 410. Honor explicit user model overrides. NIM calls allow 25 seconds within the 30-second analysis budget; keep timeout/invalid-output fallbacks disclosed.

The device helper activates Node's environment proxy support when a proxy exists. Direct Next launches in cloud need `NODE_OPTIONS=--use-env-proxy`, preserving any required existing options. Keep loopback exempt via `NO_PROXY`. Do not disable TLS, checksum, or package verification.

`DEMO_MODE=true` alone does not disable providers; the demo helper uses explicit flags. Demo data, live AI, live official retrieval, and database persistence are independent. Health's `mode` describes the database, and `llmConfigured` proves only configuration. A real analysis response must be `mode=live` before reporting live success.

## Readiness

1. Run typecheck, lint, unit tests, and build.
2. Start production; require HTTP 200 `/api/health` with `ok:true`, and `/api/feed` with 32 lessons. Exercise a user flow.
3. Run `pnpm smoke:judge`, with `REQUIRE_LIVE_PROVIDERS=true` for live AI and `REQUIRE_LIVE_CENSUS=true` for real geocoding. Default server is port 3100; override `PROVIDER_SMOKE_BASE_URL`. Skips/fallbacks cannot pass required live checks.
4. Run production browser checks from [TESTING.md](../TESTING.md): learning/XP, retry, persistence, source-dialog keyboard behavior, errors, provenance, and both mobile widths.
5. Build/install the APK and test the same flows on the physical phone using [Android instructions](../android/README.md).

Avoid competing builds/servers against the same output. Stop only processes you started. Next regenerates `next-env.d.ts` when switching build/dev modes; preserve user edits and avoid committing incidental generated route-path changes. USB forwarding/server processes must restart in future tasks.

## Privacy and services

Never print environment/credential files, extract Git tokens, or copy keys into logs, docs, APKs, or Git. Reuse injected HTTPS Git authentication. Default raw-input/analysis storage stays disabled. Unit tests remove real credentials; separate live smoke checks establish provider operation. Use public building addresses and never store/log precise user location.

Required hosts: `integrate.api.nvidia.com` (NIM), `geocoding.geo.census.gov` (Census), `binaries.prisma.sh` (Prisma), `cdn.playwright.dev`, `storage.googleapis.com`, `playwright.download.prss.microsoft.com` (browser downloads), and `dl.google.com` (Android SDK). Preserve other known network entries. Network denial, invalid key, missing account function (404), retired model (410), timeout, and invalid JSON are different failures; diagnose first.

Existing ingestion utilities fetch/count records; embedding utilities probe an endpoint. They do not populate a complete retrieval database. PostgreSQL/pgvector operation is optional and remains separate from credential-free demo readiness.

## Handoff

Update [verification.md](submission/verification.md) from executed results. Separate cloud validation, physical-phone acceptance, public deployment, and contest submission. Keep participant/history/contribution placeholders truthful. Inspect the full diff and secret/signing-key exclusions before pushing; recheck the remote and never force-push. Only the public demo APK and SHA-256 belong in `downloads/`; private signing keys remain ignored.
