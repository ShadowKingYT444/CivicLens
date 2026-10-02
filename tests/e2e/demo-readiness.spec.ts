import { expect, test, type Page } from "@playwright/test";

const demoQuestion = "What did H.R. 82 of the 118th Congress change about Social Security?";

async function readyAnalysis(page: Page) {
  await page.goto("/analyze");
  await expect(page.getByLabel("Claim or bill question")).toBeEditable();
  await expect(page.getByRole("button", { name: "H.R. 82", exact: true })).toBeEnabled();
}

test("earned lessons persist, missed concepts require retry, and XP cannot be farmed", async ({ page }) => {
  await page.goto("/feed");
  const path = page.getByRole("listbox", { name: "CivicLens lesson path" });
  const first = page.getByRole("option", { name: "Level 1: Separation of Powers" });
  const second = page.getByRole("option", { name: "Level 2: Checks and Balances" });
  await expect(first).toBeEnabled();
  await expect(second).toBeDisabled();
  await expect(page.getByLabel("0 experience points")).toBeVisible();

  async function finishFirstLesson(miss: boolean) {
    await first.click();
    for (let card = 0; card < 3; card += 1) {
      await page.getByRole("button", { name: "Continue lesson", exact: true }).click();
    }
    const next = page.getByRole("button", { name: "Next question", exact: true });
    await expect(next).toBeDisabled();
    if (miss) {
      await page.getByRole("button", { name: "Issue a press release replacing it", exact: true }).click();
      await expect(next).toBeDisabled();
      await expect(page.getByText(/^Not quite\./)).toBeVisible();
      await page.getByRole("button", { name: "Try again", exact: true }).click();
    }
    await page.getByRole("button", { name: "Ask Congress to change the statute", exact: true }).click();
    await next.click();
    await page.getByRole("button", { name: "Resolving a case challenging a law", exact: true }).click();
    await next.click();
    const complete = page.getByRole("button", { name: "Complete lesson", exact: true });
    await expect(complete).toBeDisabled();
    await page.getByRole("button", { name: "The institution and legal action being proposed", exact: true }).click();
    await complete.click();
    await expect(page.getByRole("article", { name: "Lesson result" })).toBeVisible();
    await page.getByRole("button", { name: "Back to path", exact: true }).click();
  }

  await finishFirstLesson(true);
  await expect(page.getByLabel("25 experience points")).toBeVisible();
  await expect(second).toBeEnabled();
  await expect(page.getByRole("button", { name: /Review missed concepts/ })).toBeVisible();
  await page.reload();
  await expect(path).toBeVisible();
  await expect(first).toHaveClass(/complete/);
  await expect(page.getByLabel("25 experience points")).toBeVisible();
  await expect(second).toHaveAttribute("aria-selected", "true");
  await finishFirstLesson(false);
  await expect(page.getByLabel("25 experience points")).toBeVisible();
  await expect(page.getByRole("button", { name: /Review missed concepts/ })).toHaveCount(0);
});

test("demo analysis exposes provenance, cited evidence and a working knowledge check", async ({ page }) => {
  await readyAnalysis(page);
  const responsePromise = page.waitForResponse((response) => response.url().endsWith("/api/analyze") && response.request().method() === "POST");
  await page.getByLabel("Claim or bill question").fill(demoQuestion);
  await page.getByRole("button", { name: "Analyze", exact: true }).click();
  const payload = await (await responsePromise).json();
  await expect(page.getByRole("heading", { name: "Plain-English answer" })).toBeVisible();
  await expect(page.locator(".analyze-simple-claim").filter({ hasText: "Information request" })).toBeVisible();
  await expect(page.getByText("Truth verdict", { exact: true })).toHaveCount(0);
  await expect(page.getByRole("link", { name: "View HR 82", exact: true })).toHaveAttribute("href", "/bills/118/hr/82");
  if (payload.mode === "demo") {
    await expect(page.getByText(/Template-based explanation; no live AI response/)).toBeVisible();
  } else {
    await expect(page.getByText(/Live AI response checked against source excerpts/)).toBeVisible();
  }
  const sources = page.getByLabel("Sources");
  await expect(sources.getByRole("link").first()).toHaveAttribute("href", /^https:\/\//);
  await page.getByText("Read source excerpts", { exact: true }).click();
  await expect(page.locator(".analysis-source-excerpt").first()).toBeVisible();
  const checks = page.getByRole("region", { name: "Practice this explanation" });
  await expect(checks).toBeVisible();
  const question = payload.result.quiz[0];
  await checks.getByRole("button", { name: question.correctAnswer, exact: true }).first().click();
  await expect(checks.getByText(/^Correct\./).first()).toBeVisible();
});

test("analysis loading prevents duplicate submission and a server error can be retried", async ({ page }) => {
  let releaseRequest!: () => void;
  const holdRequest = new Promise<void>((resolve) => { releaseRequest = resolve; });
  let requests = 0;
  await page.route("**/api/analyze", async (route) => {
    requests += 1;
    if (requests === 1) await holdRequest;
    await route.fulfill({ status: 503, contentType: "application/json", body: JSON.stringify({ error: "The source check is temporarily unavailable." }) });
  });
  await readyAnalysis(page);
  await page.getByLabel("Claim or bill question").fill(demoQuestion);
  await page.getByRole("button", { name: "Analyze", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Reading sources..." })).toBeVisible();
  await expect(page.getByRole("button", { name: "Analyzing", exact: true })).toBeDisabled();
  await expect(page.getByRole("button", { name: "H.R. 82", exact: true })).toBeDisabled();
  releaseRequest();
  await expect(page.locator("main").getByRole("alert")).toContainText("temporarily unavailable");
  await expect(page.getByRole("button", { name: "Analyze", exact: true })).toBeEnabled();
  await page.getByRole("button", { name: "Analyze", exact: true }).click();
  await expect.poll(() => requests).toBe(2);
});

test("district failures cannot masquerade as a personal match and sample mode is explicit", async ({ page }) => {
  await page.route("**/api/district/lookup", async (route) => {
    const request = route.request().postDataJSON();
    if (request.demo === true) return route.continue();
    await route.fulfill({ contentType: "application/json", body: JSON.stringify({ status: "unavailable", source: "unavailable", message: "Live lookup is unavailable.", houseMembers: [], senators: [], privacyNote: "Your address is not stored." }) });
  });
  await page.goto("/district");
  const sample = page.getByRole("button", { name: "Explore a sample district", exact: true });
  await expect(sample).toBeEnabled();
  const address = "1600 Pennsylvania Ave NW, Washington, DC 20500";
  await page.getByLabel("Street address").fill(address);
  await page.getByRole("button", { name: "Look up district", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Lookup unavailable" })).toBeVisible();
  await expect(page.locator(".representative-card")).toHaveCount(0);
  await sample.click();
  await expect(page.getByRole("heading", { name: "Sample representatives" })).toBeVisible();
  await expect(page.getByText("Sample district · saved snapshot", { exact: true })).toBeVisible();
  await expect(page.getByText(address, { exact: true })).toHaveCount(0);
});

test("bill source dialog prevents background keyboard focus, closes with Escape and restores its trigger", async ({ page }) => {
  await page.goto("/bills/118/hr/82");
  const trigger = page.getByRole("button", { name: /^Sources \(/ });
  await expect(trigger).toBeEnabled();
  await trigger.click();
  const dialog = page.getByRole("dialog", { name: "Sources", exact: true });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByRole("button", { name: "Close", exact: true })).toBeFocused();
  for (let tab = 0; tab < 8; tab += 1) {
    await page.keyboard.press("Tab");
    // Native dialog may temporarily give browser chrome focus (activeElement=body),
    // but it must never allow a background page control to receive focus.
    expect(await dialog.evaluate((element) => document.activeElement === document.body || element.contains(document.activeElement))).toBe(true);
  }
  await page.keyboard.press("Escape");
  await expect(dialog).not.toBeVisible();
  await expect(trigger).toBeFocused();
});

for (const width of [390, 430, 768, 1440]) {
  test(`primary routes fit ${width}px and keyboard navigation works with reduced motion`, async ({ page }) => {
    await page.setViewportSize({ width, height: 932 });
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto("/");
    const navigation = page.getByRole("navigation", { name: "Primary" });
    for (const [name, route] of [["Learn", "/feed"], ["Analyze", "/analyze"], ["Bills", "/bills"], ["District", "/district"], ["Home", "/"]]) {
      const link = navigation.getByRole("link", { name, exact: true });
      await link.focus();
      await link.press("Enter");
      await expect(page).toHaveURL(new RegExp(`${route === "/" ? "/" : route}$`));
      await expect(link).toHaveAttribute("aria-current", "page");
      await expect(page.locator("main#main")).toBeVisible();
      expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width + 2);
    }
  });
}
