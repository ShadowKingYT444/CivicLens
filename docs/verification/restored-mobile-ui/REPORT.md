# Original mobile UI restored

Tested application commit: `638bd2768fb19841cb8281a88d5583895f67b4af`.
Visual authority: original `f61acd8f7080ee15193d812a54a9d83a48b89a6d`.
Draft PR: [#3](https://github.com/ShadowKingYT444/CivicLens/pull/3).

## Restored

The original vibrant mobile-first design is back: teal/yellow/purple cards, illustrated green lesson path, bill flashcard deck, colorful District cards, original typography and bottom navigation. The cream/serif/sidebar stylesheet is removed. Home, MobileAppShell, BottomNav and TopIdentity match the original source exactly.

Separable fixes remain: privacy redaction and safe provider errors, private POST bill search, truthful demo labels, actual saved learning progress and XP, correct-answer completion, duplicate-reward prevention, single-swipe advancement, request cancellation/stale-answer protection, and Sources keyboard trapping/focus restoration. Provider/privacy code was not modified during restoration.

## Verified in this cloud environment

- Production build and typecheck passed.
- Lint: zero errors, five existing warnings.
- Unit suite: **213 tests passed across 26 files**.
- Actual Chromium production browser suite: **29 passed** (13 desktop/API and 16 mobile at 390/430px).
- Additional actual 320/390px captures covered Home, Learn, Bills, Analyze, District, sample District results and Sources. No page errors or document overflow; original mobile canvas matches each viewport; no editorial sidebar is present. Sources keyboard focus remained inside the modal.
- Correct answers unlock lessons; fresh XP starts at zero; completion grants 25 XP once; reload and review preserve progress without duplicate rewards. Clear cancels an interrupted analysis. Bill search sends POST without query text in the URL.

[Actual test output](validation.log) · [Capture observations](capture.json).

## Actual screenshots

Unmodified Chromium screenshots from the rebuilt application at the tested source commit. Viewports 320×740 and 390×844; reduced motion enabled. No generated UI or image editing.

|320px|390px|
|---|---|
|[Home](home-320.png)|[Home](home-390.png)|
|[Learn](learn-320.png)|[Learn](learn-390.png)|

SHA-256:

- `home-320.png`: `1347081564e4c0cfef8c1594e4063425efec69b14e34136a55bdd99321415476`
- `learn-320.png`: `d5536da8d22cb0d0092b83231418ed942404ebe50805fb61f8dd9eaf0642c44d`
- `home-390.png`: `4058a2825f3c3fd89b809a183ec1f17dc55f764294f61d22ee1ca85a3c7e5066`
- `learn-390.png`: `c17506b035b8a666ea352d301d8dd5c16eba58345f05dfd4c652de824316fde9`

## Limits

Browser responses were deterministic/demo. Provider safety tests use controlled mocks. No authorized live-provider configuration was available, and no real AI success is claimed. This restoration did not perform a new Motion Debugger comparison; the original animations and reduced-motion CSS are retained. Prior editorial screenshots are historical rejected-design evidence, not the current UI.

No merge, deployment, public hosting, paid service, production data mutation or laptop access occurred. Library saving previously failed on upload-destination DNS resolution with zero bytes transferred; this compact private-repository evidence is the authorized handoff.

## Reproduce

```bash
pnpm typecheck
pnpm lint
pnpm test
pnpm build
DEMO_MODE=true CENSUS_GEOCODER_ENABLED=false pnpm start --hostname 127.0.0.1 --port 3400
PORT=3400 PLAYWRIGHT_BASE_URL=http://127.0.0.1:3400 pnpm exec playwright test
```

This environment used system Chromium/FFmpeg through temporary Playwright configuration. The maintained tests are in `tests/e2e/` and `tests/mobile-ui.spec.ts`.
