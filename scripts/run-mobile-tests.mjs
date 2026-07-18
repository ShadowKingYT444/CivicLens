import { existsSync } from "node:fs";
import { spawnSync } from "node:child_process";

const command = process.env.npm_execpath && existsSync(process.env.npm_execpath)
  ? process.execPath
  : process.platform === "win32"
    ? "pnpm"
    : "pnpm";
const commandPrefix = command === process.execPath ? [process.env.npm_execpath] : [];
const screenshotOnly = process.argv.includes("--screenshots");
const projects = ["mobile-390", "mobile-430"];
const fallbackPort = "3100";
const configuredBaseUrl = process.env.PLAYWRIGHT_BASE_URL?.trim();
const existingBaseUrl = configuredBaseUrl || (await findExistingBaseUrl());
const sharedPort = existingBaseUrl ? new URL(existingBaseUrl).port || "80" : fallbackPort;
const sharedBaseUrl = existingBaseUrl || `http://127.0.0.1:${sharedPort}`;

for (const project of projects) {
  const args = [
    ...commandPrefix,
    "exec",
    "playwright",
    "test",
    "tests/mobile-ui.spec.ts",
    `--project=${project}`,
    "--workers=1",
  ];

  if (screenshotOnly) {
    args.push("--grep", "screenshot");
  }

  const result = spawnSync(command, args, {
    stdio: "inherit",
    env: {
      ...process.env,
      PORT: sharedPort,
      PLAYWRIGHT_BASE_URL: sharedBaseUrl,
    },
  });
  if (result.error) {
    console.error(result.error.message);
  }
  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

async function findExistingBaseUrl() {
  for (const candidate of [
    "http://127.0.0.1:3100",
    "http://localhost:3100",
    "http://127.0.0.1:3000",
    "http://localhost:3000",
  ]) {
    if (await isCivicLens(candidate)) {
      return candidate;
    }
  }
  return "";
}

async function isCivicLens(url) {
  try {
    const response = await fetch(`${url}/api/health`, {
      signal: AbortSignal.timeout(800),
    });
    if (!response.ok) return false;
    const payload = await response.json();
    return (
      payload &&
      typeof payload === "object" &&
      typeof payload.ok === "boolean" &&
      typeof payload.mode === "string" &&
      typeof payload.timestamp === "string"
    );
  } catch {
    return false;
  }
}
