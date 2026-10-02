# CivicLens — Congressional App Challenge submission answers

These drafts follow every question visible in the three supplied screenshots. Each long answer is below the screenshots' **400-word** limit. Review personal reflections in your own voice before submission. Fields marked **STUDENT TO COMPLETE** require facts that are not established by the repository or this development session.

## About Your App

### What is your app called?

CivicLens

### Which programming language(s) did you use to create your app?

Select **JavaScript** and **Other**. If prompted for Other, enter **TypeScript**. The application and server routes are primarily TypeScript; scripts include JavaScript. The interface also uses HTML/CSS, and the optional PostgreSQL database uses SQL. Do not select Python or other languages just because development tools use them.

### Which platform(s) did you code your app for?

Select **Web**. It is a responsive web app usable in desktop and mobile browsers. Browser support on iOS/Android does not imply a native App Store or Play Store application.

### Please list the link to your app's video demonstration here

**STUDENT TO COMPLETE:** Paste the real HTTPS link after recording and uploading the video to public YouTube or Vimeo. Use `demo-script.md`. A repository link does not satisfy this required video field.

### Please briefly describe what your app does

CivicLens helps students turn political claims into source-backed civic understanding. It combines a short civic-learning path, quizzes with explanations, a bill explorer, claim analysis, and federal district lookup in a mobile-friendly interface.

Students start with 32 lessons and 96 application questions on how government works, practice applying those ideas, and see their progress. They can then ask about a civic claim or bill. The server retrieves relevant source material, a configured language model produces a plain-English explanation, and validation checks the output structure and citation references. Students can open the sources and inspect the evidence themselves. If a provider is unavailable, the app can use labeled demonstration data and deterministic explanations.

The bill explorer exposes legislation's Congress, summary, actions, sponsors, and source links. District lookup shows a resolved district with available representative context or official directory links. Its explicit sample flow displays a dated snapshot. Addresses are not stored or sent to an AI provider.

CivicLens is designed to develop civic reasoning rather than reward a political position. It does not recommend candidates or voting choices, and it declines requests for campaign persuasion. Its central learning loop is: understand the concept, investigate a concrete question, check the source, and demonstrate understanding.

### What inspired you to create this app?

The idea behind CivicLens is that access to political information does not automatically create civic understanding. A short post can mention a bill, a court decision, or a president's action without explaining who has authority, what the official record says, or whether the event has actually happened.

I wanted to connect those missing steps. Short lessons give students the background to ask better questions. Bill records and source links let them investigate a real example. Plain-English explanations make dense material approachable, and quizzes check whether the explanation led to understanding.

The learning interface draws on the clear progression and immediate feedback of apps such as Duolingo. The civic purpose is different: students should develop the ability to evaluate an argument and its evidence, rather than be guided toward a particular political conclusion.

The intended result is a place where a student can move from “I saw this claim” to “I understand the government process involved, I found the source, and I can explain what the evidence does and does not establish.”

### What technical difficulties did you face programming your app?

A central difficulty was making an AI explanation accountable to evidence. A fluent answer can still cite the wrong source or introduce an unsupported detail. CivicLens retrieves sources before generation, gives the model bounded source context, validates structured output, and checks citation identifiers against the supplied sources. It uses refusals or fallback behavior when the provider or validation path fails. These safeguards reduce risk; they do not replace checking whether a source actually supports a conclusion.

External civic data created a second challenge. Bill numbers repeat across Congresses, agency responses vary, and district lookup can fail or produce incomplete information. The application keeps Congress identifiers in bill routes, normalizes external responses, and distinguishes example data from live results. This prevents a successful-looking demo from quietly masquerading as a verified lookup.

Privacy also affected the architecture. District requests go through server routes, and raw addresses are not stored or sent to the language model. Analysis input is minimized rather than used to build a political profile.

Finally, a colorful learning path needs real state underneath it. Lesson completion, quiz feedback, and navigation must behave consistently across desktop and phone layouts. Automated checks and browser walkthroughs test those interactions alongside API contracts. Codex agents assisted these implementation and validation tasks, as disclosed below.

### What improvements would you make if you were to create a 2.0 version of your app?

The first priority would be measuring learning instead of assuming engagement means understanding. I would run a consent-based classroom pilot with pre-tests, post-tests, and delayed checks, using questions that require students to apply a civic concept to a new example. That would show which lessons transfer and which only encourage memorization.

A second priority would be stronger evidence evaluation. Citation identifiers can be valid even when a passage does not support the answer. I would build a human-reviewed evaluation set covering ambiguous claims, incomplete records, conflicting sources, and changes over time, then test retrieval quality and factual support separately.

I would also add teacher-approved assignments, multilingual explanations reviewed for civic accuracy, and state or local legislation where reliable official data is available. Any classroom features would need careful privacy design rather than collecting student identities by default.

These additions would extend the existing learning-and-evidence loop, while preserving the boundary against political recommendations or targeted persuasion.

### Did you use AI in the creation, development, or functionality of your app?

Select **Yes**.

### If you used AI, tell us how you used it and what your team contributed directly. Please list the AI tools you used and briefly explain how they helped. Then describe what your team designed, coded, changed, tested, or finalized yourselves.

I used OpenAI Codex, including coordinated coding agents, to assist development. Starting from my existing partially completed CivicLens repository, the agents reviewed the code and product requirements, expanded civic curriculum, implemented interface and application changes, investigated errors, and helped run automated checks and browser testing. Codex also assisted the demonstration script and these submission drafts. This assistance includes AI-generated code and content, not only brainstorming or proofreading.

AI is also part of the optional app functionality. A configured language-model provider can generate plain-English explanations from retrieved source material. The server validates the response and supplied citation references. Without a configured or successful provider, the app can use explicitly labeled deterministic fallback behavior. The learning curriculum is prewritten content; it is not evidence that a live model generated an answer.

My established contribution was bringing the existing partially completed project and directing its civic-literacy purpose, Duolingo-inspired learning experience, and completion priorities. **[STUDENT TO COMPLETE: identify the components you personally designed or coded before AI assistance, specific changes you reviewed or made yourself, and tests you personally ran. Explain one technical decision you understand. List any other AI tools or generated assets used earlier in development.]**

I will submit only claims about my own work that I can substantiate and explain. The agent-assisted code, curriculum, and testing described above should not be represented as work I personally performed.

### What did you learn or take away from participating in the Congressional App Challenge?

The main lesson of this project is that civic software needs more than a convincing answer. It needs a visible relationship between the question, the evidence, and the limits of the conclusion. An official-looking link is not enough if it does not support what the app says.

The project also shows why product design and engineering have to work together. A readable explanation is more useful when a student can inspect its source, apply the concept in a quiz, and return to a clear learning path. Privacy and failure states are part of that experience: an unavailable service should produce an honest explanation rather than a misleading result.

Working with AI assistance adds another responsibility. Generated code and content still need review, and a student must understand the technical decisions being presented as their project. The most valuable outcome would be an app I can explain, improve, and evaluate, not just demonstrate.

**Before submitting:** revise this reflection to match what you personally learned and did. Add one concrete example from your own work if available; do not claim classroom results or personal testing that did not occur.

### Please include a cover photo from your app

Use an actual screenshot of the completed learning path, with the CivicLens name and readable lesson/progress elements. The provided form strongly prefers **JPEG**, with an ideal **3:4 aspect ratio at 600×800 pixels**. Capture the finished interface; do not use a generated mockup as proof of a working app. The handoff includes **CivicLens_Cover.jpg**, a visually checked 600×800 JPEG captured from the working production learning path. Upload that file in this field.

### Optional link where judges can access your project

https://github.com/ShadowKingYT444/CivicLens

This is the verified repository URL. Confirm judges can access it without your login. If a stable live deployment is created, its verified HTTPS URL can replace or accompany this link. Do not paste a local `localhost` address or an invented deployment URL.

## About Your Process

### Where did you do most of the coding for your app?

**STUDENT TO COMPLETE:** Select the truthful location(s): At Home, At School, At a library, At an afterschool program, At theCoderSchool, or Somewhere else. A cloud development VM does not establish where you did most of your coding.

### On what date did you complete the coding for your app?

**STUDENT TO COMPLETE:** Enter the actual date when you finish and review the submission version. Do not treat the date on this draft or the agent's build run as proof that your project is final.

### Did you create this app as part of a project for school, a coding club, or a similar organization?

**STUDENT TO COMPLETE:** Select Yes or No based on the actual project arrangement. Your membership in a club does not establish that this app was its project.

### If completed as a project, please list the name of the school or organization here

**STUDENT TO COMPLETE if applicable:** Enter the actual organization; otherwise leave this conditional field blank.

### If completed as a project, please list the name of the teacher or mentor here

**STUDENT TO COMPLETE if applicable:** Enter the actual teacher or mentor; otherwise leave blank.

### If completed as a project, please list the email address of the teacher or mentor here

**STUDENT TO COMPLETE if applicable:** Enter their verified email address; otherwise leave blank. Do not use a guessed address.

### Did an App Challenge Ambassador refer you to the Congressional App Challenge? If so, please list their email address here

**STUDENT TO COMPLETE if applicable:** Enter the actual referring ambassador's verified email; otherwise leave blank.

## Final Confirmation

### Application Ready to Submit

Select **Yes only when the primary applicant has completed all required personal fields, checked the AI disclosure and their own contributions, attached the cover photo, published and verified the public video, and reviewed the final application.** These prepared materials are not a submitted application.

## Final submission checklist

Checked against the [official 2026 rules](https://www.congressionalappchallenge.us/wp-content/uploads/2026/05/2026-CAC-Rules.pdf) and the supplied form screenshots.

- [ ] Verify student eligibility, a participating residence/school district, and any teammates; only one entry per person, with at most four students per team.
- [ ] Confirm eligible project dates; if this is an updated prior entry, identify the new work.
- [ ] Complete personal profiles and the eligibility process using real student/guardian information.
- [ ] Describe student-authored technical contributions honestly; disclose all AI, libraries, frameworks, external tools, and asset sources. Be ready to explain the code.
- [ ] Run and record final build, automated checks, and browser walkthroughs. Review remaining provider limitations rather than claiming every connection works.
- [ ] Rehearse the actual demo inputs; verify sources and the distinction between live and fixture data.
- [ ] Record a 1–3 minute video with every participant's name, app name, purpose, audience, tools/languages, and working functionality.
- [ ] Publish it publicly on YouTube or Vimeo; verify the HTTPS link without signing in.
- [ ] Paste the short answers, keeping every 400-word field within its limit.
- [ ] Upload a checked 600×800 JPEG cover screenshot; test the optional project link.
- [ ] Complete the personal process fields and have the primary applicant review and submit.
- [ ] Submit before **October 26, 2026, at 12:00 PM EDT / 9:00 AM PDT**; check the selected district's instructions too.
- [ ] Save the submission confirmation and respond to any request to inspect the app/source code.
- [ ] Each team member completes the exit questionnaire when requested.

Official references: [2026 rules PDF](https://www.congressionalappchallenge.us/wp-content/uploads/2026/05/2026-CAC-Rules.pdf), [student rules overview](https://www.congressionalappchallenge.us/students/rules/), and [official judging guidance](https://www.congressionalappchallenge.us/get-involved/judges/). The supplied form screenshots are the source for the 400-word fields and JPEG cover-image specifications.
