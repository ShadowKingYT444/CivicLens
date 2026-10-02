import { mkdirSync } from "node:fs";
import path from "node:path";
import {
  expect,
  test,
  type Locator,
  type Page,
  type TestInfo,
} from "@playwright/test";

const screenshotDir = path.join(
  process.cwd(),
  "artifacts",
  "playwright-mobile",
);
const learnFixtureCards = [
  {
    slug: "separation-of-powers",
    title: "Separation of Powers",
    hook: "Congress writes laws, the President carries them out, and courts decide legal disputes.",
    body: "Separation of powers asks which branch has legal authority before asking whether an idea sounds good.",
    category: "Constitutional Structure",
    difficulty: 1,
    sourceIds: ["source-pack-constitution"],
    quizJson: {
      question:
        "What is the best first question in a separation-of-powers dispute?",
      options: [
        "Which party benefits?",
        "Which branch has authority?",
        "Which headline is shortest?",
        "Which office is most popular?",
      ],
      correctIndex: 1,
      explanation:
        "Separation of powers focuses on the legal authority of each branch.",
    },
    orderIndex: 1,
    isPublished: true,
  },
  {
    slug: "checks-and-balances",
    title: "Checks and Balances",
    hook: "One branch can sometimes slow, review, approve, fund, or reject another branch's action.",
    body: "Checks and balances are tools, not magic reset buttons.",
    category: "Constitutional Structure",
    difficulty: 1,
    sourceIds: ["source-pack-constitution"],
    quizJson: {
      question: "Which example is a check on another branch?",
      options: [
        "A court reviews a challenged law",
        "A student posts an opinion",
        "A city opens a park",
        "A senator reads a newspaper",
      ],
      correctIndex: 0,
      explanation:
        "Judicial review can check government action by deciding whether it follows controlling law.",
    },
    orderIndex: 2,
    isPublished: true,
  },
  {
    slug: "federalism",
    title: "Federalism",
    hook: "National, state, and local governments often control different parts of the same problem.",
    body: "Federalism means policy responsibility is divided.",
    flashcards: [
      {
        id: "federalism-levels",
        eyebrow: "Map check",
        title: "Power is split by level",
        body: "Federalism means the national government, states, and local governments can each have different jobs.",
        visual: { branch: "federal-state-local", category: "Federalism" },
        citationIds: ["source-pack-constitution"],
        imageKey: "capitolPath",
        bullets: [
          "National rules can cover the whole country.",
          "State rules can vary by place.",
        ],
      },
      {
        id: "federalism-question",
        eyebrow: "Source move",
        title: "Ask who has authority",
        body: "Before judging a policy claim, identify which level of government is actually responsible.",
        visual: { branch: "federal-state-local", category: "Federalism" },
        citationIds: ["source-pack-constitution"],
        imageKey: "starCoin",
        bullets: [
          "Some powers are federal.",
          "Some powers are state or local.",
        ],
      },
      {
        id: "federalism-context",
        eyebrow: "Real-world clue",
        title: "Variation can be normal",
        body: "The same issue can look different across states because authority is divided.",
        visual: { branch: "federal-state-local", category: "Federalism" },
        citationIds: ["source-pack-constitution"],
        imageKey: "treasureChest",
      },
    ],
    category: "Federalism",
    difficulty: 1,
    sourceIds: ["source-pack-constitution"],
    quizJson: {
      question: "Why can the same policy issue vary by state?",
      options: [
        "States have no laws",
        "Federalism gives states authority over many areas",
        "Courts write all state budgets",
        "Congress runs every school board",
      ],
      correctIndex: 1,
      explanation:
        "Federalism leaves many policy areas to state or local governments.",
    },
    orderIndex: 3,
    isPublished: true,
  },
  {
    slug: "rights-need-context",
    title: "Rights Need Context",
    hook: "A rights claim is stronger when it names the government actor, the right, and the action.",
    body: "The Bill of Rights limits government power, but rights are not always absolute and usually need facts.",
    category: "Rights and Liberties",
    difficulty: 2,
    sourceIds: ["source-pack-bill-of-rights"],
    quizJson: {
      question:
        "What detail is usually needed for a constitutional rights claim?",
      options: [
        "A government action",
        "A celebrity opinion",
        "A campaign slogan",
        "A private rumor",
      ],
      correctIndex: 0,
      explanation:
        "Most constitutional rights claims require government action and a specific legal right.",
    },
    orderIndex: 4,
    isPublished: true,
  },
  {
    slug: "how-a-bill-becomes-law",
    title: "How a Bill Becomes Law",
    hook: "Introduction is only the start; law usually requires both chambers and presidential action.",
    body: "Most federal bills must pass the House and Senate in identical form before going to the President.",
    category: "Congress",
    difficulty: 1,
    sourceIds: ["source-pack-congress-bills"],
    quizJson: {
      question: "What does introduction alone prove about a bill?",
      options: [
        "It is already law",
        "It was formally proposed",
        "Both chambers passed it",
        "The President signed it",
      ],
      correctIndex: 1,
      explanation:
        "Introduction means a bill was formally proposed; it does not mean the bill became law.",
    },
    orderIndex: 5,
    isPublished: true,
  },
];

test.describe.configure({ mode: "default" });

async function gotoMobilePage(page: Page, route: string) {
  let lastError: unknown;

  for (let attempt = 0; attempt < 20; attempt += 1) {
    try {
      await page.goto(route, { waitUntil: "domcontentloaded" });
      await waitForMobileShell(page);
      return;
    } catch (error) {
      lastError = error;
      await page.waitForTimeout(750);
    }
  }

  throw lastError instanceof Error
    ? lastError
    : new Error(`Unable to load ${route}`);
}

async function waitForMobileShell(page: Page) {
  await page.locator("main#main").waitFor({ state: "visible" });
  await expect(page.locator(".mobile-bottom-nav")).toHaveCount(1);
  await expect(page.locator(".secondary-links")).toHaveCount(1);
}

async function expectNoHorizontalOverflow(page: Page) {
  const report = await page.evaluate(() => {
    const tolerance = 2;
    const viewportWidth = window.innerWidth;
    const documentWidth = Math.max(
      document.documentElement.scrollWidth,
      document.body.scrollWidth,
    );
    const isInsideHorizontalScroller = (element: HTMLElement) => {
      let parent = element.parentElement;
      while (
        parent &&
        parent !== document.body &&
        parent !== document.documentElement
      ) {
        const overflowX = window.getComputedStyle(parent).overflowX;
        if (["auto", "scroll", "hidden", "clip"].includes(overflowX))
          return true;
        parent = parent.parentElement;
      }
      return false;
    };

    const offenders = Array.from(
      document.body.querySelectorAll<HTMLElement>("*"),
    )
      .filter((element) => {
        if (isInsideHorizontalScroller(element)) return false;
        const style = window.getComputedStyle(element);
        if (style.display === "none" || style.visibility === "hidden")
          return false;
        const rect = element.getBoundingClientRect();
        if (rect.width === 0 || rect.height === 0) return false;
        return rect.left < -tolerance || rect.right > viewportWidth + tolerance;
      })
      .slice(0, 8)
      .map((element) => {
        const rect = element.getBoundingClientRect();
        const className =
          typeof element.className === "string" &&
          element.className.trim().length > 0
            ? `.${element.className.trim().split(/\s+/).slice(0, 3).join(".")}`
            : "";
        const id = element.id ? `#${element.id}` : "";
        const text = (
          element.getAttribute("aria-label") ??
          element.textContent ??
          ""
        )
          .trim()
          .replace(/\s+/g, " ");
        return `${element.tagName.toLowerCase()}${id}${className} ${Math.round(rect.left)}..${Math.round(
          rect.right,
        )} ${text.slice(0, 48)}`;
      });

    return { documentWidth, offenders, viewportWidth };
  });

  expect(
    report.documentWidth,
    JSON.stringify(report, null, 2),
  ).toBeLessThanOrEqual(report.viewportWidth + 2);
  expect(report.offenders, JSON.stringify(report, null, 2)).toEqual([]);
}

async function expectBottomNavClear(page: Page) {
  await page.evaluate(() =>
    window.scrollTo(0, document.documentElement.scrollHeight),
  );
  await page.waitForTimeout(100);

  const report = await page.evaluate(() => {
    const nav = document.querySelector<HTMLElement>(".mobile-bottom-nav");
    const main = document.querySelector<HTMLElement>("main#main");
    if (!nav || !main) return { covered: ["missing mobile shell"], navTop: 0 };

    const navRect = nav.getBoundingClientRect();
    const isClippedByScrollableAncestor = (element: HTMLElement) => {
      const rect = element.getBoundingClientRect();
      let parent = element.parentElement;

      while (
        parent &&
        parent !== document.body &&
        parent !== document.documentElement
      ) {
        // Closed native details can retain layout rectangles for unpainted
        // descendants. Their summaries remain visible and are still audited.
        if (parent instanceof HTMLDetailsElement && !parent.open &&
            !parent.querySelector(":scope > summary")?.contains(element)) return true;
        const parentStyle = window.getComputedStyle(parent);
        const clipsVertically = ["auto", "scroll", "hidden", "clip"].includes(
          parentStyle.overflowY,
        );
        if (clipsVertically) {
          const parentRect = parent.getBoundingClientRect();
          if (rect.bottom > parentRect.bottom || rect.top < parentRect.top)
            return true;
        }
        parent = parent.parentElement;
      }

      return false;
    };
    const candidates = [
      ...main.querySelectorAll<HTMLElement>(
        "a,button,input,textarea,select,[role='button'],[role='link'],h1,h2,h3,h4,p,li,dt,dd",
      ),
      ...document.querySelectorAll<HTMLElement>(".secondary-links a"),
    ];

    const covered = candidates
      .filter((element) => {
        const style = window.getComputedStyle(element);
        if (style.display === "none" || style.visibility === "hidden")
          return false;
        if (isClippedByScrollableAncestor(element)) return false;
        const rect = element.getBoundingClientRect();
        if (rect.width === 0 || rect.height === 0) return false;
        return rect.bottom > navRect.top + 1 && rect.top < navRect.bottom - 1;
      })
      .slice(0, 8)
      .map((element) => {
        const rect = element.getBoundingClientRect();
        const text = (
          element.getAttribute("aria-label") ??
          element.textContent ??
          ""
        )
          .trim()
          .replace(/\s+/g, " ");
        return `${element.tagName.toLowerCase()} ${Math.round(rect.top)}..${Math.round(rect.bottom)} ${text.slice(
          0,
          60,
        )}`;
      });

    return { covered, navTop: Math.round(navRect.top) };
  });

  expect(
    report.covered,
    `Bottom nav top ${report.navTop}; covered content: ${report.covered.join(" | ")}`,
  ).toEqual([]);
}

async function expectNoInteractiveOverlap(page: Page) {
  const report = await page.evaluate(() => {
    const isClippedByScrollableAncestor = (element: HTMLElement) => {
      const rect = element.getBoundingClientRect();
      let parent = element.parentElement;

      while (
        parent &&
        parent !== document.body &&
        parent !== document.documentElement
      ) {
        // Closed native details can retain layout rectangles for unpainted
        // descendants. Their summaries remain visible and are still audited.
        if (parent instanceof HTMLDetailsElement && !parent.open &&
            !parent.querySelector(":scope > summary")?.contains(element)) return true;
        const parentStyle = window.getComputedStyle(parent);
        const clipsVertically = ["auto", "scroll", "hidden", "clip"].includes(
          parentStyle.overflowY,
        );
        if (clipsVertically) {
          const parentRect = parent.getBoundingClientRect();
          if (rect.bottom > parentRect.bottom || rect.top < parentRect.top)
            return true;
        }
        parent = parent.parentElement;
      }

      return false;
    };
    const selectors = [
      "main#main a[href]",
      "main#main button",
      "main#main input",
      "main#main textarea",
      "main#main select",
      ".mobile-bottom-nav a[href]",
    ].join(",");
    const viewportHeight = window.innerHeight;
    const visible = Array.from(
      document.querySelectorAll<HTMLElement>(selectors),
    )
      .filter((element) => {
        const style = window.getComputedStyle(element);
        const rect = element.getBoundingClientRect();
        return (
          style.display !== "none" &&
          style.visibility !== "hidden" &&
          !isClippedByScrollableAncestor(element) &&
          rect.width > 0 &&
          rect.height > 0 &&
          rect.bottom >= 0 &&
          rect.top <= viewportHeight
        );
      })
      .map((element, index) => {
        const rect = element.getBoundingClientRect();
        const text = (
          element.getAttribute("aria-label") ??
          element.textContent ??
          ""
        )
          .trim()
          .replace(/\s+/g, " ");
        return {
          index,
          label: `${element.tagName.toLowerCase()} ${text.slice(0, 42)}`,
          left: rect.left,
          right: rect.right,
          top: rect.top,
          bottom: rect.bottom,
        };
      });

    const overlaps: string[] = [];
    for (let i = 0; i < visible.length; i += 1) {
      for (let j = i + 1; j < visible.length; j += 1) {
        const first = visible[i];
        const second = visible[j];
        const width =
          Math.min(first.right, second.right) -
          Math.max(first.left, second.left);
        const height =
          Math.min(first.bottom, second.bottom) -
          Math.max(first.top, second.top);
        if (width > 2 && height > 2) {
          overlaps.push(`${first.label} overlaps ${second.label}`);
        }
      }
    }

    return { count: visible.length, overlaps };
  });

  expect(report.overlaps, JSON.stringify(report, null, 2)).toEqual([]);
}

async function fillClaimForSubmit(page: Page, claim: string) {
  const claimBox = page.getByLabel(/claim|question/i);
  const analyzeButton = page.getByRole("button", { name: /analyze/i });
  const hydrationGate = page.getByRole("button", { name: /School lunches/i });

  await expect(claimBox).toBeEditable();
  for (let attempt = 0; attempt < 4; attempt += 1) {
    await hydrationGate.click();
    try {
      await expect(analyzeButton).toBeEnabled({ timeout: 2_500 });
      break;
    } catch {
      await page.waitForTimeout(250);
    }
  }

  await expect(analyzeButton).toBeEnabled();
  await setReactControlledValue(claimBox, claim);
  await expect(analyzeButton).toBeEnabled();
  await analyzeButton.evaluate((element) =>
    element.scrollIntoView({ block: "center", inline: "nearest" }),
  );
  await page.waitForTimeout(100);
}

async function setReactControlledValue(field: Locator, value: string) {
  await field.evaluate((element, nextValue) => {
    const prototype =
      element instanceof HTMLTextAreaElement
        ? HTMLTextAreaElement.prototype
        : HTMLInputElement.prototype;
    const valueSetter = Object.getOwnPropertyDescriptor(
      prototype,
      "value",
    )?.set;
    valueSetter?.call(element, nextValue);
    element.dispatchEvent(new Event("input", { bubbles: true }));
    element.dispatchEvent(new Event("change", { bubbles: true }));
  }, value);
  await expect(field).toHaveValue(value);
}

async function lookUpDistrict(page: Page, address: string) {
  const addressInput = page.getByLabel(/street address/i);
  const lookupButton = page.getByRole("button", { name: /look up district/i });
  const districtHeading = page
    .getByRole("heading", { name: /District/i })
    .first();

  await expect(addressInput).toBeEditable();
  for (let attempt = 0; attempt < 4; attempt += 1) {
    await addressInput.click();
    await addressInput.press("ControlOrMeta+A");
    await addressInput.press("Backspace");
    await addressInput.pressSequentially(address, { delay: 1 });
    await expect(addressInput).toHaveValue(address);
    await page.waitForTimeout(50);
    await lookupButton.click();
    try {
      await expect(districtHeading).toBeVisible({ timeout: 3_000 });
      return districtHeading;
    } catch {
      await page.waitForTimeout(250);
    }
  }

  await expect(districtHeading).toBeVisible();
  return districtHeading;
}

async function mockDistrictLookup(page: Page) {
  await page.route("**/api/district/lookup", async (route) => {
    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({
        status: "demo",
        matchedAddress: "1600 PENNSYLVANIA AVE NW, WASHINGTON, DC, 20500",
        stateCode: "CA",
        district: "12",
        houseMembers: [
          { fullName: "Riley House", party: "Independent", state: "CA" },
        ],
        senators: [
          { fullName: "Sam Senate", party: "Independent", state: "CA" },
          { fullName: "Jordan Senate", party: "Independent", state: "CA" },
        ],
        privacyNote:
          "The raw address is used only for this lookup and is not stored, logged, or sent to an LLM.",
      }),
    });
  });
}

async function mockAnalyzeClaim(
  page: Page,
  options: { delayMs?: number } = {},
) {
  await page.route("**/api/analyze", async (route) => {
    if (options.delayMs) await page.waitForTimeout(options.delayMs);

    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({
        mode: "live",
        result: {
          status: "answered",
          evidenceStatus: "grounded",
          normalizedClaim: "What does H.R. 82 say about Social Security?",
          truthVerdict: "true",
          verdictSummary:
            "True — the official records support the claim about H.R. 82.",
          claimChecks: [
            {
              claim:
                "H.R. 82 repealed two Social Security benefit-offset rules.",
              verdict: "true",
              explanation:
                "The cited official bill record describes repeal of both offset rules.",
              citationIds: ["hr82-congress"],
            },
          ],
          oneSentenceAnswer:
            "H.R. 82 repealed two Social Security benefit-offset rules and official records list it as Public Law 118-273.",
          studentExplanation:
            "Congress.gov and GovInfo are the cited sources for this demo answer; CivicLens does not add facts beyond those excerpts.",
          keyContext: [
            "Congress.gov identifies H.R. 82 as the Social Security Fairness Act.",
          ],
          whatOfficialSourcesSay: [
            "The bill record and public law text describe repeal of the offset rules.",
          ],
          contextGaps: [
            "The demo answer does not estimate individual benefit changes.",
          ],
          framingFlags: [],
          quiz: {
            question: "Which source should support a claim about H.R. 82?",
            options: [
              "A campaign ad",
              "Congress.gov or GovInfo",
              "A random comment",
            ],
            correctIndex: 1,
            explanation:
              "Official bill records and public law text are appropriate sources.",
          },
        },
        citations: [
          {
            id: "hr82-congress",
            sourceType: "congress",
            title: "Congress.gov H.R. 82",
            url: "https://www.congress.gov/bill/118th-congress/house-bill/82",
            excerpt:
              "Congress.gov identifies H.R. 82 as the Social Security Fairness Act.",
            bill: { congress: 118, type: "hr", number: "82" },
          },
        ],
        relatedBills: [
          {
            congress: 118,
            type: "hr",
            number: "82",
            title: "Social Security Fairness Act",
          },
        ],
      }),
    });
  });
}

async function mockBillDetail(page: Page) {
  await page.route("**/api/bills/119/hr/1", async (route) => {
    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({
        bill: {
          congress: 119,
          type: "hr",
          number: "1",
          title: "Reconciliation Act, Public Law 119-21",
          simpleTitle: "Reconciliation Act, Public Law 119-21",
          oneLineSummary:
            "Changes taxes, spending, and the statutory debt limit across federal programs.",
          inSimpleWords:
            "The bill is a budget reconciliation law that packages several tax, spending, and debt-limit changes.",
          whatChanges:
            "Tax rules, federal spending provisions, and debt-limit rules changed.",
          whoIsAffected:
            "Students should inspect official summaries before assuming who is affected.",
          currentStatus: "Public Law 119-21",
          stage: "law",
          subjects: ["Federal budget", "Taxes", "Debt limit"],
          actions: [
            {
              date: "2025-07-04",
              text: "Became Public Law No. 119-21.",
            },
          ],
          citations: [
            {
              id: "hr1-public-law",
              sourceType: "congress",
              title: "Congress.gov H.R. 1",
              url: "https://www.congress.gov/bill/119th-congress/house-bill/1",
              excerpt: "Congress.gov lists H.R. 1 as Public Law No. 119-21.",
            },
          ],
        },
      }),
    });
  });

  await page.route("**/api/bills/118/hr/82", async (route) => {
    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({
        bill: {
          congress: 118,
          type: "hr",
          number: "82",
          title: "Social Security Fairness Act",
          simpleTitle: "Social Security Fairness Act",
          oneLineSummary:
            "Repeals the government pension offset and windfall elimination provisions for Social Security.",
          inSimpleWords:
            "The bill changes how Social Security benefits are calculated for some people with public pensions.",
          whatChanges: "Two benefit-offset rules are repealed.",
          whoIsAffected:
            "Some public-sector retirees and their families may be affected.",
          currentStatus: "Public Law 118-273",
          stage: "law",
          subjects: ["Social Security", "Public pensions"],
          actions: [
            {
              date: "2025-01-05",
              text: "Became Public Law No: 118-273.",
            },
          ],
          citations: [
            {
              id: "hr82-public-law",
              sourceType: "govinfo",
              title: "Public Law 118-273",
              url: "https://www.govinfo.gov/",
              excerpt:
                "Official public law text for the Social Security Fairness Act.",
            },
          ],
        },
      }),
    });
  });
}

async function mockRecentBillsFallback(page: Page) {
  await page.route("**/api/bills/recent", async (route) => {
    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({
        mode: "fixture",
        congress: 118,
        results: [],
      }),
    });
  });
}

async function mockLearnFeed(page: Page) {
  await page.route("**/api/feed", async (route) => {
    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({ data: learnFixtureCards, mode: "demo" }),
    });
  });

  await page.route("**/api/quiz/attempt", async (route) => {
    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({ recorded: false, mode: "demo" }),
    });
  });
}

async function screenshot(
  page: Page,
  testInfo: TestInfo,
  name: string,
  options: { resetScroll?: boolean } = {},
) {
  const viewport = page.viewportSize();
  if (!viewport)
    throw new Error("Mobile screenshot tests require a fixed viewport.");
  const viewportName = `${viewport.width}x${viewport.height}`;
  const resetScroll = options.resetScroll ?? true;

  mkdirSync(screenshotDir, { recursive: true });
  if (resetScroll) await page.evaluate(() => window.scrollTo(0, 0));
  await page.addStyleTag({
    content:
      "nextjs-portal { display: none !important; pointer-events: none !important; }",
  });
  await page.screenshot({
    path: path.join(
      screenshotDir,
      `${viewportName}-${testInfo.project.name}-${name}.png`,
    ),
    caret: "initial",
    fullPage: false,
  });
}

async function verifyMobileLayout(page: Page) {
  await expectNoHorizontalOverflow(page);
  await expectBottomNavClear(page);
  await expectNoInteractiveOverlap(page);
}

test.describe("mobile CivicLens UI", () => {
  test("home mobile screenshot", async ({ page }) => {
    await gotoMobilePage(page, "/");
    await expect(page.getByText("CivicLens").first()).toBeVisible();
    await expect(
      page
        .locator("main#main")
        .getByRole("link", { name: /^learn\b/i })
        .first(),
    ).toBeVisible();
    await screenshot(page, test.info(), "home");
    await verifyMobileLayout(page);
  });

  test("home quick claim is typeable and hands off without URL storage", async ({
    page,
  }) => {
    const claim = "Gas prices rose because of one president alone.";
    await gotoMobilePage(page, "/");
    await page.locator("#home-claim").fill(claim);

    await Promise.all([
      page.waitForURL((url) => url.pathname === "/analyze"),
      page.getByRole("button", { name: /analyze typed claim/i }).click(),
    ]);

    await expect(page.locator("#claim")).toHaveValue(claim);
    expect(new URL(page.url()).search).toBe("");
    await verifyMobileLayout(page);
  });

  test("preview route stays full-width on mobile", async ({ page }) => {
    await gotoMobilePage(page, "/preview");
    const primaryNav = page.getByRole("navigation", { name: /primary/i });

    await expect(page.getByText("CivicLens").first()).toBeVisible();
    await expect(
      primaryNav.getByRole("link", { name: "Home" }),
    ).toHaveAttribute("aria-current", "page");
    await expect(primaryNav.getByRole("link", { name: "Learn" })).toBeVisible();
    await expect(
      primaryNav.getByRole("link", { name: "Analyze" }),
    ).toBeVisible();
    await expect(primaryNav.getByRole("link", { name: "Bills" })).toBeVisible();
    await expect(
      primaryNav.getByRole("link", { name: "District" }),
    ).toBeVisible();
    await expect(page.locator(".preview-phone-frame")).toBeHidden();
    await verifyMobileLayout(page);
  });

  test("learn map and lesson flow screenshot", async ({ page }) => {
    await mockLearnFeed(page);
    await gotoMobilePage(page, "/feed");
    const path = page.getByRole("listbox", { name: /CivicLens lesson path/i });
    const first = page.getByRole("option", { name: /Level 1: Separation of Powers/i });
    const second = page.getByRole("option", { name: /Level 2: Checks and Balances/i });
    await expect(page.getByAltText("CivicLens")).toBeVisible();
    await expect(page.getByRole("heading", { name: "Separation of Powers" })).toBeVisible();
    await expect(page.getByText("0 XP", { exact: true })).toBeVisible();
    await expect(path.getByRole("option")).toHaveCount(learnFixtureCards.length);
    await expect(first).not.toHaveClass(/complete/);
    await expect(first).toHaveAttribute("aria-selected", "true");
    await expect(second).toBeDisabled();
    await screenshot(page, test.info(), "learn-map");
    await verifyMobileLayout(page);

    await path.focus();
    await path.press("ArrowRight");
    await expect(first).toHaveAttribute("aria-selected", "true");
    await path.press("Enter");
    await expect(page.getByRole("article", { name: /Separation of Powers lesson/i })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Learn the idea" })).toBeVisible();
    await expect(page.getByRole("button", { name: /Advance flashcard/i })).toContainText("Congress writes laws");
    await screenshot(page, test.info(), "learn-lesson-flow");
    await verifyMobileLayout(page);
    await page.getByRole("button", { name: /Continue lesson/i }).click();
    await expect(page.getByRole("heading", { name: "Quick check" })).toBeVisible();
    await expect(page.getByRole("button", { name: /Complete lesson/i })).toBeDisabled();
    await screenshot(page, test.info(), "learn-quiz-ready");
    await page.getByRole("button", { name: "Which party benefits?" }).click();
    await expect(page.getByText(/^Not quite/)).toBeVisible();
    await expect(page.getByRole("button", { name: /Complete lesson/i })).toBeDisabled();
    await expect(page.getByRole("button", { name: "Which branch has authority?" })).toBeDisabled();
    await screenshot(page, test.info(), "learn-quiz-wrong");
    await verifyMobileLayout(page);
    await page.getByRole("button", { name: "Try again" }).click();
    await page.getByRole("button", { name: "Which branch has authority?" }).click();
    await expect(page.getByText(/^Correct/)).toBeVisible();
    await screenshot(page, test.info(), "learn-quiz-correct");
    await page.getByRole("button", { name: /Complete lesson/i }).click();
    await expect(page.getByRole("heading", { name: "Lesson complete" })).toBeVisible();
    await expect(page.getByText("+25 XP", { exact: true })).toBeVisible();
    await screenshot(page, test.info(), "learn-complete");
    await page.getByRole("button", { name: "Back to path" }).click();
    await expect(first).toHaveClass(/complete/);
    await expect(second).toBeEnabled();
    await expect(second).toHaveAttribute("aria-selected", "true");
    await expect(page.getByText("25 XP", { exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: /Review missed concepts/ })).toBeVisible();
    await page.reload();
    await expect(second).toBeEnabled();
    await expect(page.getByText("25 XP", { exact: true })).toBeVisible();
  });

  test("analyze initial screenshot", async ({ page }) => {
    await gotoMobilePage(page, "/analyze");
    await expect(
      page.getByRole("heading", { name: /ask about a bill or claim/i }),
    ).toBeVisible();
    await expect(page.getByRole("button", { name: /analyze/i })).toBeVisible();
    await screenshot(page, test.info(), "analyze-initial");
    await verifyMobileLayout(page);
  });

  test("analyze shows source-checking state while waiting for a result", async ({
    page,
  }) => {
    await mockAnalyzeClaim(page, { delayMs: 1_200 });
    await gotoMobilePage(page, "/analyze");
    const analyzeButton = page.getByRole("button", { name: /analyze/i });

    await fillClaimForSubmit(
      page,
      "What does H.R. 82 say about Social Security?",
    );
    await analyzeButton.click();

    await expect(
      page.locator(".analyze-simple-result[aria-busy='true']"),
    ).toBeVisible();
    await expect(page.locator(".analyze-simple-input")).toHaveClass(
      /is-checking/,
    );
    await expect(page.getByText(/Reading sources/i)).toBeVisible();
    await expect(page.getByText(/Retrieving source context/i)).toBeVisible();
    await expect(
      page.getByRole("heading", { name: /plain-English answer/i }),
    ).toBeVisible();
    await verifyMobileLayout(page);
  });

  test("analyze result screenshot using demo mode", async ({ page }) => {
    await mockAnalyzeClaim(page);
    await gotoMobilePage(page, "/analyze");
    const analyzeButton = page.getByRole("button", { name: /analyze/i });
    await fillClaimForSubmit(
      page,
      "What does H.R. 82 say about Social Security?",
    );
    await analyzeButton.click();
    const resultHeading = page.getByRole("heading", {
      name: /plain-English answer/i,
    });
    await expect(resultHeading).toBeVisible();
    await expect(page.getByText(/live ai|fallback/i).first()).toBeVisible();
    await expect(page.getByText(/source/i).first()).toBeVisible();
    await expect(page.getByRole("link", { name: /View HR 82/i })).toBeVisible();
    await resultHeading.evaluate((element) =>
      element.scrollIntoView({ block: "start" }),
    );
    await page.waitForTimeout(100);
    await screenshot(page, test.info(), "analyze-result", {
      resetScroll: false,
    });
    await verifyMobileLayout(page);
  });

  test("bills list mobile screenshot", async ({ page }) => {
    const recentBillsResponse = page
      .waitForResponse(
        (response) =>
          response.url().includes("/api/bills/recent") && response.ok(),
      )
      .catch(() => null);
    await gotoMobilePage(page, "/bills");
    await recentBillsResponse;
    await expect(
      page.getByRole("region", { name: /bills made simple/i }),
    ).toBeVisible();
    await expect(
      page.getByRole("heading", { name: /bill feed/i }),
    ).toBeVisible();
    await expect(
      page.getByText(/Learn\. Understand\. Check sources\./i),
    ).toBeVisible();
    await expect(
      page.getByText(
        /Curated historical bills|Recent high-impact bills from Congress.gov/i,
      ),
    ).toBeVisible();
    await expect(page.getByLabel(/trending bill flashcards/i)).toBeVisible();
    await expect(
      page.getByRole("region", { name: /Bill 1 of/i }),
    ).toBeVisible();
    await expect(
      page.getByRole("navigation", { name: /bill deck controls/i }),
    ).toBeVisible();
    const firstBillCard = page
      .getByRole("region", { name: /Bill 1 of \d+:/i })
      .first();
    await expect(
      firstBillCard.getByRole("article", { name: /information slides/i }),
    ).toBeVisible();
    await expect(
      firstBillCard.getByRole("button", { name: /next bill info slide/i }),
    ).toBeVisible();

    await firstBillCard
      .getByRole("button", { name: /Show Why it matters/i })
      .click();
    await expect(
      firstBillCard.getByRole("heading", { name: "Why it matters" }),
    ).toBeVisible();
    await firstBillCard
      .getByRole("button", { name: /Show Source and status/i })
      .click();
    await expect(
      firstBillCard.getByRole("heading", { name: "Source & status" }),
    ).toBeVisible();
    await expect(
      firstBillCard.getByRole("button", { name: /source details/i }),
    ).toBeVisible();
    await screenshot(page, test.info(), "bills-list");
    await verifyMobileLayout(page);
  });

  test("bills deck horizontal slides explain a bill without navigating away", async ({
    page,
  }) => {
    await mockRecentBillsFallback(page);
    await gotoMobilePage(page, "/bills");

    const firstBillCard = page
      .getByRole("region", { name: /Bill 1 of \d+:/i })
      .first();
    await expect(firstBillCard).toBeVisible();
    await expect(
      firstBillCard.getByRole("link", { name: /open details for/i }),
    ).toHaveCount(0);
    await firstBillCard
      .getByRole("button", { name: /Show What changes/i })
      .click();
    await expect(
      firstBillCard.getByRole("heading", { name: "What changes" }),
    ).toBeVisible();
    await firstBillCard
      .getByRole("button", { name: /Show Who it affects/i })
      .click();
    await expect(
      firstBillCard.getByRole("list", { name: /affected groups to watch/i }),
    ).toBeVisible();
    await firstBillCard
      .getByRole("button", { name: /Show Key takeaways/i })
      .click();
    await expect(
      firstBillCard.getByRole("list", { name: /key points/i }),
    ).toBeVisible();
    expect(new URL(page.url()).pathname).toBe("/bills");
    await screenshot(page, test.info(), "bills-slides-no-detail-clickthrough");
    await verifyMobileLayout(page);
  });

  test("bills slide arrows move between bill detail pages", async ({
    page,
  }) => {
    await gotoMobilePage(page, "/bills");
    const firstBillCard = page
      .getByRole("region", { name: /Bill 1 of \d+:/i })
      .first();
    const nextSlide = firstBillCard.getByRole("button", {
      name: /next bill info slide/i,
    });
    const previousSlide = firstBillCard.getByRole("button", {
      name: /previous bill info slide/i,
    });

    await expect(previousSlide).toBeDisabled();
    await nextSlide.click();
    await expect(
      firstBillCard.getByRole("heading", { name: "Why it matters" }),
    ).toBeVisible();
    await expect(previousSlide).toBeEnabled();
    await nextSlide.click();
    await expect(
      firstBillCard.getByRole("heading", { name: "What changes" }),
    ).toBeVisible();
    await previousSlide.click();
    await expect(
      firstBillCard.getByRole("heading", { name: "Why it matters" }),
    ).toBeVisible();
    await verifyMobileLayout(page);
  });

  test("bill detail mobile screenshot", async ({ page }) => {
    await mockBillDetail(page);
    await gotoMobilePage(page, "/bills/118/hr/82");
    await expect(
      page.getByRole("heading", { name: /Social Security Fairness Act/i }),
    ).toBeVisible();
    await expect(page.getByText(/118th Congress/i).first()).toBeVisible();
    const whatChanges = page
      .locator("details.bill-action-card")
      .filter({ hasText: "What changes" });
    await whatChanges.getByText("What changes").click();
    await expect(whatChanges.getByText(/cited records/i)).toBeVisible();
    await expect(
      page.getByRole("button", { name: /open source drawer/i }),
    ).toBeVisible();
    await screenshot(page, test.info(), "bill-detail");
    await verifyMobileLayout(page);
  });

  test("district mobile screenshot", async ({ page }) => {
    await mockDistrictLookup(page);
    await gotoMobilePage(page, "/district");
    const districtHeading = await lookUpDistrict(
      page,
      "1600 Pennsylvania Ave NW, Washington, DC 20500",
    );
    await expect(
      page.getByText(/privacy|store your address|used only/i).first(),
    ).toBeVisible();
    await districtHeading.evaluate((element) =>
      element.scrollIntoView({ block: "start" }),
    );
    await page.waitForTimeout(100);
    await screenshot(page, test.info(), "district", { resetScroll: false });
    await verifyMobileLayout(page);
  });

  test("district representatives keep avatars, labels, location, and address privacy", async ({
    page,
  }) => {
    const rawAddress = "1600 Pennsylvania Ave NW, Washington, DC 20500";
    await mockDistrictLookup(page);
    await gotoMobilePage(page, "/district");
    await lookUpDistrict(page, rawAddress);

    await expect(
      page.getByRole("heading", { name: "CA District 12" }),
    ).toBeVisible();
    await expect(
      page.locator(".district-hero-card").getByText("CA", { exact: true }),
    ).toBeVisible();
    await expect(page.locator(".district-hero-card svg")).toHaveCount(2);
    await expect(page.locator(".representative-avatar")).toHaveCount(3);
    await expect(page.locator(".representative-avatar").nth(0)).toHaveText(
      "RH",
    );
    await expect(
      page.getByRole("heading", { name: "Riley House" }),
    ).toBeVisible();
    await expect(page.getByText("U.S. House - Independent - CA")).toBeVisible();
    await expect(page.getByText("CA-12")).toBeVisible();
    await expect(
      page.getByRole("heading", { name: "Sam Senate" }),
    ).toBeVisible();
    await expect(
      page.getByRole("heading", { name: "Jordan Senate" }),
    ).toBeVisible();
    await expect(page.getByText("U.S. Senate - Independent - CA")).toHaveCount(
      2,
    );
    await expect(page.getByText(rawAddress)).toHaveCount(0);

    await screenshot(page, test.info(), "district-representatives");
    await verifyMobileLayout(page);
  });

  test("district use my location sends coordinates without raw address", async ({
    page,
    context,
    baseURL,
  }) => {
    const origin = new URL(baseURL ?? "http://127.0.0.1:3100").origin;
    await context.grantPermissions(["geolocation"], { origin });
    await context.setGeolocation({ latitude: 38.8977, longitude: -77.0365 });
    let requestPayload: unknown;

    await page.route("**/api/district/lookup", async (route) => {
      requestPayload = route.request().postDataJSON();
      await route.fulfill({
        contentType: "application/json",
        body: JSON.stringify({
          status: "matched",
          stateCode: "DC",
          district: "0",
          coordinates: { latitude: 38.8977, longitude: -77.0365 },
          houseMembers: [
            { fullName: "Delegate Example", party: "Independent", state: "DC" },
          ],
          senators: [],
          privacyNote:
            "Coordinates are used only for this lookup and are not stored, logged, or sent to an LLM.",
        }),
      });
    });

    await gotoMobilePage(page, "/district");
    await page.getByRole("button", { name: /use my location/i }).click();
    await expect(
      page.getByRole("heading", { name: "DC District 0" }),
    ).toBeVisible();

    expect(requestPayload).toMatchObject({
      latitude: 38.8977,
      longitude: -77.0365,
    });
    expect(JSON.stringify(requestPayload)).not.toContain("address");
    await verifyMobileLayout(page);
  });

  test("bottom nav works", async ({ page }) => {
    await gotoMobilePage(page, "/");
    const targets = [
      ["Learn", "/feed"],
      ["Analyze", "/analyze"],
      ["Bills", "/bills"],
      ["District", "/district"],
      ["Home", "/"],
    ] as const;

    for (const [name, pathname] of targets) {
      const link = page
        .getByRole("navigation", { name: /primary/i })
        .getByRole("link", { name });
      await link.focus();
      await Promise.all([
        page.waitForURL((url) => url.pathname === pathname),
        link.press("Enter"),
      ]);
      await expect(
        page
          .getByRole("navigation", { name: /primary/i })
          .getByRole("link", { name }),
      ).toHaveAttribute("aria-current", "page");
      await waitForMobileShell(page);
      await expectNoHorizontalOverflow(page);
    }
  });

  test("primary CTAs are visible at mobile widths", async ({ page }) => {
    await gotoMobilePage(page, "/");
    await expect(
      page
        .locator("main#main")
        .getByRole("link", { name: /^learn\b/i })
        .first(),
    ).toBeVisible();
    await gotoMobilePage(page, "/analyze");
    await expect(page.getByRole("button", { name: /analyze/i })).toBeVisible();
    await gotoMobilePage(page, "/bills");
    await expect(
      page.getByRole("button", { name: /search bills/i }),
    ).toBeVisible();
    await gotoMobilePage(page, "/district");
    await expect(
      page.getByRole("button", { name: /look up district/i }),
    ).toBeVisible();
    await expectNoHorizontalOverflow(page);
  });
});
