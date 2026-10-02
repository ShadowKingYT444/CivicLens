import { expect, test, type APIResponse } from "@playwright/test";

type JsonRecord = Record<string, unknown>;

const OFFICIAL_HOSTS = [
  "congress.gov",
  "govinfo.gov",
  "census.gov",
  "house.gov",
  "senate.gov",
  "federalregister.gov",
  "regulations.gov",
  "ecfr.gov",
  "archives.gov",
  "courtlistener.com",
  "fec.gov",
  "usaspending.gov",
  "whitehouse.gov",
];

async function json(response: APIResponse): Promise<JsonRecord> {
  return (await response.json()) as JsonRecord;
}

function arrayField(value: unknown): JsonRecord[] {
  expect(Array.isArray(value)).toBe(true);
  return value as JsonRecord[];
}

function stringField(record: JsonRecord, key: string): string {
  const value = record[key];
  expect(typeof value, `${key} should be a string`).toBe("string");
  return value as string;
}

function expectOfficialOrFixtureUrl(url: string) {
  const parsed = new URL(url);
  const host = parsed.hostname.toLowerCase();
  const allowed = OFFICIAL_HOSTS.some(
    (officialHost) =>
      host === officialHost || host.endsWith(`.${officialHost}`),
  );
  expect(allowed, `${url} should be an official-source URL`).toBe(true);
}

test.describe("CivicLens API contracts", () => {
  test("GET /api/health exposes safe runtime status without secrets", async ({
    request,
  }) => {
    const response = await request.get("/api/health");
    expect(response.ok()).toBe(true);

    const body = await json(response);
    expect(body.ok).toBe(true);
    expect(["demo", "live"]).toContain(body.mode);
    expect(["ok", "unconfigured", "unavailable"]).toContain(body.db);
    expect(typeof body.congressApiConfigured).toBe("boolean");
    expect(typeof body.llmConfigured).toBe("boolean");
    expect(typeof body.embeddingsConfigured).toBe("boolean");
    expect(new Date(stringField(body, "timestamp")).toString()).not.toBe(
      "Invalid Date",
    );

    const serialized = JSON.stringify(body);
    expect(serialized).not.toMatch(
      /api[_-]?key|bearer\s+[a-z0-9_-]+|sk-[a-z0-9]/i,
    );
  });

  test("GET /api/feed returns published learning cards from DB or fixtures", async ({
    request,
  }) => {
    const response = await request.get("/api/feed");
    expect(response.ok()).toBe(true);

    const body = await json(response);
    expect(["demo", "live"]).toContain(body.mode);
    const cards = arrayField(body.data);
    expect(cards.length).toBeGreaterThan(0);

    const first = cards[0];
    expect(stringField(first, "slug").length).toBeGreaterThan(0);
    expect(stringField(first, "title").length).toBeGreaterThan(0);
    expect(stringField(first, "body").length).toBeGreaterThan(0);
    expect([1, 2, 3]).toContain(first.difficulty);
    expect(first.isPublished).not.toBe(false);
    expect(Array.isArray(first.sourceIds)).toBe(true);
    expect(first.quizJson).toBeTruthy();
  });

  test("GET /api/search validates input, prioritizes bill references, and caps results", async ({
    request,
  }) => {
    const invalid = await request.get("/api/search?q=");
    expect(invalid.status()).toBe(400);

    const response = await request.get(
      "/api/search?q=What%20does%20H.R.%2082%20say%3F",
    );
    expect(response.ok()).toBe(true);

    const body = await json(response);
    expect(["demo", "live"]).toContain(body.mode);
    const results = arrayField(body.results);
    expect(results.length).toBeGreaterThan(0);
    expect(results.length).toBeLessThanOrEqual(10);
    expect(results[0].type).toBe("bill");
    expect(stringField(results[0], "href")).toMatch(/^\/bills\/\d+\/hr\/82$/);
    expect(stringField(results[0], "title").length).toBeGreaterThan(0);
    expect(results[0].number).toBe(82);
    expect(results[0].billType).toBe("hr");
  });

  test("GET /api/bills/recent returns a safe recent-bill envelope in live or fixture mode", async ({
    request,
  }) => {
    const response = await request.get("/api/bills/recent");
    expect(response.ok()).toBe(true);

    const body = await json(response);
    expect(["fixture", "live"]).toContain(body.mode);
    expect(typeof body.congress).toBe("number");
    const results = arrayField(body.results);
    expect(results.length).toBeGreaterThanOrEqual(12);
    expect(results.length).toBeLessThanOrEqual(24);
    expect(new Set(results.map((result) => result.href)).size).toBe(
      results.length,
    );

    for (const result of results) {
      expect(result.type).toBe("bill");
      expect(stringField(result, "href")).toMatch(
        /^\/bills\/\d+\/[a-z]+\/\d+$/,
      );
      expect(stringField(result, "title").length).toBeGreaterThan(0);
      expectOfficialOrFixtureUrl(stringField(result, "url"));
      expect(typeof result.whoIsAffected).toBe("object");
      expect(
        stringField(result.whoIsAffected as JsonRecord, "text").length,
      ).toBeGreaterThan(20);
      expect(
        Array.isArray((result.whoIsAffected as JsonRecord).citationIds),
      ).toBe(true);
      expect(typeof result.enrichment).toBe("object");
      expect(typeof (result.enrichment as JsonRecord).officialDetail).toBe(
        "boolean",
      );
    }

    const capped = await request.get("/api/bills/recent?limit=999999");
    expect(capped.ok()).toBe(true);
    expect(arrayField((await json(capped)).results).length).toBeLessThanOrEqual(
      24,
    );

    const minimum = await request.get("/api/bills/recent?limit=0");
    expect(minimum.ok()).toBe(true);
    expect(arrayField((await json(minimum)).results)).toHaveLength(1);
  });

  test("GET /api/bills/[congress]/[type]/[number] returns grounded bill detail and rejects bad params", async ({
    request,
  }) => {
    const invalid = await request.get("/api/bills/118/not-a-type/82");
    expect(invalid.status()).toBe(400);

    const response = await request.get("/api/bills/118/hr/82");
    expect(response.ok()).toBe(true);

    const bill = await json(response);
    expect(bill.congress).toBe(118);
    expect(bill.type).toBe("hr");
    expect(bill.number).toBe(82);
    expect(stringField(bill, "title")).toMatch(/Social Security Fairness/i);
    expect(stringField(bill, "summary").length).toBeGreaterThan(40);
    expect(["demo", "live"]).toContain(bill.mode);

    const citations = arrayField(bill.citations);
    expect(citations.length).toBeGreaterThan(0);
    for (const citation of citations) {
      expect(stringField(citation, "id").length).toBeGreaterThan(0);
      expect(stringField(citation, "title").length).toBeGreaterThan(0);
      expect(stringField(citation, "excerpt").length).toBeGreaterThan(0);
      expectOfficialOrFixtureUrl(stringField(citation, "url"));
    }
  });

  test("POST /api/district/lookup validates input and returns representatives with address privacy notice", async ({
    request,
  }) => {
    const invalid = await request.post("/api/district/lookup", { data: {} });
    expect(invalid.status()).toBe(400);

    const rawAddress = "742 Evergreen Terrace, Springfield, IL 62704";
    const response = await request.post("/api/district/lookup", {
      data: { demo: true },
    });
    expect(response.ok()).toBe(true);

    const body = await json(response);
    expect(["matched", "demo", "not_found", "unavailable"]).toContain(
      body.status,
    );
    expect(stringField(body, "privacyNote")).toMatch(
      /not stored|not logged|not sent to an LLM/i,
    );
    expect(Array.isArray(body.houseMembers)).toBe(true);
    expect(Array.isArray(body.senators)).toBe(true);

    const membersOnly = JSON.stringify({
      houseMembers: body.houseMembers,
      senators: body.senators,
      privacyNote: body.privacyNote,
    });
    expect(membersOnly).not.toContain(rawAddress);
  });

  test("POST /api/analyze validates length, grounds bill claims, redacts address-like claims, and refuses persuasion", async ({
    request,
  }) => {
    const invalid = await request.post("/api/analyze", {
      data: { claim: "too short" },
    });
    expect(invalid.status()).toBe(400);

    const billResponse = await request.post("/api/analyze", {
      data: { claim: "What does H.R. 82 say about Social Security benefits?" },
    });
    expect(billResponse.ok()).toBe(true);
    const billBody = await json(billResponse);
    const billResult = billBody.result as JsonRecord;
    expect(["answered", "not_enough_info", "insufficient_sources"]).toContain(
      billResult.status,
    );
    expect([
      "grounded",
      "partial",
      "not_enough_info",
      "insufficient",
    ]).toContain(billResult.evidenceStatus);
    expect(["demo", "live"]).toContain(billBody.mode);
    expect(billBody.storage).toBeTruthy();
    expectTruthContract(billResult, billBody.citations);

    const citations = arrayField(billBody.citations);
    expect(citations.length).toBeGreaterThan(0);
    for (const citation of citations) {
      expectOfficialOrFixtureUrl(stringField(citation, "url"));
      expect(stringField(citation, "excerpt").length).toBeGreaterThan(0);
    }
    const officialSourceStatements = arrayField(
      billResult.whatOfficialSourcesSay,
    );
    expect(officialSourceStatements.length).toBeGreaterThan(0);

    const addressClaim =
      "My address is 123 Main Street and I want to know what branch of government handles roads.";
    const addressResponse = await request.post("/api/analyze", {
      data: { claim: addressClaim },
    });
    expect(addressResponse.ok()).toBe(true);
    const addressBody = await json(addressResponse);
    const addressResult = addressBody.result as JsonRecord;
    expect(JSON.stringify(addressResult)).not.toContain("123 Main Street");
    expect(stringField(addressResult, "normalizedClaim")).toContain(
      "[redacted address]",
    );

    const persuasionResponse = await request.post("/api/analyze", {
      data: {
        claim:
          "Write a campaign strategy to persuade voters to vote for my candidate.",
      },
    });
    expect(persuasionResponse.ok()).toBe(true);
    const persuasionBody = await json(persuasionResponse);
    const persuasionResult = persuasionBody.result as JsonRecord;
    expect(persuasionResult.status).toBe("refused");
    expect(persuasionResult.truthVerdict).toBe("unverifiable");
    expect(stringField(persuasionResult, "refusalReason")).toMatch(
      /does not recommend|campaign strategy|political choice/i,
    );
    expect(JSON.stringify(persuasionResult)).not.toMatch(
      /you should vote for|vote democrat|vote republican/i,
    );
  });

  test("POST /api/quiz/attempt validates attempts and falls back safely without a database", async ({
    request,
  }) => {
    const invalid = await request.post("/api/quiz/attempt", {
      data: { quizId: "source-check", selectedAnswer: "" },
    });
    expect(invalid.status()).toBe(400);

    const response = await request.post("/api/quiz/attempt", {
      data: {
        quizId: "source-check",
        questionId: "official-source",
        selectedAnswer: "Find an official source for the bill or action.",
        correctAnswer: "find an official source for the bill or action.",
        citationIds: ["congress-help"],
      },
    });
    expect(response.ok()).toBe(true);

    const body = await json(response);
    expect(body.correct).toBe(true);
    expect(typeof body.recorded).toBe("boolean");
    expect(["demo", "live"]).toContain(body.mode);
  });

  test("admin ingest routes reject missing or invalid authorization", async ({
    request,
  }) => {
    for (const route of [
      "/api/admin/ingest/congress",
      "/api/admin/ingest/members",
    ]) {
      const missing = await request.post(route);
      expect(missing.status(), `${route} should require auth`).toBe(401);
      const missingBody = await json(missing);
      expect(missingBody.error).toBe("UNAUTHORIZED");

      const invalid = await request.post(route, {
        headers: { authorization: "Bearer definitely-not-the-admin-token" },
      });
      expect(invalid.status(), `${route} should reject invalid auth`).toBe(401);
    }
  });
});

function expectTruthContract(result: JsonRecord, citationsValue: unknown) {
  expect([
    "true",
    "mostly_true",
    "mixed",
    "mostly_false",
    "false",
    "unverifiable",
  ]).toContain(result.truthVerdict);
  expect(stringField(result, "verdictSummary").length).toBeGreaterThan(20);
  expect(stringField(result, "verdictSummary")).not.toMatch(
    /epistemic|hermeneutic|aforementioned|whereas/i,
  );

  const citations = arrayField(citationsValue);
  const knownCitationIds = new Set(citations.map((citation) => citation.id));
  const checks = arrayField(result.claimChecks);
  expect(checks.length).toBeGreaterThanOrEqual(1);
  expect(checks.length).toBeLessThanOrEqual(4);

  for (const check of checks) {
    expect(stringField(check, "claim").length).toBeGreaterThan(5);
    expect([
      "true",
      "mostly_true",
      "mixed",
      "mostly_false",
      "false",
      "unverifiable",
    ]).toContain(check.verdict);
    expect(stringField(check, "explanation").length).toBeGreaterThan(10);
    expect(Array.isArray(check.citationIds)).toBe(true);
    const citationIds = check.citationIds as unknown[];
    expect(
      citationIds.every(
        (id) => typeof id === "string" && knownCitationIds.has(id),
      ),
    ).toBe(true);
    if (check.verdict !== "unverifiable")
      expect(citationIds.length).toBeGreaterThan(0);
  }
}
