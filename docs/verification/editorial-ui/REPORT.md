> Historical rejected-design evidence. The current UI is documented in [the restoration report](../restored-mobile-ui/REPORT.md).

# CivicLens editorial UI verification

Tested application SHA: `30ee62c49cd9d174a440bb125b7ce734ec3e6c58`.
Base SHA: `f61acd8f7080ee15193d812a54a9d83a48b89a6d`.
Draft integration: [PR #3](https://github.com/ShadowKingYT444/CivicLens/pull/3).
Provider/privacy checkpoint `c0f09cb9af3be98f989cda7fa8dedc034687925b` is included.

## Results

- Production build and typecheck passed. Lint: zero errors, five existing warnings.
- Unit suite: 26 files, **213 tests passed**. Provider safety tests use controlled/mocked responses.
- Actual Chromium production suite: **29 tests passed**: 13 desktop/API tests and 16 mobile tests at 390/430px. Also checked 320px with reduced motion.
- Verified main navigation, private POST bill search, truthful sample District results, cleared addresses, Sources focus trapping/Escape/focus restoration, and canceled analysis without stale results.
- Learning starts at zero XP; wrong answers cannot complete a lesson; completion grants 25 XP once; reload/navigation persistence, keyboard continuity and single-swipe advancement passed.
- Final production screenshot sweep covered 1440/768/390px without page errors or horizontal overflow. Feature checks also covered 1366/390/320px and District/Bills at 768px.

No live AI provider configuration was available. Provider smoke skipped; deterministic/demo behavior and mocked provider tests are not evidence of live AI success. No deployment, merge, paid service, production data mutation or laptop access occurred.

## Actual screenshots and provenance

These are unchanged Chromium PNGs, not generated UI illustrations. Desktop images come from the final combined production capture. Mobile images come from the agents' actual browser feature checks on the same UI work before the provider handoff was integrated; they are not claimed to be screenshots of the exact final application commit. The complete combined application was subsequently tested at the SHA above.

- [Desktop Home](desktop-home.png): 1440px viewport; full-page production capture.
- [Desktop Analyze](desktop-analyze.png): 1440px viewport; full-page production capture.
- [Mobile District](mobile-district-320.png): 320px viewport; actual deterministic sample result, adjacent warning and representatives.
- [Mobile Sources](mobile-sources-390.png): 390px viewport; actual Sources dialog.

| File | Bytes | Original capture file modification time (UTC) | SHA-256 |
| --- | ---: | --- | --- |
| `desktop-home.png` | 127651 | 2026-10-02T18:30:30.945602+00:00 | `8d09150dd943560c3361df5119963653bf109ffec358e5527ca3d7d63af458ce` |
| `desktop-analyze.png` | 84226 | 2026-10-02T18:30:32.198725+00:00 | `fff83f458ebcfdaa8003f8271a34f03937c59812eb7d93a455ed47dc333a026e` |
| `mobile-district-320.png` | 41306 | 2026-10-02T18:23:18.946891+00:00 | `229f2fdbdb66064ca316e366e55fbcd5ecad39d3ac2d11d3dfcb1398a6fc869a` |
| `mobile-sources-390.png` | 66806 | 2026-10-02T18:21:30.024280+00:00 | `c49d6e3b0af23df9d84fa51567ca83f85484ecbe731af1d0237bb8b2201f7436` |

## Motion Debugger evidence

Private Motion Debugger 0.4.0 was built from frozen source `63eff24c88dcbf42438230117834d8247e103367` in a temporary directory. Actual stdio MCP discovery, capture, bounded inspection and recorded-frame extraction were performed. Three real Sources open→Escape→reopen recordings were inspected:

- Desktop: `af8702e5-8e1d-483f-b28b-68e4f35e3ee8`
- Narrow 320px: `eba6c28d-9ed8-40d6-bd0b-4c450d100c39`
- Reduced motion 320px: `5f68ecb2-ba86-4103-97cf-1b90c6af5042`

Final open state, browser/network and displacement checks passed. The temporal integrity gate failed across 200–417ms gaps while the target was absent between close and reopen. **Timing verdict: inconclusive.** No thresholds were relaxed; no motion repair or before/after improvement is claimed. Full recordings/logs remain in the cloud workspace, outside this compact handoff.

Library saving failed: the upload destination could not resolve in this environment (`gaierror -3`), all five transfers stayed at zero bytes, and all returned `transfer_failed`. Nothing was finalized in Library. This private repository evidence directory provides the requested handoff instead.

## Reproduce

```bash
pnpm install --frozen-lockfile
pnpm typecheck
pnpm lint
pnpm test
pnpm build
DEMO_MODE=true CENSUS_GEOCODER_ENABLED=false pnpm start --hostname 127.0.0.1 --port 3400
```

With Playwright's supported browser and FFmpeg installed:

```bash
PORT=3400 PLAYWRIGHT_BASE_URL=http://127.0.0.1:3400 pnpm exec playwright test
```

This environment used `/usr/bin/chromium`, system FFmpeg through a temporary browser cache, and a temporary configuration specifying that executable. No global host configuration was changed. Maintained tests are in `tests/e2e/` and `tests/mobile-ui.spec.ts`.
