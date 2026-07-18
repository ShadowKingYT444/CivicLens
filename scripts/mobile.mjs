import { spawn, spawnSync } from "node:child_process";
import { existsSync, readdirSync } from "node:fs";
import { mkdir, writeFile } from "node:fs/promises";
import net from "node:net";
import { dirname, join, resolve } from "node:path";
import { setTimeout as delay } from "node:timers/promises";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const artifactsDir = join(root, "artifacts", "mobile");
const port = Number(process.env.MOBILE_PORT || 3100);
const baseUrl = `http://127.0.0.1:${port}`;
const rawArgs = process.argv.slice(2).filter((arg) => arg !== "--");
const command = rawArgs.shift();

process.chdir(root);

if (!["start", "screenshot", "check"].includes(command)) {
  console.error(
    "Usage: node scripts/mobile.mjs <start|screenshot|check> [--screen NAME]",
  );
  process.exit(1);
}

const adb = resolveTool("adb", "ADB", "Google.PlatformTools_", "adb.exe");
const device = getDevice(adb);

if (command === "screenshot") {
  const screen = option("--screen") || positionalArg() || "current";
  const capture = await captureScreenshot(adb, device.serial, screen);
  console.log(
    `Saved ${capture.path} (${capture.width}x${capture.height}, exact ADB PNG).`,
  );
} else if (command === "start") {
  const scrcpy = resolveTool(
    "scrcpy",
    "SCRCPY",
    "Genymobile.scrcpy_",
    "scrcpy.exe",
  );
  await startLoop({ adb, device, scrcpy });
} else {
  await runPhysicalCheck({ adb, device });
  process.exit(process.exitCode ?? 0);
}

function option(name) {
  const exactIndex = rawArgs.indexOf(name);
  if (exactIndex !== -1) return rawArgs[exactIndex + 1] || "";
  const prefixed = rawArgs.find((arg) => arg.startsWith(`${name}=`));
  return prefixed ? prefixed.slice(name.length + 1) : "";
}

function positionalArg() {
  return rawArgs.find((arg) => !arg.startsWith("-")) || "";
}

function resolveTool(name, overrideName, packagePrefix, executableName) {
  const override = process.env[overrideName]?.trim();
  if (override) {
    if (!existsSync(override)) {
      throw new Error(`${overrideName} points to a missing file: ${override}`);
    }
    return override;
  }

  const locator = process.platform === "win32" ? "where.exe" : "which";
  const located = spawnSync(locator, [name], {
    encoding: "utf8",
    windowsHide: true,
  });
  if (located.status === 0) {
    const first = located.stdout.split(/\r?\n/).find(Boolean)?.trim();
    if (first) return first;
  }

  if (process.platform === "win32" && process.env.LOCALAPPDATA) {
    const packages = join(
      process.env.LOCALAPPDATA,
      "Microsoft",
      "WinGet",
      "Packages",
    );
    if (existsSync(packages)) {
      const packageDirs = readdirSync(packages, { withFileTypes: true })
        .filter((entry) => entry.isDirectory() && entry.name.startsWith(packagePrefix))
        .map((entry) => join(packages, entry.name));
      for (const packageDir of packageDirs) {
        const found = findFile(packageDir, executableName, 4);
        if (found) return found;
      }
    }
  }

  throw new Error(
    `${name} was not found. Install it with Winget or set ${overrideName} to its executable path.`,
  );
}

function findFile(directory, fileName, depth) {
  if (depth < 0 || !existsSync(directory)) return "";
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const fullPath = join(directory, entry.name);
    if (entry.isFile() && entry.name.toLowerCase() === fileName.toLowerCase()) {
      return fullPath;
    }
    if (entry.isDirectory()) {
      const nested = findFile(fullPath, fileName, depth - 1);
      if (nested) return nested;
    }
  }
  return "";
}

function getDevice(adbPath) {
  runText(adbPath, ["start-server"]);
  const output = runText(adbPath, ["devices", "-l"]);
  const devices = output
    .split(/\r?\n/)
    .slice(1)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const [serial, state, ...details] = line.split(/\s+/);
      return { serial, state, details: details.join(" ") };
    });
  const requested = process.env.ANDROID_SERIAL?.trim();
  const candidates = requested
    ? devices.filter((entry) => entry.serial === requested)
    : devices.filter((entry) => entry.state === "device");

  if (requested && candidates.length === 0) {
    throw new Error(
      `ANDROID_SERIAL=${requested} is not attached. adb reported: ${summarizeDevices(devices)}`,
    );
  }
  if (!requested && candidates.length !== 1) {
    const unauthorized = devices.filter((entry) => entry.state === "unauthorized");
    if (unauthorized.length) {
      throw new Error(
        "The phone is unauthorized. Unlock it, approve 'Allow USB debugging', optionally select 'Always allow from this computer', then rerun the command.",
      );
    }
    throw new Error(
      candidates.length === 0
        ? `No authorized Android device found. adb reported: ${summarizeDevices(devices)}`
        : `Multiple authorized devices found (${candidates.map((entry) => entry.serial).join(", ")}). Set ANDROID_SERIAL explicitly.`,
    );
  }

  const selected = candidates[0];
  if (selected.state !== "device") {
    throw new Error(
      `Device ${selected.serial} is ${selected.state}. Unlock or authorize it, then retry.`,
    );
  }
  const model = runAdbText(adbPath, selected.serial, [
    "shell",
    "getprop",
    "ro.product.model",
  ]).trim();
  return { ...selected, model: model || "Android" };
}

function summarizeDevices(devices) {
  return devices.length
    ? devices.map((entry) => `${entry.serial}:${entry.state}`).join(", ")
    : "none";
}

async function startLoop({ adb: adbPath, device: target, scrcpy }) {
  const server = await ensureServer();
  configureReverse(adbPath, target.serial);
  openChrome(adbPath, target.serial, baseUrl);

  const title = `CivicLens Physical Android - ${target.model} - ${target.serial}`;
  const mirror = spawn(
    scrcpy,
    [
      "--serial",
      target.serial,
      `--window-title=${title}`,
      "--stay-awake",
      "--no-audio",
    ],
    {
      cwd: root,
      env: { ...process.env, ADB: adbPath },
      stdio: "inherit",
      windowsHide: false,
    },
  );
  await delay(1_000);
  if (mirror.exitCode !== null) {
    stopChild(server.process);
    throw new Error(`scrcpy exited early with code ${mirror.exitCode}.`);
  }

  console.log(`\nCivicLens is live on ${target.model} (${target.serial}).`);
  console.log(`Chrome: ${baseUrl}`);
  console.log(`scrcpy window: ${title}`);
  console.log("Keep this command running for Fast Refresh; press Ctrl+C to stop.\n");

  await new Promise((resolvePromise) => {
    let stopping = false;
    const stop = () => {
      if (stopping) return;
      stopping = true;
      stopChild(mirror);
      stopChild(server.process);
      resolvePromise();
    };
    process.once("SIGINT", stop);
    process.once("SIGTERM", stop);
    mirror.once("exit", stop);
    server.process?.once("exit", stop);
  });
}

async function ensureServer() {
  if (await isCivicLensServer(baseUrl)) {
    return { process: null, reused: true };
  }
  if (await isListening(port)) {
    throw new Error(
      `Port ${port} is in use by a service that is not CivicLens. Stop it or set MOBILE_PORT to a free port.`,
    );
  }

  const pnpm = pnpmInvocation();
  const child = spawn(
    pnpm.command,
    [
      ...pnpm.prefix,
      "dev",
      "--webpack",
      "--hostname",
      "127.0.0.1",
      "--port",
      String(port),
    ],
    {
      cwd: root,
      env: { ...process.env, PORT: String(port) },
      stdio: "inherit",
      windowsHide: false,
    },
  );

  const deadline = Date.now() + 120_000;
  while (Date.now() < deadline) {
    if (child.exitCode !== null) {
      throw new Error(`Next.js exited before startup with code ${child.exitCode}.`);
    }
    if (await isCivicLensServer(baseUrl)) {
      return { process: child, reused: false };
    }
    await delay(500);
  }
  stopChild(child);
  throw new Error(`CivicLens did not become ready at ${baseUrl} within 120 seconds.`);
}

function pnpmInvocation() {
  if (process.env.npm_execpath && existsSync(process.env.npm_execpath)) {
    return { command: process.execPath, prefix: [process.env.npm_execpath] };
  }
  return {
    command: process.platform === "win32" ? "pnpm.cmd" : "pnpm",
    prefix: [],
  };
}

async function isCivicLensServer(url) {
  try {
    const response = await fetch(`${url}/api/health`, {
      signal: AbortSignal.timeout(1_500),
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

function isListening(targetPort) {
  return new Promise((resolvePromise) => {
    const socket = net.createConnection({ host: "127.0.0.1", port: targetPort });
    socket.setTimeout(500);
    socket.once("connect", () => {
      socket.destroy();
      resolvePromise(true);
    });
    const unavailable = () => {
      socket.destroy();
      resolvePromise(false);
    };
    socket.once("error", unavailable);
    socket.once("timeout", unavailable);
  });
}

function configureReverse(adbPath, serial) {
  runAdbText(adbPath, serial, [
    "reverse",
    `tcp:${port}`,
    `tcp:${port}`,
  ]);
  console.log(`ADB reverse active: device tcp:${port} -> host tcp:${port}`);
}

function openChrome(adbPath, serial, url) {
  const chromeInstalled =
    spawnSync(adbPath, ["-s", serial, "shell", "pm", "path", "com.android.chrome"], {
      encoding: "utf8",
      windowsHide: true,
    }).status === 0;
  const args = [
    "shell",
    "am",
    "start",
    "-W",
    "-a",
    "android.intent.action.VIEW",
    "-d",
    url,
  ];
  if (chromeInstalled) args.push("-p", "com.android.chrome");
  runAdbText(adbPath, serial, args);
}

async function captureScreenshot(adbPath, serial, screenName) {
  await mkdir(artifactsDir, { recursive: true });
  const safeName = sanitizeName(screenName);
  const timestamp = safeTimestamp();
  const result = spawnSync(
    adbPath,
    ["-s", serial, "exec-out", "screencap", "-p"],
    { encoding: null, maxBuffer: 32 * 1024 * 1024, windowsHide: true },
  );
  if (result.error) throw result.error;
  if (result.status !== 0) {
    throw new Error(
      `ADB screenshot failed (${result.status}): ${String(result.stderr || "").trim()}`,
    );
  }
  const png = result.stdout;
  const { width, height } = pngDimensions(png);
  const physical = getPhysicalSize(adbPath, serial);
  if (
    !(
      (width === physical.width && height === physical.height) ||
      (width === physical.height && height === physical.width)
    )
  ) {
    throw new Error(
      `ADB produced ${width}x${height}, but wm size reports ${physical.width}x${physical.height}.`,
    );
  }
  const path = join(artifactsDir, `${safeName}-${timestamp}.png`);
  await writeFile(path, png);
  return { path, width, height, timestamp, screen: safeName };
}

function pngDimensions(buffer) {
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  if (
    !Buffer.isBuffer(buffer) ||
    buffer.length < 24 ||
    !buffer.subarray(0, 8).equals(signature) ||
    buffer.toString("ascii", 12, 16) !== "IHDR"
  ) {
    throw new Error("ADB did not return a valid PNG with an IHDR header.");
  }
  return { width: buffer.readUInt32BE(16), height: buffer.readUInt32BE(20) };
}

function getPhysicalSize(adbPath, serial) {
  const output = runAdbText(adbPath, serial, ["shell", "wm", "size"]);
  const match = output.match(/Physical size:\s*(\d+)x(\d+)/i);
  if (!match) throw new Error(`Could not parse Android physical size: ${output.trim()}`);
  return { width: Number(match[1]), height: Number(match[2]) };
}

async function runPhysicalCheck({ adb: adbPath, device: target }) {
  const server = await ensureServer();
  let browser;
  let debugPort;
  const batchTimestamp = safeTimestamp();
  const captures = [];
  const routeResults = [];
  const issues = [];

  try {
    configureReverse(adbPath, target.serial);
    openChrome(adbPath, target.serial, baseUrl);
    await delay(1_500);
    debugPort = runAdbText(adbPath, target.serial, [
      "forward",
      "tcp:0",
      "localabstract:chrome_devtools_remote",
    ]).trim();
    if (!/^\d+$/.test(debugPort)) {
      throw new Error(`ADB did not allocate a Chrome DevTools port: ${debugPort}`);
    }
    await waitForUrl(`http://127.0.0.1:${debugPort}/json/version`, 15_000);

    const { chromium } = await import("@playwright/test");
    browser = await chromium.connectOverCDP(`http://127.0.0.1:${debugPort}`);
    const pages = browser.contexts().flatMap((context) => context.pages());
    const page =
      pages.find((candidate) => candidate.url().includes(`127.0.0.1:${port}`)) ||
      pages[0];
    if (!page) throw new Error("Android Chrome exposed no debuggable page.");
    await page.bringToFront();

    const routes = [
      { name: "home", path: "/" },
      { name: "learn", path: "/feed" },
      { name: "analyze", path: "/analyze", keyboard: "textarea" },
      { name: "bills", path: "/bills", keyboard: ".bill-deck-search-panel input", openSearch: true },
      { name: "bill-detail", path: "/bills/118/hr/82" },
      { name: "district", path: "/district", keyboard: "#address" },
    ];

    for (const route of routes) {
      console.log(`Checking ${route.name} (${route.path})...`);
      await gotoPhysicalPage(page, `${baseUrl}${route.path}`);
      await page.bringToFront();
      await page.locator("main#main").waitFor({ state: "visible", timeout: 30_000 });
      await page.waitForLoadState("networkidle", { timeout: 5_000 }).catch(() => {});
      await page.evaluate(() => window.scrollTo(0, 0));
      await delay(700);

      const audit = await auditPage(page);
      await page.evaluate(() => window.scrollTo(0, 0));
      await delay(250);
      const capture = await captureScreenshot(adbPath, target.serial, route.name);
      captures.push(capture);
      routeResults.push({ ...route, audit, screenshot: capture.path });
      collectIssues(issues, route.name, audit);

      if (route.keyboard) {
        try {
          console.log(`Checking ${route.name} keyboard state...`);
          if (route.openSearch) {
            const toggle = page.locator(".bill-search-toggle").first();
            if (await toggle.isVisible().catch(() => false)) {
              await toggle.click({ timeout: 5_000 });
            }
          }
          const field = page.locator(route.keyboard).first();
          if (await field.isVisible().catch(() => false)) {
            await field.click({ timeout: 5_000 });
            await delay(1_200);
            const keyboard = await auditKeyboard(page);
            const keyboardCapture = await captureScreenshot(
              adbPath,
              target.serial,
              `${route.name}-keyboard`,
            );
            captures.push(keyboardCapture);
            routeResults[routeResults.length - 1].keyboard = {
              ...keyboard,
              screenshot: keyboardCapture.path,
            };
            if (!keyboard.focusedVisible) {
              issues.push({
                severity: "error",
                screen: route.name,
                category: "keyboard-overlap",
                detail: JSON.stringify(keyboard),
              });
            }
            await field.evaluate((element) => element.blur());
            await delay(700);
          } else {
            issues.push({
              severity: "error",
              screen: route.name,
              category: "keyboard-check-skipped",
              detail: `No visible field matched ${route.keyboard}`,
            });
          }
        } catch (reason) {
          issues.push({
            severity: "error",
            screen: route.name,
            category: "keyboard-check-failed",
            detail: reason instanceof Error ? reason.message : String(reason),
          });
        }
      }
    }

    const physical = getPhysicalSize(adbPath, target.serial);
    const report = {
      generatedAt: new Date().toISOString(),
      device: {
        serial: target.serial,
        model: target.model,
        physicalSize: `${physical.width}x${physical.height}`,
      },
      baseUrl,
      captures,
      routes: routeResults,
      issues,
      summary: {
        errors: issues.filter((issue) => issue.severity === "error").length,
        warnings: issues.filter((issue) => issue.severity === "warning").length,
      },
    };
    await mkdir(artifactsDir, { recursive: true });
    const jsonPath = join(artifactsDir, `mobile-check-${batchTimestamp}.json`);
    const markdownPath = join(artifactsDir, `mobile-check-${batchTimestamp}.md`);
    await writeFile(jsonPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
    await writeFile(markdownPath, markdownReport(report), "utf8");

    console.log(`\nPhysical Android check: ${report.summary.errors} errors, ${report.summary.warnings} warnings.`);
    console.log(`JSON: ${jsonPath}`);
    console.log(`Markdown: ${markdownPath}`);
    for (const issue of issues) {
      console.log(`- [${issue.severity}] ${issue.screen}/${issue.category}: ${issue.detail}`);
    }
    if (report.summary.errors > 0) process.exitCode = 1;
  } finally {
    if (browser) {
      // For a CDP-attached Android Chrome, close only Playwright's transport.
      // Sending Browser.close would close the CivicLens tab and expose an unrelated tab.
      browser._shouldCloseConnectionOnClose = true;
      await Promise.race([browser.close().catch(() => {}), delay(2_000)]);
    }
    if (debugPort) {
      spawnSync(
        adbPath,
        ["-s", target.serial, "forward", "--remove", `tcp:${debugPort}`],
        { windowsHide: true },
      );
    }
    stopChild(server.process);
  }
}

async function gotoPhysicalPage(page, url) {
  let lastError;
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    try {
      await page.goto(url, {
        waitUntil: "domcontentloaded",
        timeout: 45_000,
      });
      return;
    } catch (reason) {
      lastError = reason;
      const message = reason instanceof Error ? reason.message : String(reason);
      if (
        !/ERR_ABORTED|NS_BINDING_ABORTED|interrupted by another navigation/i.test(message) ||
        attempt === 3
      ) {
        throw reason;
      }
      console.log(`Navigation was aborted; retrying ${url} (${attempt}/3)...`);
      await delay(500);
    }
  }
  throw lastError;
}

async function auditPage(page) {
  return page.evaluate(async () => {
    const tolerance = 2;
    const viewportWidth = document.documentElement.clientWidth;
    const viewportHeight = window.innerHeight;
    const visible = (element) => {
      if (element.closest(".sr-only,[aria-hidden='true']")) return false;
      const style = getComputedStyle(element);
      const rect = element.getBoundingClientRect();
      return (
        style.display !== "none" &&
        style.visibility !== "hidden" &&
        Number(style.opacity) !== 0 &&
        rect.width > 0 &&
        rect.height > 0
      );
    };
    const label = (element) => {
      const className =
        typeof element.className === "string" && element.className.trim()
          ? `.${element.className.trim().split(/\s+/).slice(0, 3).join(".")}`
          : "";
      const id = element.id ? `#${element.id}` : "";
      const text = (element.getAttribute("aria-label") || element.textContent || "")
        .trim()
        .replace(/\s+/g, " ")
        .slice(0, 70);
      return `${element.tagName.toLowerCase()}${id}${className}${text ? ` (${text})` : ""}`;
    };
    const insideIntentionalScroller = (element) =>
      Boolean(
        element.closest(
          ".bill-slide-track,.sources-carousel,.representatives-row,.lesson-toolbar,.analyze-examples",
        ),
      );
    const elements = Array.from(document.body.querySelectorAll("*"));
    const outsideViewport = elements
      .filter(
        (element) =>
          visible(element) &&
          !insideIntentionalScroller(element) &&
          (element.getBoundingClientRect().left < -tolerance ||
            element.getBoundingClientRect().right > viewportWidth + tolerance),
      )
      .slice(0, 20)
      .map((element) => {
        const rect = element.getBoundingClientRect();
        return `${label(element)} ${Math.round(rect.left)}..${Math.round(rect.right)}px`;
      });
    const clippedText = elements
      .filter((element) => {
        if (!visible(element)) return false;
        const text = (element.textContent || "").trim();
        if (text.length < 4 || element.children.length > 0) return false;
        const style = getComputedStyle(element);
        return (
          (element.scrollWidth > element.clientWidth + tolerance &&
            ["hidden", "clip"].includes(style.overflowX)) ||
          (element.scrollHeight > element.clientHeight + tolerance &&
            ["hidden", "clip"].includes(style.overflowY))
        );
      })
      .slice(0, 20)
      .map(label);
    const tapTargets = Array.from(
      document.querySelectorAll("a,button,input,textarea,select,[role='button']"),
    )
      .filter((element) => {
        if (!visible(element) || element.disabled) return false;
        const rect = element.getBoundingClientRect();
        return rect.bottom > 0 && rect.top < viewportHeight && (rect.width < 44 || rect.height < 44);
      })
      .slice(0, 30)
      .map((element) => {
        const rect = element.getBoundingClientRect();
        return `${label(element)} ${Math.round(rect.width)}x${Math.round(rect.height)}`;
      });
    const originalScrollY = window.scrollY;
    window.scrollTo(0, document.documentElement.scrollHeight);
    await Promise.race([
      new Promise((resolvePromise) =>
        requestAnimationFrame(() => requestAnimationFrame(resolvePromise)),
      ),
      new Promise((resolvePromise) => setTimeout(resolvePromise, 250)),
    ]);
    const nav = document.querySelector(".mobile-bottom-nav");
    const navRect = nav?.getBoundingClientRect();
    const navOverlaps = navRect
      ? Array.from(document.querySelectorAll("main a,main button,main input,main textarea,main select"))
          .filter((element) => {
            if (!visible(element)) return false;
            const rect = element.getBoundingClientRect();
            return rect.top < navRect.bottom && rect.bottom > navRect.top;
          })
          .slice(0, 20)
          .map(label)
      : ["missing .mobile-bottom-nav"];
    window.scrollTo(0, originalScrollY);
    const scrollContainers = elements
      .filter((element) => {
        if (!visible(element)) return false;
        const style = getComputedStyle(element);
        return (
          ["auto", "scroll"].includes(style.overflowY) &&
          element.scrollHeight > element.clientHeight + tolerance &&
          element.clientHeight > 100
        );
      })
      .slice(0, 12)
      .map((element) => `${label(element)} ${element.clientHeight}/${element.scrollHeight}px`);
    return {
      title: document.title,
      url: location.href,
      viewport: {
        width: viewportWidth,
        height: viewportHeight,
        visualWidth: window.visualViewport?.width ?? null,
        visualHeight: window.visualViewport?.height ?? null,
        scale: window.visualViewport?.scale ?? null,
      },
      documentWidth: Math.max(document.documentElement.scrollWidth, document.body.scrollWidth),
      outsideViewport,
      clippedText,
      tapTargets,
      navOverlaps,
      scrollContainers,
      nav: navRect
        ? { top: Math.round(navRect.top), bottom: Math.round(navRect.bottom), height: Math.round(navRect.height) }
        : null,
      mainTop: Math.round(document.querySelector("main#main")?.getBoundingClientRect().top ?? -1),
    };
  });
}

async function auditKeyboard(page) {
  return page.evaluate(() => {
    const active = document.activeElement;
    const rect = active?.getBoundingClientRect();
    const visual = window.visualViewport;
    const visualTop = visual?.offsetTop ?? 0;
    const visualBottom = visualTop + (visual?.height ?? window.innerHeight);
    return {
      activeTag: active?.tagName?.toLowerCase() || null,
      focusedRect: rect
        ? { top: Math.round(rect.top), bottom: Math.round(rect.bottom), height: Math.round(rect.height) }
        : null,
      layoutViewportHeight: window.innerHeight,
      visualViewportHeight: visual?.height ?? null,
      visualViewportOffsetTop: visual?.offsetTop ?? null,
      focusedVisible: Boolean(rect && rect.top >= visualTop && rect.bottom <= visualBottom - 4),
    };
  });
}

function collectIssues(issues, screen, audit) {
  if (audit.documentWidth > audit.viewport.width + 2) {
    issues.push({
      severity: "error",
      screen,
      category: "horizontal-overflow",
      detail: `document ${audit.documentWidth}px > viewport ${audit.viewport.width}px`,
    });
  }
  for (const detail of audit.outsideViewport) {
    issues.push({ severity: "error", screen, category: "outside-viewport", detail });
  }
  for (const detail of audit.navOverlaps) {
    issues.push({ severity: "error", screen, category: "bottom-nav-overlap", detail });
  }
  for (const detail of audit.clippedText) {
    issues.push({ severity: "warning", screen, category: "clipped-text", detail });
  }
  for (const detail of audit.tapTargets) {
    issues.push({ severity: "warning", screen, category: "tap-target", detail });
  }
  for (const detail of audit.scrollContainers) {
    issues.push({ severity: "warning", screen, category: "nested-scroll", detail });
  }
}

function markdownReport(report) {
  const lines = [
    "# Physical Android UI Check",
    "",
    `- Generated: ${report.generatedAt}`,
    `- Device: ${report.device.model} (${report.device.serial})`,
    `- Native display: ${report.device.physicalSize}`,
    `- Result: ${report.summary.errors} errors, ${report.summary.warnings} warnings`,
    "",
    "## Captures",
    "",
    ...report.captures.map(
      (capture) => `- ${capture.screen}: \`${capture.path}\` (${capture.width}x${capture.height})`,
    ),
    "",
    "## Automated Findings",
    "",
    ...(report.issues.length
      ? report.issues.map(
          (issue) => `- **${issue.severity.toUpperCase()}** ${issue.screen}/${issue.category}: ${issue.detail}`,
        )
      : ["- No automated geometry issues found."]),
    "",
    "## Manual Scrcpy Review",
    "",
    "Confirm safe-area appearance, gesture behavior, text legibility, and spacing in the named scrcpy window. Automated DOM geometry is not a substitute for this visual pass.",
    "",
  ];
  return lines.join("\n");
}

async function waitForUrl(url, timeoutMs) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(url, { signal: AbortSignal.timeout(1_000) });
      if (response.ok) return;
    } catch {}
    await delay(300);
  }
  throw new Error(`Timed out waiting for ${url}. Is Android Chrome open and debuggable?`);
}

function runText(executable, args) {
  const result = spawnSync(executable, args, {
    encoding: "utf8",
    maxBuffer: 16 * 1024 * 1024,
    windowsHide: true,
  });
  if (result.error) throw result.error;
  if (result.status !== 0) {
    throw new Error(
      `${executable} ${args.join(" ")} failed (${result.status}): ${String(result.stderr || result.stdout || "").trim()}`,
    );
  }
  return result.stdout || "";
}

function runAdbText(adbPath, serial, args) {
  return runText(adbPath, ["-s", serial, ...args]);
}

function stopChild(child) {
  if (!child || child.exitCode !== null || !child.pid) return;
  if (process.platform === "win32") {
    spawnSync("taskkill.exe", ["/PID", String(child.pid), "/T", "/F"], {
      stdio: "ignore",
      windowsHide: true,
    });
  } else {
    child.kill("SIGTERM");
  }
}

function sanitizeName(value) {
  const sanitized = String(value)
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return sanitized || "screen";
}

function safeTimestamp() {
  return new Date().toISOString().replace(/[:.]/g, "-");
}
