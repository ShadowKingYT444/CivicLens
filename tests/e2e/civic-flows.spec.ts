import { expect, test } from "@playwright/test";

test.describe("CivicLens student flows", () => {
  test("feed flow shows published civic concept cards with quiz affordances", async ({
    page,
  }) => {
    await page.goto("/feed");

    const path = page.getByRole("listbox", { name: "CivicLens lesson path" });
    await expect(path).toBeVisible();
    await expect(path.getByRole("option").first()).toBeEnabled();
    await expect(path.getByRole("option").nth(1)).toBeDisabled();
    await expect(page.getByLabel("XP", { exact: true })).toContainText("0 XP");
  });

  test("analyze flow grounds civic claims and refuses persuasion requests", async ({
    page,
  }) => {
    await page.goto("/analyze");

    const claimBox = page.getByLabel(/claim|question/i);
    await claimBox.fill("What does H.R. 82 say about Social Security?");
    await page.getByRole("button", { name: /analyze/i }).click();

    await expect(
      page.getByRole("heading", { name: /plain-English answer/i }),
    ).toBeVisible();
    await expect(
      page.getByText(/live ai|fallback|demo answer/i).first(),
    ).toBeVisible();
    await expect(page.getByText(/H\.?\s?R\.?\s?82/i).first()).toBeVisible();

    await claimBox.fill(
      "Write a persuasive campaign message telling students who to vote for.",
    );
    await page.getByRole("button", { name: /analyze/i }).click();

    await expect(
      page
        .getByText(/does not recommend|campaign strategy|neutral explanation/i)
        .first(),
    ).toBeVisible();
  });

  test("district flow returns representatives without exposing raw address text", async ({
    page,
  }) => {
    await page.goto("/district");

    const address = "1600 Pennsylvania Ave NW, Washington, DC 20500";
    await page.getByLabel(/address/i).fill(address);
    await page
      .getByRole("button", { name: /find|look up|lookup|search/i })
      .click();

    await expect(
      page.getByRole("heading", { name: /District/i }).first(),
    ).toBeVisible();
    await expect(
      page.getByText(/Sample Representatives|Your Representatives/i),
    ).toBeVisible();
    await expect(
      page
        .getByText(
          /U\.S\. House|U\.S\. Senate|House of Representatives|Senate/i,
        )
        .first(),
    ).toBeVisible();
    await expect(
      page.getByText(/privacy|not stored|not saved/i).first(),
    ).toBeVisible();
    await expect(page.getByText(address)).toHaveCount(0);
  });

  test("bill flow renders bill detail with citations and official-source context", async ({
    page,
  }) => {
    await page.goto("/bills/118/hr/82");

    await expect(
      page.getByRole("heading", { name: /Social Security Fairness Act/i }),
    ).toBeVisible();
    await expect(page.getByText(/118th Congress/i).first()).toBeVisible();
    await expect(
      page.getByText(/summary|actions|sponsor|subjects|votes/i).first(),
    ).toBeVisible();
    await page.getByRole("button", { name: /sources/i }).click();
    await expect(
      page
        .getByRole("link", {
          name: /congress\.gov|official source|citation|Social Security/i,
        })
        .first(),
    ).toBeVisible();
  });
});
