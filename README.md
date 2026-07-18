# CivicLens

CivicLens is a civic-literacy PWA for students. It runs locally in demo mode without paid API keys, and can use Congress.gov, Census Geocoder, PostgreSQL/pgvector, LLM, and embedding providers when environment variables are present.

## Features

- A short, cited civic-learning path with quizzes and progress feedback.
- Plain-language claim analysis grounded in official-source citations.
- A mobile-first bills browser with search and bill-detail timelines.
- Privacy-preserving district lookup for finding federal representatives.
- Deterministic demo fixtures when live providers or PostgreSQL are unavailable.
- Explicit methodology, evidence, and refusal behavior for politically sensitive requests.

## Guardrails

- No accounts, posting, comments, likes, follows, campaign targeting, video upload, or social-network features.
- No candidate recommendations, party recommendations, voting advice, persuasion copy, propaganda, or campaign strategy.
- Every factual AI claim about bills, representatives, votes, or government actions must be grounded in source citations.
- Raw addresses are never stored, logged, or sent to an LLM.
- Raw claim text is not stored by default. Store only hashes unless `STORE_ANALYSES=true`, and store redacted text only if `STORE_RAW_INPUTS=true`.

## Local Setup

```bash
pnpm install
cp .env.example .env
pnpm prisma generate
pnpm dev
```

Open `http://127.0.0.1:3000`.

## Verification

The integrated app is expected to pass:

```bash
pnpm install
pnpm prisma generate
pnpm build
pnpm test
pnpm test:e2e
pnpm test:mobile
pnpm smoke:providers # optional, requires live LLM provider env vars
```

Useful focused commands:

```bash
pnpm typecheck
pnpm lint
pnpm test:watch
pnpm test:e2e:ui
pnpm screenshots:mobile
```

## Asset Preparation

The normalized runtime images are committed under `public/assets/`. Maintainers can regenerate them from a local `incoming-assets/` directory with:

```bash
pnpm prepare-assets
```

The local source bundle and generation report are intentionally ignored. The script writes normalized assets to `public/assets/generated/` and refreshes the typed registry in `lib/asset-manifest.ts`.

## Split View Preview

Use `/preview` when you want code on one side and a phone-sized app preview on the other.

1. Start the dev server:

```bash
pnpm dev
```

2. Open [http://127.0.0.1:3000/preview](http://127.0.0.1:3000/preview).
3. Put the editor on the left side of the screen.
4. Put the browser on the right side. On desktop, `/preview` shows setup notes plus a live phone frame of the app. On an actual phone-sized viewport, it becomes the normal full-width app.
5. To inspect a specific route in the browser phone frame, use the in-app bottom nav or open the route directly in DevTools device mode.

For a real phone on the same Wi-Fi network:

```bash
pnpm dev -- --hostname 0.0.0.0 --port 3000
ipconfig
```

Use the IPv4 address from `ipconfig`, then open `http://YOUR_IPV4_ADDRESS:3000/preview` on the phone. Allow the Windows firewall prompt for Node.js if it appears.

## Mobile Preview And Testing

### Physical Android Phone (Primary Loop)

Install Android Platform Tools and scrcpy once on Windows, enable USB debugging on the phone, connect it by USB, and approve this computer. Then run:

```powershell
pnpm mobile:start
```

This starts CivicLens with Next.js Fast Refresh on port 3100, creates `adb reverse tcp:3100 tcp:3100`, opens `http://127.0.0.1:3100` in Android Chrome, and launches a separately visible scrcpy window named for CivicLens and the attached device. Keep the command running while editing; changes hot-reload on the phone. If several devices are attached, set `ANDROID_SERIAL` first.

From another terminal, capture an exact native-resolution ADB screenshot or run the physical UI audit:

```powershell
pnpm mobile:screenshot -- --screen home
pnpm mobile:check
```

Screenshots and timestamped JSON/Markdown reports are stored under `artifacts/mobile/`. `mobile:check` visits Home, Learn, Analyze, Bills, a bill detail, and District in the physical Android Chrome instance; it also captures keyboard states and reports overflow, clipping, bottom-nav overlap, nested scrolling, and undersized tap targets. The existing Playwright phone profiles remain useful secondary regression coverage, but they do not replace this physical-device loop.

One-time Winget setup, if needed:

```powershell
winget install --id Google.PlatformTools --exact --accept-package-agreements --accept-source-agreements
winget install --id Genymobile.scrcpy --exact --accept-package-agreements --accept-source-agreements
```

### Desktop Phone Emulation (Secondary)

Testing on a desktop phone emulator:

1. Run `pnpm dev`.
2. Run `pnpm test:mobile`.
3. Run `pnpm screenshots:mobile` to refresh ignored local screenshots under `artifacts/playwright-mobile/`.
4. Open Chrome DevTools and toggle the device toolbar with `Ctrl+Shift+M`.
5. Choose Pixel 7, iPhone 14, or a similar phone profile.
6. Open `http://127.0.0.1:3000/preview` for full-width mobile behavior, or open `/`, `/feed`, `/analyze`, `/bills`, and `/district` directly.

Testing on Android Studio emulator:

1. Install Android Studio.
2. Open Device Manager and create a Pixel virtual device.
3. Run:

```bash
pnpm dev -- --hostname 0.0.0.0
```

4. Start the emulator.
5. In Android emulator Chrome, open `http://10.0.2.2:3000/preview`.
6. Test PWA install from the Chrome menu if desired.

## Demo And Live Data

Demo mode should remain credible with fixtures when `DATABASE_URL`, `CONGRESS_API_KEY`, LLM, or embedding credentials are absent. Add live provider values in `.env` only when you want external calls.

For NVIDIA NIM analysis, set `NVIDIA_NIM_API_KEY`, optional `NVIDIA_NIM_BASE_URL`, and optional `NVIDIA_NIM_MODEL`. For Groq, set `GROQ_API_KEY` and optional `GROQ_MODEL`. For a generic OpenAI-compatible LLM endpoint, set `LLM_API_KEY` or `OPENAI_API_KEY`, optional `LLM_BASE_URL`, and optional `LLM_MODEL`. Configured keys are used automatically; set `ENABLE_NIM=false`, `ENABLE_GROQ=false`, or `ENABLE_LLM=false` only to force-disable a provider.

`pnpm smoke:providers` checks whichever live LLM provider is configured without printing secret values.

## Official Provider Endpoint Coverage

This section is a verification map. Congress/Census/LLM providers have live route behavior; the additional official-source providers are used by Analyze/Search as configured citation-discovery candidates and bounded live-fetch sources so students get the right official surface for claims about rules, courts, spending, campaign finance, records, and presidential actions. Fetchers are short-timeout and defensive, so they fall back to official search targets when a provider is unavailable or returns an unexpected shape.

| Provider | Official surface to verify | CivicLens expectation |
| --- | --- | --- |
| Congress.gov API v3 | Bill detail and related bill subresources needed for bill pages, search, citations, summaries, actions, sponsors, subjects, text, and any vote data exposed by the app. Reference: [Library of Congress Congress.gov API docs](https://github.com/LibraryOfCongress/api.congress.gov). | `CONGRESS_API_KEY` should enable server-side live civic data while local UI still calls CivicLens API routes only. Health/key detection is not enough evidence; verify a real route or ingestion path returns official-source citations before describing that endpoint family as live. |
| Census Geocoder | Geographies lookup from the Census Geocoder service, including current benchmark/vintage handling where required. Reference: [Census Geocoder Services API](https://geocoding.geo.census.gov/geocoder/Geocoding_Services_API.html). | District lookup must stay server-side, return state/district/member context or a fixture fallback, and must never store, log, or send raw addresses to an LLM. |
| GovInfo | Official publications, public laws, Congressional Record, and branch publications. | `GOVINFO_API_BASE`/`GOVINFO_API_KEY` make GovInfo available as an official citation-discovery candidate for relevant claims. |
| Federal Register, Regulations.gov, eCFR | Rulemaking documents, dockets/comments, and current federal regulatory text. | Configured base URLs/API keys make regulatory claims point to official rulemaking/search surfaces before the LLM answers. |
| NARA and CourtListener | Archival records/founding documents and court opinions/legal materials. | Configured endpoints add records and courts citation candidates for constitutional, archival, and judicial claims. |
| USAspending, OpenFEC, White House | Federal awards/spending, campaign finance disclosures, and presidential actions/remarks. | Configured endpoints add official citation candidates for spending, elections/campaign-finance, and presidential-action claims. |
| LLM providers | Configured OpenAI-compatible chat endpoint for NVIDIA NIM, Groq, or a generic provider. | Live LLM use must keep factual claims grounded in provided citations, reject persuasion/voting advice, and fall back to deterministic demo behavior when no provider is configured. |
| Embeddings | Configured embedding endpoint for source ingestion/search enhancement. | Embeddings may improve retrieval when configured, but demo/dev must still have a lexical or fixture fallback. Do not treat embedding availability as proof of answer quality without RAG/citation eval evidence. |

## Scripts

- `pnpm dev` starts the local Next.js app.
- `pnpm build` builds the app.
- `pnpm test` runs Vitest unit and contract tests.
- `pnpm test:e2e` runs Playwright student-flow checks.
- `pnpm ingest:congress`, `pnpm ingest:members`, and `pnpm ingest:votes` run civic-data ingestion scripts.
- `pnpm embed:sources` generates embeddings when a provider is configured.
- `pnpm smoke:providers` runs an optional live LLM provider smoke check against `/api/health` and `/api/analyze`.

## Privacy Notes

District lookup must geocode on the server and avoid storing or logging raw addresses. Analysis should hash raw claim text by default and only persist redacted text when explicitly enabled.
