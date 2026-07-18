Build it as a web app / PWA → deploy it to Vercel → record a clean demo video → submit the live link, video link, and GitHub/source access if requested.

Publishing to Google Play is optional and probably a distraction unless you have extra time.

For local development and testing, install these:

Required:

Node.js LTS
Needed to run Next.js, TypeScript, Tailwind, Prisma, scripts, and tests.
pnpm
Package manager. You can use npm, but the PRD assumes pnpm.
Git
Needed for version control and GitHub submission/source access.
VS Code or another code editor
Not strictly required, but practically necessary.
PostgreSQL with pgvector, or use Supabase/Neon
The app’s serious technical layer uses Postgres plus vector search. Easiest options:
Use Supabase or Neon hosted Postgres.
Or install Docker Desktop and run Postgres/pgvector locally.
Or install Postgres locally, but that is usually more annoying.
A browser: Chrome recommended
Needed for local testing, mobile emulation, Lighthouse, and PWA testing.

Strongly recommended:

Docker Desktop
This is the easiest way to run Postgres + pgvector locally without fighting your OS. It also makes your project more reproducible.

Playwright browsers
For E2E testing. Usually installed with:

pnpm exec playwright install
Congress.gov API key
Not software, but needed for live bill/member data. Your app should still work in demo mode without it.
LLM API key
Needed for live AI explanations. Again, demo mode should still work without it.
OBS, Loom, Screen Studio, or QuickTime screen recording
Needed to make the CAC demo video. Since CAC says the demo video is the most critical submission component, this matters more than Play Store polish.

For deployment/demo, use:

Vercel for the Next.js app.
Supabase or Neon for Postgres.
YouTube or Vimeo for the public demo video. CAC specifically says the completed video must be uploaded to YouTube or Vimeo and set to public.

Google Play is more complicated. You cannot “just publish” a Next.js app to Google Play directly. You would need to make it a PWA, host it live, wrap it into an Android app bundle using a Trusted Web Activity tool such as Bubblewrap, manage signing keys, and upload the Android bundle to Play Console. Google’s own PWA-to-Play codelab says you need a live PWA, Bubblewrap CLI, a Google Play developer account, a signing key, and an Android/ChromeOS test device.

Also, Google Play Console has friction. You must be at least 18 to create a Play Console developer account, and there is a US$25 one-time registration fee. Google also says personal developer accounts created after November 13, 2023 must meet testing requirements before making an app available on Google Play. New personal accounts must run a closed test with at least 12 testers opted in for 14 continuous days before applying for production access.

So if you are under 18, publishing under your own Play Console account is not available. You would need an eligible adult or organization account, which introduces ownership and logistics issues. For CAC, that is not worth it unless your app specifically needs native Android distribution.

My recommendation:

Do not publish to Google Play for the first CAC submission. Build a polished PWA and deploy it publicly. Make sure it works beautifully on phone screens. Add an installable PWA manifest so it can be “added to home screen.” That gives you the mobile-app feel without Play Store overhead.

Your demo/testing setup should be:

# local
Node.js LTS
pnpm
Git
Docker Desktop or hosted Postgres
Chrome
VS Code

# project setup
pnpm install
pnpm db:generate
pnpm db:migrate
pnpm seed:concepts
pnpm reset:demo
pnpm dev

# testing
pnpm test
pnpm exec playwright install
pnpm test:e2e
pnpm build

Then deploy:

Vercel app
Supabase/Neon Postgres
Congress.gov API key
LLM API key

Final submission/demo stack:

Live app URL: record the verified deployment in the CivicLens Linear release ticket
Public demo video: YouTube/Vimeo
Source code: GitHub repo, private or public depending on comfort
Demo fallback: seeded data mode in case APIs fail

## CivicLens QA Commands

```bash
pnpm test
pnpm test:e2e
pnpm test:mobile
pnpm screenshots:mobile
```

Mobile screenshots are generated locally under `artifacts/playwright-mobile/` and are intentionally not committed.

## Split View And Phone Preview

For the code-left, phone-right development setup:

1. Run `pnpm dev`.
2. Open `http://127.0.0.1:3000/preview`.
3. Snap the editor to one side of the desktop.
4. Snap the browser to the other side. Desktop `/preview` shows setup notes and a live phone frame. A mobile-width `/preview` remains full-width and uses the normal bottom nav.

For Chrome mobile emulation:

1. Open DevTools.
2. Toggle the device toolbar with `Ctrl+Shift+M`.
3. Select Pixel 7, iPhone 14, or a similar device.
4. Test `/preview`, `/`, `/feed`, `/analyze`, `/bills`, and `/district`.
5. Run `pnpm test:mobile` to verify the automated mobile projects and bottom nav labels: Home, Learn, Analyze, Bills, District.

For Android Studio emulator:

1. Install Android Studio and create a Pixel virtual device in Device Manager.
2. Run `pnpm dev -- --hostname 0.0.0.0 --port 3000`.
3. Start the emulator.
4. In emulator Chrome, open `http://10.0.2.2:3000/preview`.
5. Use the emulator Chrome menu to test PWA install if needed.

Optional live-provider smoke:

```bash
pnpm smoke:providers
```

The smoke command skips when no live LLM provider env vars are present. With provider env vars, it checks `/api/health` and `/api/analyze`, requires `mode=live`, verifies citations are returned, rejects deterministic fallback warnings, and prints only provider family plus status counts. It does not print API keys or raw secret values.

For NVIDIA NIM:

```bash
NVIDIA_NIM_API_KEY=...
NVIDIA_NIM_MODEL=meta/llama-3.1-70b-instruct
```

For Groq:

```bash
GROQ_API_KEY=...
GROQ_MODEL=llama-3.3-70b-versatile
```

Configured keys are used automatically. Set `ENABLE_NIM=false`, `ENABLE_GROQ=false`, or `ENABLE_LLM=false` only when a configured provider should be force-disabled for a run.

## Official Provider Verification Expectations

Provider checks should prove the exact route family exercised. A passing build, `/api/health`, or a skipped smoke test does not by itself prove that a live official endpoint is productized.

- Demo fallback: with provider secrets omitted, run the normal test suite and confirm core flows return fixture-backed data without crashing.
- Congress.gov: with `CONGRESS_API_KEY` set, verify `/api/health` reports the key as configured, then exercise at least one real bill/detail or ingestion path that reaches the official API and returns source citations. Record which endpoint family was exercised, such as bill detail, summaries, actions, subjects, text, members, or votes. Do not claim vote/member coverage unless that exact path was checked.
- Census Geocoder: use a non-sensitive test address against `POST /api/district/lookup`; confirm state/district output, fixture fallback behavior when unavailable, and absence of raw address text in logs, persisted records, screenshots, or LLM inputs.
- LLM providers: run `pnpm smoke:providers` only with intentional live provider env vars. Treat it as provider reachability and citation-contract evidence, not as a full product-quality eval.
- Official-source discovery providers: with the relevant env family configured, run `pnpm test -- tests/unit/official-source-connectors.test.ts tests/unit/source-grounder-official-providers.test.ts` and verify Analyze/Search retrieval includes the expected official citation candidate. For live fetch coverage, use a non-sensitive query against a public provider such as Federal Register or eCFR and confirm the returned citation title/excerpt came from the provider response. Set `OFFICIAL_SOURCE_LIVE=false` to force deterministic target-only behavior in tests.
- Embeddings: verify ingestion/search behavior separately from chat completion. If embedding provider env vars are absent, confirm lexical/demo retrieval remains usable.

For final evidence, report commands run, provider env families configured without secret values, skipped live checks, failed attempts, endpoint families actually exercised, and remaining risks.
