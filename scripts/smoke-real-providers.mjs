import { spawn, spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";

const DEFAULT_PORT = "3210";
const HEALTH_PATH = "/api/health";
const ANALYZE_PATH = "/api/analyze";
const RECENT_BILLS_PATH = "/api/bills/recent?limit=12";
const timeoutMs = Number(process.env.PROVIDER_SMOKE_TIMEOUT_MS ?? 120_000);
const env = loadLocalEnv({ ...process.env });
const provider = detectProvider(env);
const externallyHostedBaseUrl =
  env.PROVIDER_SMOKE_BASE_URL || process.env.PLAYWRIGHT_BASE_URL;
const baseUrl =
  externallyHostedBaseUrl?.replace(/\/+$/, "") ??
  `http://127.0.0.1:${env.PROVIDER_SMOKE_PORT ?? DEFAULT_PORT}`;

let serverProcess;
let serverLog = "";

try {
  if (!provider) {
    console.info(
      "Provider smoke skipped: configure NIM_API_KEY (or NVIDIA_NIM_API_KEY), GROQ_API_KEY, LLM_API_KEY, or OPENAI_API_KEY. Set ENABLE_* to false only to disable a configured provider.",
    );
    process.exit(env.REQUIRE_LIVE_PROVIDERS === "true" ? 1 : 0);
  }

  if (!externallyHostedBaseUrl) {
    serverProcess = startServer(env);
  }

  const health = await waitForHealth(baseUrl, timeoutMs);
  assert(Boolean(health.ok), "Health endpoint did not report ok=true.");
  assert(
    health.llmConfigured === true,
    "Health endpoint did not report llmConfigured=true with provider env present.",
  );

  const analysis = await postJson(`${baseUrl}${ANALYZE_PATH}`, {
    claim:
      "H.R. 82 did not repeal the government pension offset or windfall elimination rules.",
  });

  assert(
    analysis && typeof analysis === "object",
    "Analyze endpoint did not return a JSON object.",
  );
  assert(
    analysis.mode === "live",
    `Analyze endpoint did not report mode=live for the configured provider (mode=${String(analysis.mode)}, warnings=${JSON.stringify(analysis.warnings || [])}).`,
  );
  assert(
    !JSON.stringify(analysis.warnings || [])
      .toLowerCase()
      .includes("deterministic fallback"),
    "Analyze endpoint fell back to deterministic output instead of using the configured provider.",
  );

  const citationCount = Array.isArray(analysis.citations)
    ? analysis.citations.length
    : 0;
  assert(
    citationCount > 0,
    "Analyze endpoint did not return source citations.",
  );
  assertTruthContract(analysis.result ?? analysis.analysis, analysis.citations);
  const analyzedResult = analysis.result ?? analysis.analysis;
  assert(
    analyzedResult.truthVerdict === "false" ||
      analyzedResult.truthVerdict === "mostly_false",
    `Live analyzer did not contradict the testably false claim (verdict=${String(analyzedResult.truthVerdict)}).`,
  );
  assert(
    /pension offset|windfall elimination/i.test(JSON.stringify(analyzedResult)),
    "Live analyzer did not explain the substantive Social Security rule change.",
  );

  const bills = await getJson(`${baseUrl}${RECENT_BILLS_PATH}`);
  assert(
    bills && typeof bills === "object",
    "Recent-bills endpoint did not return a JSON object.",
  );
  assert(
    bills.mode === "live" || bills.mode === "fixture",
    "Recent-bills endpoint returned an invalid mode.",
  );
  assert(
    Array.isArray(bills.results),
    "Recent-bills endpoint did not return a results array.",
  );
  assert(
    bills.results.length >= 12,
    "Recent-bills endpoint returned fewer than 12 useful cards.",
  );
  assert(
    bills.results.length <= 24,
    "Recent-bills endpoint exceeded the 24-card limit.",
  );
  assert(
    new Set(bills.results.map((card) => card?.href)).size ===
      bills.results.length,
    "Recent-bills endpoint returned duplicate cards.",
  );
  for (const card of bills.results) {
    assert(card?.type === "bill", "A recent-bills result is not a bill card.");
    assert(
      /^\/bills\/\d+\/[a-z]+\/\d+$/.test(card.href),
      "A recent-bills card has an invalid detail route.",
    );
    assert(
      typeof card.hook === "string" && card.hook.length > 0,
      "A recent-bills card is missing its hook.",
    );
    assert(
      Array.isArray(card.keyPoints) && card.keyPoints.length >= 3,
      "A recent-bills card needs at least three key points.",
    );
    assert(
      typeof card.whoIsAffected?.text === "string" &&
        card.whoIsAffected.text.length > 0,
      "A recent-bills card is missing whoIsAffected.",
    );
    assert(
      Array.isArray(card.citations) && card.citations.length > 0,
      "A recent-bills card is missing citations.",
    );
    const citationIds = new Set(card.citations.map((citation) => citation?.id));
    const citedFields = [
      { text: card.hook, citationIds: card.hookCitationIds },
      ...card.keyPoints,
      card.currentStep,
      card.whyItMatters,
      card.whatChanges,
      card.whoIsAffected,
    ];
    assert(
      citedFields.every(
        (field) =>
          field &&
          Array.isArray(field.citationIds) &&
          field.citationIds.length > 0 &&
          field.citationIds.every((id) => citationIds.has(id)),
      ),
      "A recent-bills explanation cites an unknown or missing source id.",
    );
  }

  const billEvidence = classifyBillEvidence(bills.results, {
    congressConfigured: health.congressApiConfigured === true,
    llmConfigured: Boolean(provider),
  });
  if (
    health.congressApiConfigured === true && Boolean(provider)
  ) {
    assert(
      billEvidence.llmLiveCards.length > 0,
      "Congress and an LLM are configured, but no identity-matched live card used validated autonomous LLM enrichment.",
    );
  }
  for (const card of billEvidence.llmLiveCards) {
    assert(
      card.enrichment?.officialDetail === true,
      "An LLM-enriched live card is not backed by matching official bill detail.",
    );
    assert(
      card.enrichment?.provider === "nim" ||
        card.enrichment?.provider === "groq" ||
      card.enrichment?.provider === "generic",
      "An LLM-enriched live card does not name a supported LLM provider as its provider.",
    );
    assert(
      card.citations.every(
        (citation) =>
          citation?.bill?.congress === card.bill?.congress &&
          citation?.bill?.type === card.bill?.type &&
          citation?.bill?.number === card.bill?.number,
      ),
      "An LLM-enriched live card contains citation evidence from a different bill.",
    );
  }

  const status =
    analysis.result?.status ?? analysis.analysis?.status ?? "unknown";
  console.info(
    `Provider integration smoke passed: analyzerEvidenceTier=live-llm, provider=${provider}, healthMode=${String(health.mode)}, analyzeMode=${String(
      analysis.mode,
    )}, status=${String(status)}, citations=${citationCount}, billEvidenceTier=${billEvidence.tier}, billCards=${bills.results.length}, billLlmLiveCards=${billEvidence.llmLiveCards.length}, billDeterministicLiveCards=${billEvidence.deterministicLiveCards.length}, billFixtureCards=${billEvidence.fixtureCards.length}. This proves the reported integration tiers only, not general model quality.`,
  );
  if (billEvidence.note) {
    console.info(`Bill enrichment evidence note: ${billEvidence.note}`);
  }
} catch (error) {
  console.error(
    `Provider smoke failed: ${sanitizeForLog(error instanceof Error ? error.message : String(error))}`,
  );
  if (serverLog) {
    console.error("Recent dev-server output:");
    console.error(
      sanitizeForLog(serverLog.trim()).split(/\r?\n/).slice(-20).join("\n"),
    );
  }
  process.exitCode = 1;
} finally {
  stopServer(serverProcess);
}

function detectProvider(source) {
  if (
    !isExplicitlyDisabled(source.ENABLE_NIM) &&
    (source.NVIDIA_NIM_API_KEY || source.NIM_API_KEY || source.NVIDIA_API_KEY)
  ) {
    return "nim";
  }

  if (!isExplicitlyDisabled(source.ENABLE_GROQ) && source.GROQ_API_KEY) {
    return "groq";
  }

  if (
    !isExplicitlyDisabled(source.ENABLE_LLM) &&
    (source.LLM_API_KEY || source.OPENAI_API_KEY)
  ) {
    return "generic";
  }

  return null;
}

function loadLocalEnv(source) {
  const merged = { ...source };
  const mode = source.NODE_ENV || "development";
  // Match Next's precedence while keeping explicitly supplied environment first.
  for (const path of [`.env.${mode}.local`, ".env.local", `.env.${mode}`, ".env"]) {
    if (!existsSync(path)) continue;
    for (const line of readFileSync(path, "utf8").split(/\r?\n/)) {
      const match = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)=(.*)\s*$/);
      if (!match || merged[match[1]] !== undefined) continue;
      merged[match[1]] = match[2].replace(/^['"]|['"]$/g, "").trim();
    }
  }
  return merged;
}

function startServer(source) {
  if (source.HTTPS_PROXY || source.HTTP_PROXY) {
    source = { ...source, NODE_OPTIONS: `${source.NODE_OPTIONS || ""} --use-env-proxy`.trim() };
  }
  const hasPnpmCli = source.npm_execpath && existsSync(source.npm_execpath);
  const command = hasPnpmCli ? process.execPath : "pnpm";
  const port = source.PROVIDER_SMOKE_PORT ?? DEFAULT_PORT;
  const args = [
    ...(hasPnpmCli ? [source.npm_execpath] : []),
    "dev",
    "--hostname",
    "127.0.0.1",
    "--port",
    port,
  ];
  const child = spawn(command, args, {
    cwd: process.cwd(),
    env: sanitizeSpawnEnv({ ...source, PORT: port }),
    stdio: ["ignore", "pipe", "pipe"],
    detached: process.platform !== "win32",
  });

  child.stdout.setEncoding("utf8");
  child.stderr.setEncoding("utf8");
  child.stdout.on("data", appendServerLog);
  child.stderr.on("data", appendServerLog);

  return child;
}

function stopServer(child) {
  if (!child || child.killed) {
    return;
  }

  if (process.platform === "win32" && child.pid) {
    spawnSync("taskkill", ["/pid", String(child.pid), "/T", "/F"], {
      stdio: "ignore",
    });
    return;
  }

  // pnpm launches Next through a shell. Kill the group so the server and its
  // inherited pipes cannot outlive the smoke check or keep it hanging.
  try {
    process.kill(-child.pid, "SIGTERM");
  } catch (error) {
    if (error.code !== "ESRCH") throw error;
  }
}

function sanitizeSpawnEnv(source) {
  return Object.fromEntries(
    Object.entries(source).filter(
      ([key, value]) =>
        key && !key.startsWith("=") && typeof value === "string",
    ),
  );
}

function appendServerLog(chunk) {
  serverLog = `${serverLog}${chunk}`;
  if (serverLog.length > 20_000) {
    serverLog = serverLog.slice(-20_000);
  }
}

async function waitForHealth(targetBaseUrl, limitMs) {
  const startedAt = Date.now();
  let lastError;

  while (Date.now() - startedAt < limitMs) {
    try {
      const response = await fetch(`${targetBaseUrl}${HEALTH_PATH}`, {
        cache: "no-store",
        signal: AbortSignal.timeout(5_000),
      });
      if (response.ok) {
        return await response.json();
      }
      lastError = new Error(`Health returned HTTP ${response.status}.`);
    } catch (error) {
      lastError = error;
    }

    await new Promise((resolve) => setTimeout(resolve, 750));
  }

  throw lastError instanceof Error
    ? lastError
    : new Error("Timed out waiting for the health endpoint.");
}

async function postJson(url, body) {
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    throw new Error(
      `POST ${new URL(url).pathname} returned HTTP ${response.status}.`,
    );
  }

  return response.json();
}

async function getJson(url) {
  const response = await fetch(url, { cache: "no-store" });
  if (!response.ok) {
    throw new Error(
      `GET ${new URL(url).pathname} returned HTTP ${response.status}.`,
    );
  }
  return response.json();
}

function assertTruthContract(result, citations) {
  assert(
    result && typeof result === "object",
    "Analyze endpoint is missing its result object.",
  );
  const verdicts = new Set([
    "true",
    "mostly_true",
    "mixed",
    "mostly_false",
    "false",
    "unverifiable",
  ]);
  assert(
    verdicts.has(result.truthVerdict),
    "Analyze endpoint returned an invalid truthVerdict.",
  );
  assert(
    typeof result.verdictSummary === "string" &&
      result.verdictSummary.trim().length >= 20,
    "Analyze endpoint returned no useful verdictSummary.",
  );
  assert(
    Array.isArray(result.claimChecks),
    "Analyze endpoint returned no claimChecks array.",
  );
  assert(
    result.claimChecks.length >= 1 && result.claimChecks.length <= 4,
    "Analyze endpoint must return 1-4 claimChecks.",
  );
  const knownCitationIds = new Set(citations.map((citation) => citation?.id));
  for (const check of result.claimChecks) {
    assert(
      typeof check.claim === "string" && check.claim.trim().length > 0,
      "A claimCheck is missing its claim.",
    );
    assert(
      verdicts.has(check.verdict),
      "A claimCheck returned an invalid verdict.",
    );
    assert(
      typeof check.explanation === "string" &&
        check.explanation.trim().length > 0,
      "A claimCheck is missing its explanation.",
    );
    assert(
      Array.isArray(check.citationIds),
      "A claimCheck is missing citationIds.",
    );
    assert(
      check.citationIds.every((id) => knownCitationIds.has(id)),
      "A claimCheck cites an unknown source id.",
    );
    if (check.verdict !== "unverifiable") {
      assert(
        check.citationIds.length > 0,
        "A settled claimCheck has no official citation.",
      );
    }
  }
}

function classifyBillEvidence(cards, configuration) {
  const llmLiveCards = cards.filter(
    (card) =>
      card?.mode === "live" &&
      card.enrichment?.method === "llm" &&
      card.enrichment?.officialDetail === true &&
      (card.enrichment?.provider === "nim" ||
        card.enrichment?.provider === "groq" ||
        card.enrichment?.provider === "generic"),
  );
  const deterministicLiveCards = cards.filter(
    (card) =>
      card?.mode === "live" &&
      card.enrichment?.method === "deterministic" &&
      card.enrichment?.officialDetail === true,
  );
  const thinLiveCards = cards.filter(
    (card) => card?.mode === "live" && card.enrichment?.officialDetail !== true,
  );
  const fixtureCards = cards.filter((card) => card?.mode === "fixture");

  if (llmLiveCards.length > 0) {
    return {
      tier:
        fixtureCards.length > 0 ? "hybrid-live-llm-plus-fixtures" : "live-llm",
      llmLiveCards,
      deterministicLiveCards,
      thinLiveCards,
      fixtureCards,
      note: null,
    };
  }

  const note =
    configuration.congressConfigured && configuration.llmConfigured
      ? "Congress and an LLM were configured, but this run produced no suitable matching live candidate with validated LLM enrichment; deterministic or fixture cards are not counted as model proof."
      : "This run did not have both live Congress access and LLM bill enrichment available; deterministic or fixture cards are not counted as model proof.";
  const tier =
    deterministicLiveCards.length > 0
      ? fixtureCards.length > 0
        ? "hybrid-live-deterministic-plus-fixtures"
        : "live-deterministic"
      : thinLiveCards.length > 0
        ? fixtureCards.length > 0
          ? "hybrid-thin-live-plus-fixtures"
          : "thin-live-records"
        : "fixture-only";

  return {
    tier,
    llmLiveCards,
    deterministicLiveCards,
    thinLiveCards,
    fixtureCards,
    note,
  };
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function isExplicitlyDisabled(value) {
  return (
    value === "0" ||
    value?.toLowerCase() === "false" ||
    value?.toLowerCase() === "no"
  );
}

function sanitizeForLog(text) {
  let redacted = text;
  for (const value of Object.values(env)) {
    if (typeof value === "string" && value.length >= 8) {
      redacted = redacted.split(value).join("[redacted]");
    }
  }
  return redacted;
}
