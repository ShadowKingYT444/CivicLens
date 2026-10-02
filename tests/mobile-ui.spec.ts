import { mkdirSync } from "node:fs";
import { expect, test, type Page } from "@playwright/test";

async function openLesson(page: Page) {
  await page.goto("/feed");
  const path = page.getByRole("listbox", { name: "CivicLens lesson path" });
  await expect(path).toBeVisible();
  await path.focus();
  await page.keyboard.press("Enter");
  await expect(
    page.getByRole("button", { name: "Advance flashcard" }),
  ).toBeVisible();
}

async function reachQuiz(page: Page) {
  for (let step = 0; step < 12; step++) {
    const next = page.getByRole("button", {
      name: "Continue lesson",
      exact: true,
    });
    if (!(await next.count())) break;
    await next.click();
  }
  await expect(
    page.getByRole("heading", { name: "Quick check", exact: true }),
  ).toBeVisible();
}

test("mobile navigation reaches all main screens without overflow", async ({
  page,
}) => {
  await page.goto("/");
  const nav = page.getByRole("navigation", { name: "Primary navigation" });
  for (const label of ["Learn", "Bills", "District", "Analyze", "Home"]) {
    await nav.getByRole("link", { name: label, exact: true }).click();
    await expect(page.locator("main h1").first()).toBeVisible();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
  }
});

test("fresh learning path starts at zero and keeps later lessons locked", async ({
  page,
}) => {
  await page.goto("/feed");
  const options = page.getByRole("listbox").getByRole("option");
  await expect(options.first()).toBeEnabled();
  await expect(options.nth(1)).toBeDisabled();
  await expect(page.getByLabel("XP", { exact: true })).toContainText("0 XP");
});

test("lesson keyboard continuity, correct completion and progress persistence", async ({
  page,
  request,
}) => {
  const payload = await (await request.get("/api/feed")).json();
  const cards =
    payload.cards ?? payload.data ?? payload.feed ?? payload.items ?? payload;
  const raw = cards[0].quiz ?? cards[0].quizJson;
  const quiz = typeof raw === "string" ? JSON.parse(raw) : raw;
  const correct = quiz.correctIndex ?? quiz.answerIndex;
  await openLesson(page);
  const card = page.getByRole("button", { name: "Advance flashcard" });
  await card.focus();
  await page.keyboard.press("Enter");
  await expect(card).toBeFocused();
  await reachQuiz(page);
  const choices = page.locator(".editorial-answer");
  const complete = page.getByRole("button", {
    name: "Complete lesson",
    exact: true,
  });
  await choices.nth(correct === 0 ? 1 : 0).click();
  await expect(complete).toBeDisabled();
  await choices.nth(correct).click();
  await complete.click();
  await expect(
    page.getByRole("status").filter({ hasText: "Level complete" }),
  ).toContainText("+25 XP");
  await page.reload();
  await expect(page.getByLabel("XP", { exact: true })).toContainText("25 XP");
  await expect(page.getByRole("option").nth(1)).toBeEnabled();
  await page.getByRole("option").first().click();
  await reachQuiz(page);
  await choices.nth(correct).click();
  await complete.click();
  await expect(page.getByLabel("XP", { exact: true })).toContainText("25 XP");
});

test("one pointer swipe advances one flashcard", async ({ page }) => {
  await openLesson(page);
  const box = await page
    .getByRole("button", { name: "Advance flashcard" })
    .boundingBox();
  expect(box).toBeTruthy();
  await page.mouse.move(box!.x + box!.width * 0.8, box!.y + box!.height / 2);
  await page.mouse.down();
  await page.mouse.move(box!.x + box!.width * 0.2, box!.y + box!.height / 2, {
    steps: 12,
  });
  await page.mouse.up();
  await expect(page.locator(".editorial-reader-progress")).toHaveAttribute(
    "aria-valuenow",
    "2",
  );
});

test("bill search keeps text out of request URLs and sources trap focus", async ({
  page,
}) => {
  await page.goto("/bills");
  await page.getByLabel("Search bills").fill("H.R. 82");
  const search = page.waitForRequest(
    (req) => new URL(req.url()).pathname === "/api/search",
  );
  await page.getByLabel("Search bills").press("Enter");
  const sent = await search;
  expect(sent.method()).toBe("POST");
  expect(new URL(sent.url()).search).toBe("");
  await page
    .getByRole("link", { name: /Social Security Fairness Act/i })
    .first()
    .click();
  const trigger = page.getByRole("button", { name: /Sources/i });
  await trigger.click();
  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible();
  for (let step = 0; step < 8; step++) {
    await page.keyboard.press("Tab");
    expect(
      await dialog.evaluate((el) => el.contains(document.activeElement)),
    ).toBe(true);
  }
  await page.keyboard.press("Escape");
  await expect(dialog).not.toBeVisible();
  await expect(trigger).toBeFocused();
});

test("demo district is labeled beside its result and clears the address", async ({
  page,
}) => {
  await page.goto("/district");
  const address = page.getByLabel(/Address/i);
  await address.fill("1600 Pennsylvania Ave NW, Washington, DC 20500");
  await page.getByRole("button", { name: /Find|Look up|Search/i }).click();
  await expect(
    page.getByText("Sample result — not your district."),
  ).toBeVisible();
  await expect(address).toHaveValue("");
  await expect(
    page.getByText("Sample representatives", { exact: true }),
  ).toBeVisible();
});

test("clear cancels an interrupted analysis without a stale result", async ({
  page,
}) => {
  let release!: () => void;
  const hold = new Promise<void>((resolve) => {
    release = resolve;
  });
  await page.route("**/api/analyze", async (route) => {
    await hold;
    await route.continue().catch(() => {});
  });
  await page.goto("/analyze");
  await page.getByLabel(/Claim|Question/i).fill("What does H.R. 82 say?");
  await page.getByRole("button", { name: "Analyze", exact: true }).click();
  await page.getByRole("button", { name: "Clear text", exact: true }).click();
  release();
  await expect(page.getByLabel(/Claim|Question/i)).toHaveValue("");
  await expect(
    page.getByRole("heading", { name: "Plain-English answer", exact: true }),
  ).toHaveCount(0);
});

test("screenshot: main product screens remain usable with reduced motion", async ({
  page,
}, testInfo) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.setViewportSize({ width: 320, height: 740 });
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  mkdirSync("artifacts/playwright-mobile", { recursive: true });
  for (const [name, route] of [
    ["home", "/"],
    ["learn", "/feed"],
    ["bills", "/bills"],
    ["district", "/district"],
    ["analyze", "/analyze"],
  ]) {
    await page.goto(route);
    await expect(page.locator("main h1").first()).toBeVisible();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    await page.screenshot({
      path: `artifacts/playwright-mobile/${testInfo.project.name}-${name}-320.png`,
    });
  }
  expect(errors).toEqual([]);
});
