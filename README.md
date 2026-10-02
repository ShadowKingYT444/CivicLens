# CivicLens

CivicLens helps students learn how government works, read bills, and check civic claims against cited sources. It is a mobile-first Next.js app with an installable, server-connected Android client.

**Judges:** see [the judging guide](docs/JUDGES.md), [the three-minute demo script](docs/submission/demo-script.md), and [the verification report](docs/submission/verification.md).

## Try the demo

Install **Node.js 24+** and **pnpm 11.7.0**, then run:

```sh
pnpm setup
pnpm demo:build
pnpm demo
```

Open `http://localhost:3100`. Demo commands explicitly disable live providers, databases, address lookup, and analysis storage even if keys exist in your shell. Choose **Explore a sample district** for the prepared district example. Learning progress belongs to the current device/browser.

## Live NVIDIA NIM

Keep `NIM_API_KEY` (or `NVIDIA_NIM_API_KEY`) in the **server environment** or an ignored `.env.local`. Never put it in browser code, an APK, screenshots, or Git. The default model is `meta/llama-3.2-11b-vision-instruct`; override with `NVIDIA_NIM_MODEL`. The previous Llama 3.1 8B default returned HTTP 410 during this review.

```sh
pnpm build
pnpm device
```

Open `http://localhost:3100`. This uses enabled server credentials and honors cloud HTTP/HTTPS proxies. A live explanation may take 10–25 seconds. Provider timeout or invalid output produces a labeled template fallback.

In another terminal, require a real live rehearsal:

```sh
# macOS/Linux
REQUIRE_LIVE_PROVIDERS=true pnpm smoke:judge
```

```powershell
# Windows PowerShell
$env:REQUIRE_LIVE_PROVIDERS = "true"
pnpm smoke:judge
```

This fails if analysis silently falls back. It tests a question, a false claim, refusal, citations, the curriculum, and sample district. Add `REQUIRE_LIVE_CENSUS=true` to test public-building geocoding. `pnpm smoke:providers` can start its own temporary test server. Set `PROVIDER_SMOKE_BASE_URL` for an existing deployment.

## Android

Install [CivicLens-demo.apk](downloads/CivicLens-demo.apk) on **Android 8+**. It is a demo-signed WebView client, not an offline AI app or Play Store release. It contains no API keys.

With Android Platform Tools, USB debugging enabled, and the computer authorized:

```sh
pnpm device
# In a second terminal:
adb reverse tcp:3100 tcp:3100
adb install -r downloads/CivicLens-demo.apk
```

Open CivicLens on the phone and choose **Use USB demo**. Keep the computer/server and USB connection running. To use the phone independently, deploy the Next.js server with HTTPS and enter that root URL in the APK's **Server** settings.

See [Android build/device instructions](android/README.md) and [the agent runbook](docs/AGENT_SETUP.md). A browser on the same Wi-Fi network can also use `http://YOUR_COMPUTER_IP:3100`; local HTTP location permission may be unavailable, so enter a public address or use the sample. The APK permits cleartext only to USB/emulator loopback hosts.

## Interpret the data

| Feature | Credential-free demo | Optional live behavior |
| --- | --- | --- |
| Learn | 32 lessons, 96 application questions, earned XP and local progress | Optional database-backed content |
| Analyze | Template explanations with curated citations | Validated NIM/Groq/OpenAI-compatible responses checked against source excerpts |
| Bills | Dated historical fixtures with citations | Congress.gov records with `CONGRESS_API_KEY` |
| District | Explicit saved CA-11 sample | Census district verification; current members additionally require Congress.gov |

Live AI may use **curated historical context**; that does not prove freshly fetched bill data. Health's top-level `mode` describes database availability. Check the individual analysis's `mode` and source labels. Model/lexical checks are conservative heuristics, not guarantees of factual correctness. Read the sources.

## Develop and verify

```sh
pnpm dev
pnpm typecheck
pnpm lint
pnpm test
pnpm build
pnpm exec playwright install --with-deps chromium
pnpm test:e2e
pnpm test:mobile
```

See [TESTING.md](TESTING.md) for production browser/live checks. `pnpm device:dev` provides Fast Refresh on port 3100. Existing `mobile:start`, `mobile:screenshot`, and `mobile:check` commands require an attached Android device and ADB/scrcpy.

Optional database/provider settings are in [.env.example](.env.example). Current ingestion commands **fetch/count records**; `embed:sources` probes embeddings. They do not populate a complete retrieval database. Asset preparation intentionally rewrites committed assets; do not run it for routine setup.

Raw addresses are not saved, logged, or sent to an LLM. Raw analysis storage is disabled by default. The app does not provide candidate recommendations, voting advice, campaigning, or social posting. Use public addresses in rehearsals and disclose generated explanations and sample data.
