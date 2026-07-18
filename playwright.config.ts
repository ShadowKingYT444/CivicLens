import { defineConfig, devices } from "@playwright/test";

const port = Number(process.env.PORT ?? 3000);
const baseURL = process.env.PLAYWRIGHT_BASE_URL ?? `http://127.0.0.1:${port}`;

export default defineConfig({
  testDir: "./tests",
  outputDir: "test-results/playwright-artifacts",
  timeout: 30_000,
  expect: {
    timeout: 10_000
  },
  fullyParallel: true,
  workers: 1,
  retries: process.env.CI ? 2 : 0,
  reporter: process.env.CI ? [["html"], ["github"]] : [["list"], ["html", { open: "never" }]],
  use: {
    baseURL,
    trace: "on-first-retry",
    screenshot: "only-on-failure",
    video: "retain-on-failure"
  },
  webServer: {
    command: `pnpm dev --hostname 127.0.0.1 --port ${port}`,
    url: baseURL,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000
  },
  projects: [
    {
      name: "chromium",
      testMatch: "e2e/**/*.spec.ts",
      use: { ...devices["Desktop Chrome"] }
    },
    {
      name: "mobile-390",
      testMatch: "mobile-ui.spec.ts",
      use: {
        ...devices["Pixel 5"],
        viewport: { width: 390, height: 844 }
      }
    },
    {
      name: "mobile-430",
      testMatch: "mobile-ui.spec.ts",
      use: {
        ...devices["Pixel 5"],
        viewport: { width: 430, height: 932 }
      }
    }
  ]
});
