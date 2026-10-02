# CivicLens — Congressional App Challenge demo script

**Recording target:** approximately 2 minutes 50 seconds, including titles. This is an editorial target, not a certification of the current competition rules.

**Reviewed application:** `ShadowKingYT444/CivicLens`, commit `f61acd8f7080ee15193d812a54a9d83a48b89a6d` (`Fix deterministic CI behavior`). Rehearse again if application code changes.

**Story:** learn a civic concept, investigate a question, inspect a legislative record, and understand how district lookup handles information. Show the implemented web app, not proposed features.

The spoken script is separate from operator directions. Replace participant placeholders before recording. Product claims are traced in the [documentation verification record](CivicLens_Documentation_Verification.md); the [submission answers](CivicLens_Submission_Answers.md) contain the recovered application questions.

## Prepare the recording

### 1. Start a deliberate demonstration configuration

Use an isolated checkout/configuration with **Node.js 24 or newer and pnpm 11 or newer**, as specified by `package.json`. Follow the README setup:

```bash
pnpm install --frozen-lockfile
# Fresh checkout only: do not overwrite an existing .env.
cp .env.example .env
pnpm prisma generate
```

Keep credentials empty in this recording configuration, including any `.env.local` overrides. Do not display or commit environment files. In a POSIX shell, start the app with these explicit overrides:

```bash
DEMO_MODE=true DATABASE_URL= DIRECT_URL= CONGRESS_API_KEY= \
ENABLE_NIM=false ENABLE_GROQ=false ENABLE_LLM=false \
CENSUS_GEOCODER_ENABLED=false CENSUS_GEOCODER_LIVE=false \
STORE_ANALYSES=false STORE_RAW_INPUTS=false \
pnpm dev --hostname 127.0.0.1 --port 3000
```

Open `http://127.0.0.1:3000`. These overrides disable the model providers and force the District route to its sample response. They are **not an offline mode**: source links, images, and other retrieval paths can still involve network requests. `DEMO_MODE=true` alone is not a universal provider-disable switch. The normal District implementation otherwise tries Census even without a paid key. [C05](CivicLens_Documentation_Verification.md#c05), [C08](CivicLens_Documentation_Verification.md#c08), [C11](CivicLens_Documentation_Verification.md#c11)

### 2. Rehearse the exact inputs

| Surface | Input or action | Expected behavior to confirm before recording |
| --- | --- | --- |
| Learn, `/feed` | Open **Level 1: Separation of Powers**; use **Continue lesson** until **Quick check**; select **Which branch has authority?** | Correct-answer feedback appears. **Complete lesson** returns to the path after the completion animation. Do not describe the path's initial checkmarks as your accomplishments. |
| Analyze, `/analyze` | **What did H.R. 82 of the 118th Congress change about Social Security?** | A **Plain-English answer**, **Fallback** badge, **Information request** assessment, source links, and a related H.R. 82 link. Stop and investigate if the sources or bill identity do not match. |
| Bill detail | Open `/bills/118/hr/82` | The historical H.R. 82 record, readable sections, sources, and **Official actions**. Open **Sources** or **Open source drawer** to inspect references. |
| District, `/district` | Enter the repository's example input, **1600 Pennsylvania Ave NW, Washington, DC**, and press **Look up district** | With Census disabled as above, the server returns `status: "demo"`. This is sample data, **not a match to the address**. Keep the editor-added sample caption visible. |

For a server-side preflight in a separate terminal:

```bash
curl --fail-with-body --silent --show-error \
  http://127.0.0.1:3000/api/analyze \
  -H 'Content-Type: application/json' \
  --data '{"claim":"What did H.R. 82 of the 118th Congress change about Social Security?"}'

curl --fail-with-body --silent --show-error \
  http://127.0.0.1:3000/api/district/lookup \
  -H 'Content-Type: application/json' \
  --data '{"address":"1600 Pennsylvania Ave NW, Washington, DC"}'
```

Check Analyze's `mode`, `sourceMode`, citations, and related bill identifiers separately. The prepared question should use generation `mode: "demo"`; the District request must return `status: "demo"` for this script. A successful HTTP response alone is insufficient. The example address comes from the app's placeholder; no personal address or device location is needed. These commands are rehearsal instructions, not results of a test run performed while writing this document. [C03](CivicLens_Documentation_Verification.md#c03), [C04](CivicLens_Documentation_Verification.md#c04), [C06](CivicLens_Documentation_Verification.md#c06), [C08](CivicLens_Documentation_Verification.md#c08)

### 3. Set up an honest screen capture

Use a readable desktop or phone-sized browser view, hide notifications, and keep source text legible. Introduce every actual participant; do not invent teammates or credit student work that has not been confirmed.

Add these **editorial captions**, which are not claimed to be built-in UI:

- During Learn, including the completion animation: **“Prototype XP/streak display · lesson progress lasts only in this session.”** The header's `12` streak and `2,450 XP`, and the `+25 XP` animation, are not a working earned-progress ledger.
- Before submitting District and throughout its result: **“Sample district/representatives · not a verified lookup for this address.”** The current UI does not expose the server's demo status and may otherwise look like a real lookup.

Do not crop away the Analyze **Fallback** badge. Trim waiting or reading pauses, not failed requests into apparent successes. Do not inject browser state, fabricate responses, or replace the running interface with a generated mockup. [C02](CivicLens_Documentation_Verification.md#c02), [C03](CivicLens_Documentation_Verification.md#c03), [C08](CivicLens_Documentation_Verification.md#c08)

## Timed script and shot list

### 0:00–0:20 — A question worth investigating

**Screen:** Open the homepage with the CivicLens name visible, then choose Learn. Title card: **CivicLens — learn, investigate, check the source**.

**Say:**

> I'm [full name; introduce every registered teammate]. This is CivicLens, a web app for students learning how government works. Its goal is to turn a confusing civic claim into something a student can investigate. I'm showing the demonstration configuration, beginning with a lesson and then following a question back to its sources.

**Evidence:** [C01](CivicLens_Documentation_Verification.md#c01).

### 0:20–0:55 — Learn an idea, then apply it

**Screen:** At `/feed`, open **Level 1: Separation of Powers**, rather than assuming the initially selected lesson is the first. Advance through the teaching cards. Choose **Which branch has authority?**, pause on the explanation, and press **Complete lesson**. Keep the prototype-progress caption visible.

**Say:**

> Here, Separation of Powers asks a practical question: which branch has authority? I read the teaching cards, choose an answer, and get an explanation. Completing the lesson changes the path during this session. The XP and streak figures are prototype displays, not measured learning or saved achievements.

**Evidence:** [C02](CivicLens_Documentation_Verification.md#c02). The current player presents one normalized quick-check question; it does not enforce a correct answer before completion.

### 0:55–1:35 — Ask, then inspect the evidence

**Screen:** Open Analyze and enter **What did H.R. 82 of the 118th Congress change about Social Security?** Submit. Show the result, **Information request**, **Fallback**, and source links. Open one source, then return to CivicLens.

**Say:**

> Now I ask what H.R. 82 of the 118th Congress changed. This is an information request, so CivicLens doesn't give the question a truth rating. In this version, informational questions use a deterministic explanation from retrieved source context, rather than calling a language model. The Fallback label stays visible. I can open a source and check the explanation myself; having a citation is not a guarantee of correctness.

**Evidence:** [C03](CivicLens_Documentation_Verification.md#c03), [C04](CivicLens_Documentation_Verification.md#c04), [C06](CivicLens_Documentation_Verification.md#c06).

### 1:35–2:00 — Follow the legislative record

**Screen:** Use the related bill link or open `/bills/118/hr/82`. Show the Congress identifier, **What changes**, the source drawer, and **Official actions**. This is a prepared historical record, not a demonstration of a current live Congress.gov fetch.

**Say:**

> The related bill opens a historical example from the 118th Congress. Its page brings together plain-language sections, source links, and an action timeline. Keeping the Congress and bill number together helps identify the exact record. I can move from the explanation to the reference instead of treating the app as the final authority.

**Evidence:** [C06](CivicLens_Documentation_Verification.md#c06), [C07](CivicLens_Documentation_Verification.md#c07).

### 2:00–2:25 — Connect the interface to representation

**Screen:** Open District. Add the sample caption **before** submitting the prepared example input. Show the resulting district and member cards without reading the names as current representatives. Do not use **Use my location** for this recording.

**Say:**

> District shows the representation-lookup interface. These are sample representatives, not a verified result for this address. Live lookup is handled on the server through Census, with Congress member data when available. The route does not send the address to a language model or write it to the application's database.

**Evidence:** [C08](CivicLens_Documentation_Verification.md#c08), [C09](CivicLens_Documentation_Verification.md#c09). The sample caption is essential: member fallback can supply unrelated sample names even after a live district match. Do not present this as a verified real-address result.

### 2:25–2:50 — Explain the engineering and purpose

**Screen:** Show `/methodology`, then finish on the CivicLens homepage. Small caption: **TypeScript / JavaScript · Next.js / React · Tailwind CSS · Zod**. Include participant credits in the available time.

**Say:**

> CivicLens uses TypeScript and JavaScript with Next.js, React, Tailwind CSS, and Zod. It supports optional model providers for eligible claim analysis, but this demonstration doesn't claim a live AI result. Its purpose is civic understanding, not telling students whom to vote for: learn the concept, investigate the question, and check the source.

**Evidence:** [C01](CivicLens_Documentation_Verification.md#c01), [C05](CivicLens_Documentation_Verification.md#c05), [C12](CivicLens_Documentation_Verification.md#c12).

## Optional live-provider replacement

Keep the main script above for a no-paid-key demonstration. A separate live segment requires a separate, intentionally configured runtime; do not leave the forced `ENABLE_* = false` settings in effect.

Run `pnpm smoke:providers` using the README configuration. If a base URL is configured, the target server must already be running with that provider configuration. **The script exits successfully when it skips for missing credentials. A skip is not a live-provider pass.** Require the explicit successful integration message, then verify the actual on-screen request. [C05](CivicLens_Documentation_Verification.md#c05), [C11](CivicLens_Documentation_Verification.md#c11)

Use the smoke script's declarative test input, not the informational question:

> H.R. 82 did not repeal the government pension offset or windfall elimination rules.

Only after the response actually uses `mode: "live"`, includes valid source references, and has no fallback warning, replace the relevant narration with:

> This claim used the configured model-provider path with retrieved source context. The app validates the response and citation references. I still need to inspect the evidence; a live model response does not prove that every source was fetched live or that every conclusion is correct.

Check `sourceMode` separately. Provider-assisted presentation can also include deterministic safeguards; do not describe all displayed wording as unmodified model output. No live-provider success is asserted by this documentation pass. [C03](CivicLens_Documentation_Verification.md#c03), [C04](CivicLens_Documentation_Verification.md#c04)

## Recording acceptance checklist

- [ ] Actual participants are named; all placeholders are replaced.
- [ ] The recorded build matches the documented behavior, or the script has been re-audited.
- [ ] The lesson's answer, feedback, completion, and session-only behavior were rehearsed normally.
- [ ] Fixed XP/streak values and District sample data are clearly identified throughout their shots.
- [ ] Analyze's source links, related bill identity, and Fallback/Live AI status match the recording.
- [ ] No saved mastery, automatic review queue, visible Analyze quiz, verified representative match, native mobile app, universal fact-checking, or classroom learning gains are claimed.
- [ ] Waiting-time cuts do not disguise failures; source pages are readable.
- [ ] Current competition instructions and the live submission form have been checked before publishing. The recovered form requests a public HTTPS video link.
- [ ] The final public video link opens without the applicant's login and is entered in the submission form. This script is not a recording or a submitted application.
