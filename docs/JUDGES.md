# CivicLens: guide for judges

**Purpose:** help middle-school and high-school students move from political claims to source-backed civic understanding.

**Platform:** mobile-first web app and Android 8+ server-connected demo APK. The project uses TypeScript, React, Next.js, Zod, optional NVIDIA NIM, and Java for the Android shell. No private API key should be given to a judge; keys stay on the server.

## Short walkthrough

Start using the [README](../README.md), or use the entrant's running server and Android client.

1. **Learn:** complete Separation of Powers: three teaching cards and three application questions. A wrong answer requires retry and marks the lesson for review. Completion earns 25 XP and unlocks the next lesson. Reload to see local progress persist; replay does not award duplicate XP.
2. **Analyze:** ask `What did H.R. 82 of the 118th Congress change about Social Security?` Read the answer, mode label, sources/excerpts, and knowledge check. Follow the historical bill link. Questions are not assigned true/false scores.
3. **Check a claim:** ask `H.R. 82 did not repeal the government pension offset or windfall elimination rules.` Compare the assessment with the public-law excerpt. Bill numbers repeat across Congresses; this is a historical law.
4. **District:** select **Explore a sample district** for a labeled July 2026 CA-11 snapshot. For live geocoding use a public building, such as `1600 Pennsylvania Ave NW, Washington, DC 20500`. Verified districts and unavailable current-member records are reported separately.
5. **Guardrails:** request a persuasive campaign message or candidate recommendation. The app refuses and offers neutral civic explanation instead.

See the [timed recording script](submission/demo-script.md). Participant names, project-history/contribution disclosures, eligibility, video publication, and final contest submission remain the entrant's responsibility. Fill submission-answer placeholders with real information.

## What labels mean

- **Live AI:** a provider returned a response that passed the app's checks. Unsupported wording may be replaced with supplied source excerpts.
- **Template/guided mode:** no validated live response was used.
- **Curated sources / fixtures:** dated bundled context, not proof of freshly fetched Congress.gov records.
- **Sample district:** an example, not a lookup of your location.
- **District verified, member data unavailable:** Census succeeded; current representatives were not retrieved.

Real NIM and Census tests are documented in [verification.md](submission/verification.md). Automated checks do not guarantee every model statement is correct. Open the sources.

## Android

The [APK](../downloads/CivicLens-demo.apk) is a Java/WebView shell with back navigation, server settings, source links, and on-demand location permission. It requires a running HTTPS server or a USB-connected computer running CivicLens. It has no embedded credentials/offline model and uses a demo certificate. Cloud compilation/signature checks do not substitute for testing on the entrant's physical phone.
