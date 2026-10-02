# CivicLens — documentation verification record

## Scope and evidence standard

The [demo script](CivicLens_Demo_Script.md) and [submission answers](CivicLens_Submission_Answers.md) were audited against the default-branch application at **`f61acd8f7080ee15193d812a54a9d83a48b89a6d`**, commit message **Fix deterministic CI behavior**. The reviewed tree was `dd9bc669e9864de00c0fbb2bd95300c6f977d366`.

Source links below are pinned to that application commit, so future application edits do not silently change the evidence. The README establishes stated scope; implementation takes precedence where a visible feature or limitation can be checked. `PRD.md`, earlier assistant descriptions, old verification reports, raw data fields that are not rendered, and screenshots of another build are **not** treated as proof of current functionality.

This is a documentation-only change. It does not repair application limitations, certify civic accuracy, establish student authorship, or prove live-provider operation.

## Verification performed and not performed

**Performed:** read the README, dependency/scripts configuration, relevant React components, API routes, model-provider selection and analysis paths, source-grounding and fixture definitions, and provider-smoke/Playwright configuration through GitHub. Read the three original submission-form screenshots directly. Check the new documents for complete recovered-field coverage, bounded answer lengths, internal references, and whitespace errors.

**Not performed:** an application build, dependency installation, unit tests, browser walkthrough, Playwright suite, physical-device audit, production deployment check, or live-provider smoke run in the authoring environment. A container clone attempt failed because `github.com` could not be resolved; source inspection continued through the connected GitHub tools. Repository CI, if triggered by the documentation pull request, is separate evidence and must be reported from its actual results.

No earlier claims of 162 unit tests, 54 browser tests, or a production-build walkthrough are carried forward as verification of this commit. No new cover image or video was captured. Rehearsal commands in the demo script are instructions to run, not recorded successes.

## Recovered question provenance

| Original screenshot | Reliably recovered fields |
| --- | --- |
| `Screenshot_20260929_185247.png` | App name; programming languages; platforms; public HTTPS demonstration-video link; app description; inspiration. |
| `Screenshot_20260929_185301.png` | Technical difficulties; version 2.0 improvements; AI-use selection; detailed AI/student-contribution disclosure; learning reflection; cover photo; optional project link. |
| `Screenshot_20260929_185313.png` | Coding location; completion date; school/club project selection; organization; teacher/mentor; mentor email; ambassador referral email; final readiness confirmation. |

The answer file contains **21 fields in the screenshot order**. Visible long-answer fields use a 400-word counter. The cover-photo instructions prefer JPEG and identify 600 × 800 pixels / 3:4 as ideal. These are recovered-form details, not a claim that a current public rules page was independently checked. Personal details, a published video, and a current-build cover image remain the applicant's responsibility. The screenshots are not added to the public repository.

## Claim-to-implementation map

### C01

**App identity, intended audience, platform, stack, and scope.**

The README calls CivicLens a civic-literacy PWA for students and describes lessons, analysis, bills, district lookup, and deterministic fixtures. `package.json` and the source establish TypeScript/JavaScript with Next.js, React, Tailwind CSS, and Zod, plus optional Prisma/PostgreSQL workflows. The form answer selects Web, not a native iOS/Android release. No app-store listing, adoption count, learning outcome, or deployed uptime is claimed.

**Sources:** [README](https://github.com/ShadowKingYT444/CivicLens/blob/f61acd8f7080ee15193d812a54a9d83a48b89a6d/README.md), [package.json](https://github.com/ShadowKingYT444/CivicLens/blob/f61acd8f7080ee15193d812a54a9d83a48b89a6d/package.json).

### C02

**Learning interaction, available question, and prototype state.**

`FeedBrowser` loads `/api/feed`, bounds loaded cards to 30 and visible path cards to 24, creates teaching cards with `buildLessonFlashcards`, and normalizes one `quiz`/`quizJson` object. The first stored concept is **Separation of Powers**; its quick check asks which branch has authority. The UI shows answer explanations and changes lesson/path state on completion.

Important boundaries: `starterProgressIndex` is 2, so the first two nodes can appear complete before a user earns anything. Completion and progress are in-memory React state in the mounted Learn view, without persistent storage in this component; no continuity across reloads or remounts is promised. `LearningHeader` hardcodes `12` and `2,450 XP`; the completion burst displays `+25 XP` without an earned-XP ledger. `canContinue` requires an answer selection, not a correct answer. Multiple `quizQuestions` in source data do not establish that all are rendered. The docs therefore omit claims about 32 accessible lessons, 96 interactive questions, three questions per lesson, saved mastery, earned streaks, mandatory retry, or a review queue.

**Sources:** [components/feed-browser.tsx — FeedBrowser, LearningHeader, LessonPlayer](https://github.com/ShadowKingYT444/CivicLens/blob/f61acd8f7080ee15193d812a54a9d83a48b89a6d/components/feed-browser.tsx), [data/concept-cards.json — separation-of-powers](https://github.com/ShadowKingYT444/CivicLens/blob/f61acd8f7080ee15193d812a54a9d83a48b89a6d/data/concept-cards.json).

### C03

**What Analyze actually displays.**

`AnalyzeClient` posts to `/api/analyze` and renders a **Plain-English answer**, **Fallback** or **Live AI**, an assessment or verdict when applicable, up to two citation links, and related bill links. `getTruthAssessment` labels informational questions **Information request** rather than assigning them a truth rating. The idle **AI ready** badge does not prove a successful model request. The current component does not render the quiz present in backend analysis JSON or a separate full evidence-excerpt panel.

**Source:** [components/analyze-client.tsx — AnalyzeClient, getTruthAssessment](https://github.com/ShadowKingYT444/CivicLens/blob/f61acd8f7080ee15193d812a54a9d83a48b89a6d/components/analyze-client.tsx).

### C04

**Analysis flow, generation/source distinction, and validation limits.**

`analyzeClaim` redacts sensitive retrieval input, retrieves sources, calls `generateAnalysis`, derives related bills, and returns separate generation `mode` and retrieval `sourceMode` values. `generateAnalysis` can invoke configured providers only with usable citations, without unresolved address risk, and when `!isInformationalQuestion(safeClaim)`. The demo's “What did H.R. 82…” input therefore uses the deterministic path even if credentials exist.

The provider path parses and validates structured output, may request repair, and falls back on failure. Presentation can be transformed with source excerpts and deterministic truth safeguards; `mode: "live"` does not mean all displayed prose is untouched model output. These checks and a valid citation identifier do not prove factual entailment or general answer correctness. Backend quiz generation does not establish a visible Analyze quiz.

**Sources:** [lib/ai/analyze-claim.ts — analyzeClaim](https://github.com/ShadowKingYT444/CivicLens/blob/f61acd8f7080ee15193d812a54a9d83a48b89a6d/lib/ai/analyze-claim.ts), [lib/ai/llm-client.ts — generateAnalysis, parseAndValidate, buildProviderPresentation, applyDeterministicTruthGuard, buildDeterministicAnalysis](https://github.com/ShadowKingYT444/CivicLens/blob/f61acd8f7080ee15193d812a54a9d83a48b89a6d/lib/ai/llm-client.ts).

### C05

**Provider support is conditional, not evidence of a working live connection.**

`selectLlmProviders` selects configured NIM, Groq, then generic OpenAI-compatible providers, honoring the corresponding `ENABLE_*` flag. A key can enable a provider even when an example environment contains `DEMO_MODE=true` or `LLM_PROVIDER=demo`; those names are not master switches in this selector. The recording explicitly disables all three provider families. No proprietary trained model, browser-local model, successful live API call, or live-source coverage percentage is claimed.

The README also describes optional embeddings and additional bounded official-source discovery/fetch adapters. These are not presented as complete coverage of every agency or proof that every result was fetched live. The core demo does not require a populated database or paid model credentials, but it is not described as fully offline.

**Sources:** [lib/ai/nim-client.ts — selectLlmProviders, providerEnabled, requestChatCompletion](https://github.com/ShadowKingYT444/CivicLens/blob/f61acd8f7080ee15193d812a54a9d83a48b89a6d/lib/ai/nim-client.ts), [.env.example](https://github.com/ShadowKingYT444/CivicLens/blob/f61acd8f7080ee15193d812a54a9d83a48b89a6d/.env.example), [README — Demo And Live Data; Official Provider Endpoint Coverage](https://github.com/ShadowKingYT444/CivicLens/blob/f61acd8f7080ee15193d812a54a9d83a48b89a6d/README.md).

### C06

**The prepared bill is a historical, identified record.**

`DEMO_BILL` identifies **H.R. 82, 118th Congress, Social Security Fairness Act of 2023**, and carries Congress.gov and GovInfo references. Its prepared actions include introduction on January 9, 2023 and enactment as Public Law 118-273 on January 5, 2025. The fixture detail also identifies that bill. The script uses `/bills/118/hr/82` and never calls it a newly introduced current bill. The prepared record is evidence of what the app demonstrates, not proof of a successful live Congress.gov request or a current individualized benefit calculation.

**Sources:** [lib/civic/source-grounder.ts — DEMO_BILL](https://github.com/ShadowKingYT444/CivicLens/blob/f61acd8f7080ee15193d812a54a9d83a48b89a6d/lib/civic/source-grounder.ts), [data/fixtures/bills/sample-bill-detail.json](https://github.com/ShadowKingYT444/CivicLens/blob/f61acd8f7080ee15193d812a54a9d83a48b89a6d/data/fixtures/bills/sample-bill-detail.json).

### C07

**Bill-detail controls and visible content.**

`BillDetailView` requests the Congress/type/number route and renders the record identifier, readable summary, **Why it matters**, **Who is affected**, **What changes**, **Official summary**, source controls, and up to six date-sorted **Official actions**. The script shows those controls. It does not claim the detail UI displays sponsors merely because an API object includes them, or that fixture/demo votes constitute verified roll-call evidence.

**Source:** [components/bill-detail-view.tsx — BillDetailView](https://github.com/ShadowKingYT444/CivicLens/blob/f61acd8f7080ee15193d812a54a9d83a48b89a6d/components/bill-detail-view.tsx). Basic browser/search scope is also documented in the [README](https://github.com/ShadowKingYT444/CivicLens/blob/f61acd8f7080ee15193d812a54a9d83a48b89a6d/README.md).

### C08

**District input, live route, and unsafe sample substitution boundary.**

`DistrictLookup` accepts an address or browser-geolocation coordinates, posts to `/api/district/lookup`, clears the address input after a response, and displays district/member cards. The route tries Census unless `CENSUS_GEOCODER_ENABLED` or `CENSUS_GEOCODER_LIVE` is exactly `false`. It uses Congress member endpoints when configured and falls back to fixture members otherwise. A disabled or failed Census request can return `demoDistrictLookup()` with `status: "demo"`.

Crucially, `fixtureMembers` can return sample members even when the requested state/district has no corresponding fixture match. This can happen after a Census match, so `status: "matched"` alone does not verify member identities. The UI does not display the API's demo status, provide an **Explore a sample district** button, or show a dated-snapshot notice. It labels returned cards **Your Representatives** regardless of source. The script forces demo mode for this route and requires an **editor-added** sample caption before showing results; it never presents those names as verified representatives for the entered address. Fixing this is proposed for version 2.0, not claimed as implemented.

**Sources:** [components/district-lookup.tsx — DistrictLookup](https://github.com/ShadowKingYT444/CivicLens/blob/f61acd8f7080ee15193d812a54a9d83a48b89a6d/components/district-lookup.tsx), [app/api/district/lookup/route.ts — POST, tryCensusLookup, fetchCongressMembers, fixtureMembers, demoDistrictLookup](https://github.com/ShadowKingYT444/CivicLens/blob/f61acd8f7080ee15193d812a54a9d83a48b89a6d/app/api/district/lookup/route.ts).

### C09

**Privacy statements are bounded to the inspected application code.**

The District route forwards lookup information to Census on the server; it contains no address database write or LLM call. The raw address is part of the Census request, and a matched address/coordinates can appear in the API response. “Server-side” therefore does not mean “never leaves the device.” The README prohibits storing or logging addresses, but this review is not an audit of hosting logs, external services, browser behavior, or every deployment configuration.

In `/api/analyze`, `STORE_ANALYSES` must equal `true` before an analysis record is stored. When enabled and a database is available, storage includes a claim hash, projected result data, and citations. A redacted input field is included only with `STORE_RAW_INPUTS=true`. The default is no analysis persistence, not a claim that the application never processes any data or always stores only a hash. The analysis pipeline redacts sensitive input before retrieval/model processing; no general redaction-perfectness guarantee is made.

**Sources:** [District route](https://github.com/ShadowKingYT444/CivicLens/blob/f61acd8f7080ee15193d812a54a9d83a48b89a6d/app/api/district/lookup/route.ts), [app/api/analyze/route.ts — storeAnalysisIfEnabled](https://github.com/ShadowKingYT444/CivicLens/blob/f61acd8f7080ee15193d812a54a9d83a48b89a6d/app/api/analyze/route.ts), [lib/ai/analyze-claim.ts](https://github.com/ShadowKingYT444/CivicLens/blob/f61acd8f7080ee15193d812a54a9d83a48b89a6d/lib/ai/analyze-claim.ts), [README — Guardrails; Privacy Notes](https://github.com/ShadowKingYT444/CivicLens/blob/f61acd8f7080ee15193d812a54a9d83a48b89a6d/README.md).

### C10

**Unverified personal history and future features are not product facts.**

The screenshots ask about inspiration, personal technical work, lessons learned, AI assistance, location, dates, and affiliations. Source code cannot establish those answers. Candidate reflections are explicitly marked for student confirmation, and unsupported personal facts remain placeholders. ChatGPT's assistance in this documentation task is disclosed; prior use of Codex, other agents, generated assets, or other tools must be confirmed rather than inferred from earlier assistant-written drafts.

The proposed persistent progress system, stronger district provenance, evaluated factual support, and learning study are clearly future work. There is no claim of a classroom pilot, measurable learning gains, a teacher dashboard, a native mobile release, or student-authored components not identified by the student.

**Sources:** directly inspected form screenshots listed above; this documentation task establishes the current assistance. Current product limitations are mapped in C02, C04, and C08.

### C11

**Verification commands and success criteria.**

The manifest requires Node `>=24.0.0` and pnpm `>=11.0.0`. Its `verify` script runs typecheck, lint, build, unit/contract tests, and desktop e2e tests. Mobile and live-provider smoke commands are separate. The checked-in Playwright configuration starts or reuses a **development** server by default; running that configuration is not automatically production-build verification.

`smoke-real-providers.mjs` can use `PROVIDER_SMOKE_BASE_URL` or `PLAYWRIGHT_BASE_URL`; absent an external URL, it starts its own server. It uses the declarative H.R. 82 repeal claim, requires `mode: "live"`, citations and response-contract checks, and rejects deterministic fallback. **No configured provider causes an exit-zero skip.** Only the explicit successful integration result supports a live-provider claim, and even that is limited to the tested integration tiers. Key detection or `/api/health` alone is insufficient.

**Sources:** [package.json — engines, scripts](https://github.com/ShadowKingYT444/CivicLens/blob/f61acd8f7080ee15193d812a54a9d83a48b89a6d/package.json), [playwright.config.ts — webServer, projects](https://github.com/ShadowKingYT444/CivicLens/blob/f61acd8f7080ee15193d812a54a9d83a48b89a6d/playwright.config.ts), [scripts/smoke-real-providers.mjs](https://github.com/ShadowKingYT444/CivicLens/blob/f61acd8f7080ee15193d812a54a9d83a48b89a6d/scripts/smoke-real-providers.mjs), [README — Verification](https://github.com/ShadowKingYT444/CivicLens/blob/f61acd8f7080ee15193d812a54a9d83a48b89a6d/README.md).

### C12

**Educational purpose and refusal boundaries.**

The README explicitly excludes accounts, social posting, campaign targeting, candidate/party recommendations, voting advice, and campaign persuasion/strategy. The analysis code calls a persuasion/voting-advice detector and returns a refusal for detected requests. Documentation describes the educational purpose and implemented guard, not a guarantee of perfectly neutral output or an infallible classifier. It never presents CivicLens as a source of personalized voting instructions.

**Sources:** [README — Guardrails](https://github.com/ShadowKingYT444/CivicLens/blob/f61acd8f7080ee15193d812a54a9d83a48b89a6d/README.md), [lib/ai/llm-client.ts — getRefusalReason, generateAnalysis](https://github.com/ShadowKingYT444/CivicLens/blob/f61acd8f7080ee15193d812a54a9d83a48b89a6d/lib/ai/llm-client.ts).

## Changes required if application behavior changes

Re-audit the script and answers whenever lesson persistence, completion rules, generation routing, source provenance, representative fallback, or privacy storage changes. Update the pinned application revision and distinguish newly executed verification from old reports. Keep personal claims and media fields under the applicant's review; do not turn a successful code commit into an assertion that the competition entry is ready or submitted.
