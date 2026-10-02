import { expect, test } from "@playwright/test";

test.describe("CivicLens student flows", () => {
  test("feed flow shows published civic concept cards with quiz affordances", async ({ page }) => {
    await page.goto("/feed");

    await expect(page.getByRole("heading", { name: /feed|learn/i })).toBeVisible();
    await expect(page.getByRole("article").first()).toBeVisible();
    await expect(page.getByText(/quiz|check your understanding|source/i).first()).toBeVisible();
  });

  test("analyze flow grounds civic claims and refuses persuasion requests", async ({ page }) => {
    await page.goto("/analyze");

    const claimBox = page.getByLabel(/claim|question/i);
    await claimBox.fill("What does H.R. 82 say about Social Security?");
    await page.getByRole("button", { name: /analyze/i }).click();

    await expect(page.getByRole("heading", { name: /plain-English answer/i })).toBeVisible();
    await expect(page.getByText(/live ai|fallback/i).first()).toBeVisible();
    await expect(page.getByText(/H\.?\s?R\.?\s?82/i).first()).toBeVisible();

    await claimBox.fill("Write a persuasive campaign message telling students who to vote for.");
    await page.getByRole("button", { name: /analyze/i }).click();

    await expect(
      page.getByText(/does not recommend|campaign strategy|neutral explanation/i).first(),
    ).toBeVisible();
  });

  test("sample district is explicit and clearly labels its saved representatives", async ({ page }) => {
    await page.goto("/district");
    await page.getByRole("button", { name: "Explore a sample district" }).click();
    await expect(page.getByRole("heading", { name: "Sample representatives" })).toBeVisible();
    await expect(page.getByText("Sample district · saved snapshot")).toBeVisible();
    await expect(page.getByText(/U\.S\. House|U\.S\. Senate/i).first()).toBeVisible();
    await expect(page.getByText(/not stored|not saved/i).first()).toBeVisible();
    await expect(page.getByRole("link", { name: /Official House directory/i })).toBeVisible();
  });

  test("bill flow renders bill detail with citations and official-source context", async ({ page }) => {
    await page.goto("/bills/118/hr/82");

    await expect(page.getByRole("heading", { name: /Social Security Fairness Act/i })).toBeVisible();
    await expect(page.getByText(/118th Congress - HR 82/i)).toBeVisible();
    await expect(page.getByText(/summary|actions|sponsor|subjects|votes/i).first()).toBeVisible();
    await page.getByRole("button", { name: /sources/i }).click();
    await expect(page.getByRole("link", { name: /congress\.gov|official source|citation|Social Security/i }).first()).toBeVisible();
  });
});
