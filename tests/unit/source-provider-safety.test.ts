import { afterEach, describe, expect, it, vi } from "vitest";
import {
  buildOfficialSourceCandidates,
  resolveOfficialSourceCandidates,
} from "@/lib/civic/official-source-connectors";
import {
  fetchCongressBill,
  retrieveGroundedSources,
} from "@/lib/civic/source-grounder";

const dbMocks = vi.hoisted(() => ({
  vectors: vi.fn(async () => []),
  lexical: vi.fn(async () => []),
}));
vi.mock("@/lib/db/vector-search", () => ({
  searchDatabaseVectors: dbMocks.vectors,
}));
vi.mock("@/lib/db/lexical-search", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/db/lexical-search")>()),
  searchDatabaseLexically: dbMocks.lexical,
}));
const originalEnv = { ...process.env };
const privateQuery =
  "EPA final rule 123A Main Street qa@example.com SSN 123-45-6789 location 37.779123, -122.419456";
const privateValues = [
  "123A Main",
  "qa@example.com",
  "123-45-6789",
  "37.779123",
  "-122.419456",
];
function expectPrivateValuesAbsent(value: unknown) {
  const text = decodeURIComponent(JSON.stringify(value));
  for (const token of privateValues) expect(text).not.toContain(token);
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
  vi.clearAllMocks();
  process.env = { ...originalEnv };
});

describe("source provider safety", () => {
  it("redacts private input before discovery URLs, provider requests, and vector retrieval", async () => {
    const env = { FEDERAL_REGISTER_API_BASE: "http://127.0.0.1:3219/fr/v1" };
    expectPrivateValuesAbsent(
      buildOfficialSourceCandidates(privateQuery, 1, env),
    );
    const fetcher = vi.fn(async () => Response.json({ results: [] }));
    expectPrivateValuesAbsent(
      await resolveOfficialSourceCandidates(privateQuery, 1, { env, fetcher }),
    );
    expectPrivateValuesAbsent(fetcher.mock.calls);
    process.env = {
      ...originalEnv,
      DATABASE_URL: "",
      OFFICIAL_SOURCE_FETCH: "false",
      ...env,
    };
    const result = await retrieveGroundedSources(privateQuery, 4);
    expect(result.mode).toBe("demo");
    expectPrivateValuesAbsent(dbMocks.vectors.mock.calls);
    expectPrivateValuesAbsent(dbMocks.lexical.mock.calls);
    expectPrivateValuesAbsent(result);
  });

  it.each([
    ["FEDERAL_REGISTER_API_BASE", "EPA final rule", "documents.json"],
    ["ECFR_API_BASE", "CFR regulation", "search/v1/results"],
    ["NARA_CATALOG_API_BASE", "constitution archives", "records/search"],
    ["COURTLISTENER_API_BASE", "court opinion", "search/"],
    [
      "USASPENDING_API_BASE",
      "federal spending award",
      "api/v2/search/spending_by_award/",
    ],
    ["WHITEHOUSE_BASE", "president statement", "wp-json/wp/v2/search"],
    ["REGULATIONS_API_BASE", "rulemaking docket", "documents"],
    ["GOVINFO_API_BASE", "public law", "search"],
    ["OPENFEC_API_BASE", "campaign finance", "candidates/search/"],
  ])(
    "honors %s without contacting a default host",
    async (key, query, path) => {
      const base = "http://127.0.0.1:3219/custom/v7";
      const fetcher = vi.fn<typeof fetch>(async () => Response.json({}));
      const [candidate] = await resolveOfficialSourceCandidates(query, 1, {
        env: {
          [key]: base,
          ...(key === "GOVINFO_API_BASE"
            ? { GOVINFO_API_KEY: "synthetic" }
            : {}),
          ...(key === "OPENFEC_API_BASE"
            ? { OPENFEC_API_KEY: "synthetic" }
            : {}),
        },
        fetcher,
      });
      expect(candidate.live).toBe(false);
      expect(fetcher).toHaveBeenCalledOnce();
      expect(String(fetcher.mock.calls[0]?.[0])).toMatch(
        new RegExp(
          `^${base}/${path.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(?:\\?|$)`,
        ),
      );
    },
  );

  it.each([
    {},
    { results: [] },
    { results: [{}] },
    { results: [{ unexpected: "payload" }] },
    null,
    "wrong shape",
  ])("keeps malformed or empty payload %j as discovery", async (payload) => {
    const [candidate] = await resolveOfficialSourceCandidates(
      "EPA final rule",
      1,
      {
        env: { FEDERAL_REGISTER_API_BASE: "http://127.0.0.1:3219/api/v1" },
        fetcher: async () => Response.json(payload),
      },
    );
    expect(candidate.live).toBe(false);
    expect(candidate.citation.sourceDocumentId).toBe(
      "federal-register-configured-search",
    );
  });

  it("labels only fetched validated records as live and redacts provider echoes", async () => {
    process.env = {
      ...originalEnv,
      DATABASE_URL: "",
      FEDERAL_REGISTER_API_BASE: "http://127.0.0.1:3219/api/v1",
    };
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        Response.json({
          results: [
            {
              title: privateQuery,
              document_number: "2026-001",
              abstract: privateQuery,
              html_url: `https://www.federalregister.gov/documents/2026/001?query=${encodeURIComponent(privateQuery)}#qa@example.com`,
            },
          ],
        }),
      ),
    );
    const result = await retrieveGroundedSources("EPA final rule", 3);
    expect(result.mode).toBe("live");
    expectPrivateValuesAbsent(result);
  });

  it("does not report rejected fetched citations as live or pass their documents onward", async () => {
    process.env = {
      ...originalEnv,
      DATABASE_URL: "",
      FEDERAL_REGISTER_API_BASE: "http://127.0.0.1:3219/api/v1",
    };
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        Response.json({
          results: [
            {
              title: "Untrusted result",
              document_number: "2026-002",
              abstract: "Unsupported content.",
              html_url: "https://untrusted.example/record",
            },
          ],
        }),
      ),
    );
    const result = await retrieveGroundedSources("EPA final rule", 3);
    expect(result.mode).toBe("demo");
    expect(
      result.documents.some(
        (document) => document.id === "official-federal-register",
      ),
    ).toBe(false);
    expect(JSON.stringify(result.documents)).not.toContain("Untrusted result");
  });

  it.each(["fetch", "body"])(
    "bounds a stalled %s and returns discovery",
    async (stage) => {
      vi.useFakeTimers();
      let signal: AbortSignal | undefined;
      const pending = resolveOfficialSourceCandidates("EPA final rule", 1, {
        env: { FEDERAL_REGISTER_API_BASE: "http://127.0.0.1:3219/api/v1" },
        timeoutMs: 25,
        fetcher: async (_input, init) => {
          signal = init?.signal as AbortSignal;
          if (stage === "fetch") return new Promise<Response>(() => undefined);
          return {
            ok: true,
            json: () => new Promise(() => undefined),
          } as unknown as Response;
        },
      });
      await vi.advanceTimersByTimeAsync(26);
      expect((await pending)[0].live).toBe(false);
      expect(signal?.aborted).toBe(true);
    },
  );
});

describe("Congress response identity", () => {
  function configure(bill: unknown, stalledBody = false) {
    process.env = {
      ...originalEnv,
      CONGRESS_API_KEY: "synthetic",
      CONGRESS_API_BASE_URL: "http://127.0.0.1:3219/v3",
      CONGRESS_TIMEOUT_MS: "1000",
    };
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: unknown) => {
        if (stalledBody)
          return {
            ok: true,
            json: () => new Promise(() => undefined),
          } as unknown as Response;
        const url = String(input);
        if (url.includes("/summaries?"))
          return Response.json({ summaries: [{ text: "Official summary." }] });
        if (url.includes("/actions?")) return Response.json({ actions: [] });
        return Response.json({ bill });
      }),
    );
  }

  it.each([
    { congress: 117 },
    { number: 123 },
    { type: "S" },
    { congress: "invalid" },
    { number: null },
    { type: {} },
  ])("rejects mismatched or invalid explicit identity %j", async (identity) => {
    configure({ title: "Unrelated bill", ...identity });
    expect(await fetchCongressBill(118, "hr", 82)).toBeNull();
  });

  it.each([{ congress: 118, type: "HR", number: "82" }, {}])(
    "accepts compatible or absent identity %j",
    async (identity) => {
      configure({ title: "Matching bill", ...identity });
      const result = await fetchCongressBill(118, "hr", 82);
      expect(result?.mode).toBe("live");
      expect(result?.citations[0].bill).toEqual({
        congress: 118,
        type: "hr",
        number: 82,
      });
    },
  );

  it("bounds stalled Congress response bodies with safe null fallback", async () => {
    vi.useFakeTimers();
    configure({}, true);
    const pending = fetchCongressBill(118, "hr", 82);
    await vi.advanceTimersByTimeAsync(1001);
    expect(await pending).toBeNull();
  });
});
