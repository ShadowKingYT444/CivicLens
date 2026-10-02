# CivicLens — Congressional App Challenge submission answers

**Application basis:** repository commit `f61acd8f7080ee15193d812a54a9d83a48b89a6d` (`Fix deterministic CI behavior`). These answers describe that implementation, not a proposed or separately modified build.

**Question recovery:** all 21 fields below were read from the three original screenshots: `Screenshot_20260929_185247.png`, `Screenshot_20260929_185301.png`, and `Screenshot_20260929_185313.png`. The screenshots were inspected directly; the questions are not reconstructed from a generic competition template. Screenshot filenames establish provenance, but private images are not copied into this public repository. Recheck the live form before submitting.

**How to use:** copy the answer text, not editor notes or source references. Long-answer drafts are kept below 400 words; the screenshots display a 400-word counter on the visible long-answer fields. **STUDENT TO COMPLETE** means a fact or asset is not established by repository inspection. Candidate personal reflections require confirmation in the applicant's own voice. Do not submit placeholders, infer personal experience from code, or publish private contact details in this repository.

Product claims link to the [verification record](CivicLens_Documentation_Verification.md). The [demo script](CivicLens_Demo_Script.md) follows the actual interface, including its current limitations.

## About Your App

*Fields 01–06: `Screenshot_20260929_185247.png`. Fields 07–13: `Screenshot_20260929_185301.png`.*

### 01. What is your app called?

**Answer:** CivicLens.

**Source:** [C01](CivicLens_Documentation_Verification.md#c01).

### 02. Which programming language(s) did you use to create your app?

**Answer:** Select **JavaScript** and **Other**. For Other, specify **TypeScript** where the form permits.

**Editor note:** The application and server routes use TypeScript, with JavaScript scripts and configuration. The interface uses CSS, and optional database workflows use SQL. Do not select Python simply because a development or documentation tool used it.

**Source:** [C01](CivicLens_Documentation_Verification.md#c01).

### 03. Which platform(s) did you code your app for?

**Answer:** **Web**.

**Editor note:** The repository describes a mobile-first PWA/web app. Access through an Android or iOS browser is not evidence of a separately implemented native mobile application or an app-store release.

**Source:** [C01](CivicLens_Documentation_Verification.md#c01).

### 04. Please list the link to your app's video demonstration here

**Answer:** **STUDENT TO COMPLETE — paste the actual public HTTPS demonstration-video URL after recording and uploading it.**

**Editor note:** The screenshot explicitly requires a public video link beginning with `https`. Use the [demo script](CivicLens_Demo_Script.md), test the published link without signing in, and do not substitute the repository or a local development URL for the video.

### 05. Please briefly describe what your app does?

**Answer:**

CivicLens is a civic-literacy web app for students. It connects short lessons about government with tools for investigating civic questions and legislative records.

The learning path presents teaching cards and a quick-check question with an explanation. Completing a lesson updates the path during the current session. Analyze accepts a bill question or civic claim and pairs its response with source links. Informational questions use deterministic explanations from retrieved source context. Eligible factual claims can use a configured model provider, with structured-output and citation-reference checks; the app also has a fallback path.

The bill interface presents readable explanations, source references, and legislative-action timelines. District lookup accepts an address or browser location and can use Census and Congress data through server-side routes. It also has sample-data fallbacks, which must not be treated as verified representative matches.

The purpose is to make civic information inspectable, not to recommend candidates or voting choices. This version remains a prototype: lesson progress is not saved across sessions, displayed XP and streak values are illustrative, and a citation does not by itself prove an answer is correct.

**Sources:** [C01–C04](CivicLens_Documentation_Verification.md#c01), [C07](CivicLens_Documentation_Verification.md#c07), [C08](CivicLens_Documentation_Verification.md#c08), [C12](CivicLens_Documentation_Verification.md#c12).

### 06. What inspired you to create this app?

**Candidate answer — confirm that this matches your actual motivation:**

The idea behind CivicLens is to connect learning about government with investigating a concrete question. A student may encounter a statement about a bill without understanding the branch involved, the legislative process, or the record needed to evaluate it.

CivicLens brings those steps together: learn a concept, practice it, ask a question, and open the supporting source. The lesson path makes the starting point approachable, while the bill and analysis views encourage students to look beyond the explanation to the evidence.

The purpose is not to tell students which political position to adopt. It is to give them a more structured way to ask what government can do and what the available record actually supports.

**Editor note:** This explains the product's evident purpose, not a verified personal origin story. Replace it with your real motivation and add a personal example only if it happened. The repository cannot establish why you began the project.

**Sources for product descriptions:** [C01](CivicLens_Documentation_Verification.md#c01), [C02](CivicLens_Documentation_Verification.md#c02), [C03](CivicLens_Documentation_Verification.md#c03), [C12](CivicLens_Documentation_Verification.md#c12).

### 07. What technical difficulties did you face programming your app?

**Candidate answer — add your own substantiated work before submitting:**

One technical challenge reflected in the implementation is connecting generated explanations to evidence. CivicLens retrieves sources before analysis, validates structured responses, checks citation references, and falls back when the provider path is unavailable or fails validation. Those checks reduce some failure modes, but they do not establish that every sentence follows from its source.

Another challenge is separating a convincing interface from a verified result. The analysis response distinguishes generation mode from source mode. A live model can still use prepared source context, and an informational question deliberately takes the deterministic path. District lookup presents a harder remaining problem: its fallback can supply sample representatives, while the interface does not clearly label their provenance.

The learning path also illustrates the difference between visual feedback and persistent state. Completion changes React state during the session, but the current XP and streak displays are fixed rather than a saved achievement system.

These are concrete engineering boundaries that the demo must represent honestly, not claim to have solved. [STUDENT TO COMPLETE: describe one component you personally implemented, one problem you investigated, the change you made, and the test you actually ran.]

**Editor note:** Do not describe agent-run work as your own or say the remaining limitations have been fixed. The final paragraph requires the student's development history, not a guess from the repository.

**Sources:** [C02](CivicLens_Documentation_Verification.md#c02), [C04](CivicLens_Documentation_Verification.md#c04), [C08](CivicLens_Documentation_Verification.md#c08).

### 08. What improvements would you make if you were to create a 2.0 version of your app?

**Candidate answer — proposed work, not existing capabilities:**

First, I would make progress meaningful and durable. That would mean saving actual lesson completion, computing XP from real activity, and requiring demonstrated understanding before treating a concept as mastered. The current session-only path and illustrative counters should not be confused with those features.

Second, I would make data provenance unmistakable. District lookup should never fill a real result with unrelated sample representatives. Sample, unavailable, and verified results should be separate states, and the interface should show them clearly. Analysis should also distinguish a live model call from a live source fetch.

Third, I would evaluate evidence quality and learning rather than assume the interface is effective. A reviewed test set could check whether retrieved passages support each explanation, including ambiguous and incomplete claims. A consent-based learning study could then assess whether students apply the concepts to new examples.

These changes would strengthen the existing learning-and-evidence workflow without turning it into political persuasion or collecting unnecessary student information.

**Editor note:** This is a suggested roadmap for the applicant to adopt or revise. No classroom study, mastery model, persistent XP system, or completed provenance fix is asserted.

**Current-state sources:** [C02](CivicLens_Documentation_Verification.md#c02), [C04](CivicLens_Documentation_Verification.md#c04), [C08](CivicLens_Documentation_Verification.md#c08), [C12](CivicLens_Documentation_Verification.md#c12).

### 09. Did you use AI in the creation, development, or functionality of your app?

**Answer:** **Yes**.

**Editor note:** ChatGPT assisted this documentation pass, and the code supports optional model-provider functionality. This does not establish the complete history of earlier coding or asset-generation assistance; complete that disclosure below.

### 10. If you used AI, tell us how you used it and what your team contributed directly. Please list the AI tools you used and briefly explain how they helped. Then describe what your team designed, coded, changed, tested, or finalized yourselves.

**Answer draft — incomplete until the student contribution fields are filled:**

I used ChatGPT to review the existing repository against the demonstration and submission claims, draft the demo script, and prepare these application answers. This assistance included writing and revising documentation; the answers should not be represented as entirely unaided writing.

The app also supports optional model-provider functionality. Its server can send eligible claims and retrieved source context to configured NVIDIA NIM, Groq, or a generic OpenAI-compatible endpoint. It validates the response and citation references and has deterministic fallback behavior. Informational questions use the deterministic path in this version. Provider support in the code is not evidence that a live deployment or model response has been verified.

[STUDENT TO COMPLETE: list every other AI coding assistant, model, or asset-generation tool used during development; explain what each produced and what you reviewed. Do not omit earlier assistance just because it is not visible in this documentation pass.]

[STUDENT TO COMPLETE: name the components you or each teammate personally designed or coded, the changes you made or reviewed, and the tests you personally ran. Explain at least one technical decision in your own words.]

**Editor note:** Repository authorship metadata does not establish who wrote each component. Do not copy earlier claims about Codex, coordinated agents, training, or browser tests unless you can confirm those events. The current documentation work did not modify application code or establish live-provider success.

**Runtime sources:** [C04](CivicLens_Documentation_Verification.md#c04), [C05](CivicLens_Documentation_Verification.md#c05). Documentation assistance is established by this authoring task, not inferred from source code.

### 11. What did you learn or take away from participating in the Congressional App Challenge?

**Candidate answer — revise to reflect your actual experience:**

A central takeaway from this project is that a credible demonstration should explain the boundary between what an interface shows and what the underlying system proves. An XP graphic is not necessarily saved progress, a displayed representative is not necessarily a verified match, and a citation is not automatically sufficient evidence for a conclusion.

Civic software makes these distinctions especially important. A useful explanation should let a student inspect the record and understand what remains uncertain, rather than simply accept a confident answer.

AI assistance also makes review and attribution important. Generated documentation and code still need to be checked against the implemented behavior, and the applicant needs to understand the technical choices they present.

[STUDENT TO COMPLETE: add one specific example of what you personally learned while building or testing CivicLens, and remove any statement that does not match your experience.]

**Editor note:** This is a proposed reflection, not testimony that the applicant personally performed the repository audit or tests. Do not claim student adoption, classroom results, or measured learning improvement without evidence.

**Technical basis:** [C02](CivicLens_Documentation_Verification.md#c02), [C04](CivicLens_Documentation_Verification.md#c04), [C08](CivicLens_Documentation_Verification.md#c08).

### 12. Please include a cover photo from your app

**Answer:** **STUDENT TO COMPLETE — upload an actual screenshot of the submission build.**

**Editor note:** The recovered screenshot says thumbnails should be clear, **JPEG is strongly preferred**, and the ideal size is **600 × 800 pixels, a 3:4 aspect ratio**. Show the app name and a legible working surface. Do not use a generated mockup as evidence of implementation. No fresh cover photo was captured or validated by this documentation pass; an older image should be checked against the actual submission build before use.

### 13. It's not required, but you may include a link where judges can access your project. This could be an app store link, website, web app, GitHub page, demo, or another project link.

**Answer:** https://github.com/ShadowKingYT444/CivicLens

**Editor note:** The repository is public as checked for this task. It is source-code access, not a verified hosted deployment. The documentation pull request must be merged for these files to appear on the default branch. Do not invent a deployment URL or use `localhost` in the form.

## About Your Process

*Fields 14–21: `Screenshot_20260929_185313.png`.*

### 14. Where did you do most of the coding for your app?

**Answer:** **STUDENT TO COMPLETE.** Choose the truthful option or options: **At Home**, **At School**, **At a library**, **At an afterschool program**, **At theCoderSchool**, or **Somewhere else**.

**Editor note:** A development VM or repository location does not establish where the applicant did most of the coding.

### 15. On what date did you complete the coding for your app?

**Answer:** **STUDENT TO COMPLETE — enter the actual completion date of the version you review and submit.**

**Editor note:** Neither a commit timestamp nor the date of this documentation work establishes that the student's coding was complete.

### 16. Did you create this app as part of a project for school, a coding club, or a similar organization?

**Answer:** **STUDENT TO COMPLETE — select Yes or No according to the actual project arrangement.**

**Editor note:** The repository does not establish an affiliation, and membership in a school or club does not by itself answer this question.

### 17. If completed as a project, please list the name of the school or organization here.

**Answer:** **STUDENT TO COMPLETE if applicable — enter the actual school or organization; otherwise leave this conditional field blank.**

### 18. If completed as a project, please list the name of the teacher or mentor here.

**Answer:** **STUDENT TO COMPLETE if applicable — enter the actual teacher or mentor; otherwise leave blank.**

### 19. If completed as a project, please list the email address of the teacher or mentor here.

**Answer:** **STUDENT TO COMPLETE if applicable — enter the verified email address directly in the application form; otherwise leave blank.**

**Editor note:** Do not guess an email address or publish private contact information in this public repository.

### 20. Did an App Challenge Ambassador refer you to the Congressional App Challenge? If so, please list their email address here.

**Answer:** **STUDENT TO COMPLETE if applicable — enter the actual referring ambassador's verified email directly in the form; otherwise leave blank.**

## Final Confirmation

### 21. Application Ready to Submit

**Answer:** Leave unchecked until the **primary applicant** has reviewed the complete application, replaced all placeholders, confirmed personal contributions and AI disclosures, supplied the real video and cover image, and checked the current competition instructions.

**Editor note:** The recovered form identifies the primary applicant as the person who can complete the final submission. Committing documentation does not submit the application or certify eligibility. No submission, upload to the competition portal, or final confirmation has been performed by this task.
