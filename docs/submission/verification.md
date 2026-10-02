# CivicLens review and verification

Reviewed **October 1, 2026 (Pacific)**. Execution evidence uses UTC timestamps on October 2. This report replaces the archive's earlier uncredentialed verification; it does not claim contest submission, public deployment, or physical-phone acceptance.

## Executed checks

| Check | Result |
| --- | --- |
| Frozen dependency installation / Prisma generation | Passed with pinned pnpm 11.7.0 / Node 24 |
| Production build | Passed, including Prisma generation and all Next.js pages |
| TypeScript | Passed |
| ESLint | Passed: zero errors, seven warnings |
| Unit/component/contract suite | **165 passed across 30 files** |
| Production Playwright, pinned Chromium 149 | **54 passed**: 22 API/student/demo tests and 32 mobile tests at 390/430 px |
| Additional real-NIM browser journey | **1 passed**: visible provenance, information request, source excerpts, and working knowledge check |
| Route sweep | 24 route/viewport combinations; zero document overflow or page JavaScript exceptions |
| Required live NIM provider smoke | Passed; actual validated completion, false repeal claim contradicted, two citations |
| Required production judge rehearsal | Passed: real information response, real false-claim response, persuasion refusal, 32-lesson curriculum, source ownership, sample district, live Census |
| Android package | Compiled/dexed/aligned; APK v2/v3 signatures verified; manifest inspected |
| Git diff / credential scan | No whitespace errors; no supplied NIM key in source, APK, or browser static bundle |

The route sweep covered Home, Learn, Analyze, Bills, District, and Methodology at 390, 430, 768, and 1440 pixels with reduced motion. Screenshots were captured; representative mobile/desktop screens were visually inspected. Existing browser tests cover keyboard navigation, source-dialog Tab containment/Escape/focus restoration, lesson retry/unlock/persistence, duplicate-XP prevention, loading/error recovery, layout/touch targets, and bill slides. This is not a screen-reader certification or field performance audit.

The final suite used the managed Playwright Chromium, not only a system-browser override. A preceding system-Chromium run also passed all 54 tests. Production NIM browser analysis took about 27 seconds including rendering and the knowledge-check interaction. The final HTTP rehearsal's information request took 19.3 seconds and the false claim 10.9 seconds. Provider latency/output can vary; rehearse again before recording.

## Live evidence and limits

The supplied **server-side `NIM_API_KEY`** was recognized without requesting another credential. The previous default `meta/llama-3.1-8b-instruct` returned **HTTP 410**. Several catalog alternatives were unavailable for this account; an actual completion established that `meta/llama-3.2-11b-vision-instruct` worked, and it is now the default.

Early full analyses exceeded the old 12-second timeout and correctly fell back. NIM's default timeout is now 25 seconds inside a 30-second total analysis budget. After that correction, the required judge rehearsal passed against both development and the final production server. The live browser test additionally verified the result shown to the user.

Prepared inputs:

- `What did H.R. 82 of the 118th Congress change about Social Security?` returned `mode: live`, an information-request answer, and two citations.
- `H.R. 82 did not repeal the government pension offset or windfall elimination rules.` returned `mode: live`, a false assessment, and two citations.
- Campaign persuasion was refused without a model request.
- A real Census request for the public White House address returned **DC At-Large**, `source: live`, no echoed raw address/coordinates, and `memberSource: unavailable`.

**NIM was live; the bill evidence was curated historical context.** No Congress.gov key or PostgreSQL connection was configured. The bills smoke reported 12 fixture cards and zero live-enriched cards. Current representatives, live Congress.gov retrieval/enrichment, embeddings, persistence/migrations, and a public deployment were not validated. Health's top-level `mode: demo` reflects the absent database and does not contradict a successful individual `mode: live` analysis.

Source checks may substitute excerpts for unsupported model wording. Lexical scope/predicate checks are conservative heuristics, not semantic proof. The application should be presented as a learning and evidence tool, not an authoritative truth oracle.

## Review corrections

The archive's useful lesson-progress, explicit sample-district, privacy/database-contract, grounded-analysis, and source-dialog changes were integrated. Further review corrected:

- the unrecognized cloud `NIM_API_KEY` alias and retired default model;
- the informational answer being overwritten by a truth-assessment summary;
- scope/predicate grounding accepting unsupported “only” wording or “allows” instead of “requires”;
- provenance wording that called substituted source text an AI-generated explanation;
- source counts on three fallback bill cards;
- unit runs inheriting real judge/provider/database credentials;
- provider-smoke subprocess cleanup leaving Next servers/pipes alive;
- unnecessary external-server inference from a Playwright URL loaded out of a local dotenv file.

New helpers provide deterministic demo startup, live device startup, a required-live judge smoke, and a repeatable signed Android demo build. CI now preserves pipeline failure exit codes, exercises mobile tests against production, and builds an APK artifact. **Remote CI execution is not claimed by this local report.**

## Android boundary

The public demo APK is in `downloads/`, with SHA-256 beside it. Package `org.civiclens.app`, minimum Android 8/API 26, target API 35. It contains a Java/WebView shell and no NIM credentials. The self-signed demo key stays ignored outside the distributed source; this is not a Play Store release.

**No physical phone was attached and no Android emulator was run.** The 32 mobile browser tests emulate touch viewports; they are not native-device tests. Before recording, install the APK on the actual phone and verify keyboard/rotation/back, external source links, server retry, progress persistence, and allowed/denied location permission. USB use requires an active computer server and ADB reverse; independent use requires a hosted HTTPS server. See [Android instructions](../../android/README.md).

## Reproduce

Follow [TESTING.md](../../TESTING.md), [the agent runbook](../AGENT_SETUP.md), and [judge instructions](../JUDGES.md). Current-run logs, screenshots, and JSON evidence live under ignored `artifacts/review/`. Do not commit credentials or signing keys. Submission-answer personal/history/contribution placeholders and the public recording still need entrant completion.
