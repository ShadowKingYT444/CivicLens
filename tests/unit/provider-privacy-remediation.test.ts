import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { POST as analyzePost } from "@/app/api/analyze/route";
import { POST as districtPost } from "@/app/api/district/lookup/route";
import { GET as searchGet } from "@/app/api/search/route";
import { GET as healthGet } from "@/app/api/health/route";
import { generateAnalysis } from "@/lib/ai/llm-client";
import { DistrictLookupResultSchema, type Citation } from "@/lib/ai/schemas";
import { redactSensitiveText, validateCitations } from "@/lib/ai/validators";

const originalEnv = { ...process.env };
const providerKeys = /API_KEY|DATABASE_URL|STORE_ANALYSES|STORE_RAW_INPUTS|CENSUS_|OFFICIAL_SOURCE_|ENABLE_|LLM_|NIM_|DEMO_MODE|GOVINFO_|FEDERAL_REGISTER_|REGULATIONS_|ECFR_|NARA_|COURTLISTENER_|USASPENDING_|OPENFEC_|WHITEHOUSE_|OPENAI_|EMBEDDING/;
const sensitive = ["123A Main Street", "qa@example.com", "415-555-0100", "123-45-6789", "37.779123", "-122.419456"];
const searchQuery = "EPA rules 123A Main Street qa@example.com 415-555-0100 SSN 123-45-6789 37.779123, -122.419456";
const claim = `At 123A Main Street, contact qa@example.com or 415-555-0100; SSN 123-45-6789; location 37.779123, -122.419456; did H.R. 82 become law?`;
const citations: Citation[] = [{ id: "c1", sourceDocumentId: "bill-118-hr-82", sourceType: "bill", title: "H.R. 82", url: "https://www.congress.gov/bill/118th-congress/house-bill/82", excerpt: "H.R. 82 became Public Law 118-273.", bill: { congress: 118, type: "hr", number: 82 } }];

function request(path: string, body: unknown) {
  return new NextRequest(`http://localhost${path}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
}
function assertPrivateValuesAbsent(value: unknown) {
  const text = decodeURIComponent(JSON.stringify(value));
  for (const privateValue of sensitive) expect(text).not.toContain(privateValue);
}
function census(state = "36", district = "10") {
  return Response.json({ result: { addressMatches: [{ matchedAddress: "123 QA Avenue, Test Town", coordinates: { x: -74, y: 40.7 }, geographies: { States: [{ STATE: state }], "119th Congressional Districts": [{ STATE: state, CD119FP: district }] } }] } });
}
function configureCensus() { process.env.CENSUS_GEOCODER_LIVE = "true"; }
function mockDatabase() {
  process.env.DATABASE_URL = "postgresql://qa.invalid/synthetic";
  const query = vi.fn().mockResolvedValue([]);
  Object.assign(globalThis, { civicLensPrisma: Promise.resolve({ $queryRawUnsafe: query }) });
  return query;
}

beforeEach(() => {
  process.env = { ...originalEnv };
  for (const key of Object.keys(process.env)) if (providerKeys.test(key)) delete process.env[key];
  vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("Unexpected outbound call blocked by regression suite")));
});
afterEach(() => {
  vi.useRealTimers(); vi.unstubAllGlobals(); process.env = { ...originalEnv };
  Reflect.deleteProperty(globalThis, "civicLensPrisma");
});

describe("provider privacy remediation", () => {
  it("uses complete redaction for analysis, retrieval and models", async () => {
    assertPrivateValuesAbsent(redactSensitiveText(claim));
    process.env.LLM_API_KEY = "qa-synthetic-key";
    const fetchMock = vi.fn().mockResolvedValue(Response.json({}, { status: 503 }));
    vi.stubGlobal("fetch", fetchMock);
    const result = await generateAnalysis({ claim, citations });
    assertPrivateValuesAbsent(result);
    expect(fetchMock).toHaveBeenCalledOnce();
    assertPrivateValuesAbsent(JSON.parse(fetchMock.mock.calls[0][1].body));
  });
  it.each(["123A Main Street", "P.O. Box 123", "RR 2 Box 42", "12 State Highway 10"])("redacts address form %s", (address) => {
    expect(redactSensitiveText(`Policy at ${address} concerns H.R. 82.`)).not.toContain(address);
    expect(redactSensitiveText(`Policy at ${address} concerns H.R. 82.`)).toContain("H.R. 82");
  });
  it("removes the entire coordinate pair, including leading minus sign", () => {
    expect(redactSensitiveText("-37.779123, -122.419456")).toBe("[redacted coordinates]");
  });
  it("redacts the actual unconfigured analysis API response", async () => {
    const response = await analyzePost(request("/api/analyze", { claim }));
    const body = await response.json();
    expect(response.status).toBe(200); expect(body.mode).toBe("demo");
    assertPrivateValuesAbsent(body); expect(fetch).not.toHaveBeenCalled();
  });
  it("redacts search before provider queries and returned citation URLs", async () => {
    process.env.FEDERAL_REGISTER_API_BASE = "http://127.0.0.1:3219/federal-register";
    const fetchMock = vi.fn().mockResolvedValue(Response.json({}, { status: 503 })); vi.stubGlobal("fetch", fetchMock);
    const response = await searchGet(new NextRequest("http://localhost/api/search?q=" + encodeURIComponent(searchQuery)));
    const body = await response.json();
    assertPrivateValuesAbsent(body); assertPrivateValuesAbsent(fetchMock.mock.calls);
    expect(fetchMock.mock.calls[0][0]).toContain("http://127.0.0.1:3219/federal-register");
    expect(body.mode).toBe("demo");
  });
  it("redacts search before configured embedding requests", async () => {
    mockDatabase(); process.env.EMBEDDINGS_API_KEY = "qa-synthetic-key";
    const fetchMock = vi.fn().mockResolvedValue(Response.json({ data: [{ embedding: Array(1536).fill(0.01) }] })); vi.stubGlobal("fetch", fetchMock);
    await searchGet(new NextRequest("http://localhost/api/search?q=" + encodeURIComponent(searchQuery)));
    expect(fetchMock).toHaveBeenCalledOnce(); assertPrivateValuesAbsent(JSON.parse(fetchMock.mock.calls[0][1].body));
  });
  it.each(["SECRET987", JSON.stringify({ status: "answered", "qa-synthetic-key": "SECRET987" })])("does not echo malformed provider diagnostics %#", async (content) => {
    process.env.LLM_API_KEY = "qa-synthetic-key";
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(Response.json({ choices: [{ message: { content } }] })));
    const result = await generateAnalysis({ claim: "Did H.R. 82 become law?", citations });
    expect(result.mode).toBe("demo");
    expect(JSON.stringify(result)).not.toMatch(/SECRET987|qa-synthetic-key/);
    expect(result.warnings.join(" ")).toContain("invalid analysis JSON");
  });
  it("does not echo network exception secrets, addresses or contact details", async () => {
    process.env.LLM_API_KEY = "qa-synthetic-key";
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("Bearer qa-synthetic-key failed: " + claim)));
    const body = await (await analyzePost(request("/api/analyze", { claim: "Did H.R. 82 become law?" }))).json();
    expect(body.mode).toBe("demo"); assertPrivateValuesAbsent(body);
    expect(JSON.stringify(body)).not.toContain("qa-synthetic-key");
  });
  it("does not echo unknown model citation identifiers into validation warnings", async () => {
    process.env.LLM_API_KEY = "qa-synthetic-key";
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(Response.json({ choices: [{ message: { content: JSON.stringify({ status: "answered", evidenceStatus: "grounded", normalizedClaim: "Did H.R. 82 become law?", truthVerdict: "true", verdictSummary: "Supported", claimChecks: [{ claim: "H.R. 82 became law.", verdict: "true", explanation: "Supported", citationIds: ["qa-synthetic-key"] }], oneSentenceAnswer: "Supported", studentExplanation: "Supported", keyContext: [], whatOfficialSourcesSay: [], contextGaps: [], framingFlags: [], quiz: [] }) } }] })));
    const result = await generateAnalysis({ claim: "Did H.R. 82 become law?", citations });
    expect(result.mode).toBe("demo"); expect(JSON.stringify(result)).not.toContain("qa-synthetic-key");
  });
  it("hash-only storage excludes PII, unique claim text, citation queries, and derived text", async () => {
    const query = mockDatabase(); process.env.STORE_ANALYSES = "true"; process.env.STORE_RAW_INPUTS = "false";
    process.env.FEDERAL_REGISTER_API_BASE = "https://www.federalregister.gov/api/v1"; process.env.OFFICIAL_SOURCE_FETCH = "false";
    const privateClaim = "UNIQUE_QA_CLAIM_43 " + searchQuery;
    const body = await (await analyzePost(request("/api/analyze", { claim: privateClaim }))).json();
    expect(body.storage.stored).toBe(true);
    const insert = query.mock.calls.find((call) => String(call[0]).includes("INSERT INTO analyses"));
    expect(insert).toBeDefined(); expect(insert![1]).toMatch(/^[a-f0-9]{64}$/); expect(insert![2]).toBeNull();
    assertPrivateValuesAbsent(insert);
    expect(decodeURIComponent(JSON.stringify(insert))).not.toContain("UNIQUE_QA_CLAIM_43");
    const storedCitations = JSON.parse(insert![4]);
    expect(storedCitations.length).toBeGreaterThan(0);
    for (const citation of storedCitations) {
      expect(new URL(citation.url).search).toBe("");
      expect(citation).not.toHaveProperty("excerpt"); expect(citation).not.toHaveProperty("title");
    }
  });
  it("raw-input-enabled storage still redacts known sensitive identifiers", async () => {
    const query = mockDatabase(); process.env.STORE_ANALYSES = "true"; process.env.STORE_RAW_INPUTS = "true";
    await analyzePost(request("/api/analyze", { claim }));
    const insert = query.mock.calls.find((call) => String(call[0]).includes("INSERT INTO analyses"));
    expect(insert).toBeDefined(); assertPrivateValuesAbsent(insert);
    expect(insert![2]).toContain("[redacted ssn]");
  });
  it.each(["http://www.congress.gov/bill/118/hr/82", "ftp://www.congress.gov/bill/118/hr/82", "https://qa-secret@www.congress.gov/bill/118/hr/82"])("rejects unsafe citation URL %s", (url) => {
    expect(validateCitations([{ ...citations[0], url }]).ok).toBe(false);
  });
});

describe("district lookup remediation", () => {
  it("unconfigured mode is demo and does not geocode remotely", async () => {
    const health = await (await healthGet()).json();
    const body = await (await districtPost(request("/api/district/lookup", { address: "123 QA Avenue" }))).json();
    expect(health.censusGeocoderConfigured).toBe(false); expect(body.status).toBe("demo");
    expect(body.representativesMode).toBe("fixture"); expect(fetch).not.toHaveBeenCalled();
  });
  it("demo mode disables a configured Census endpoint unless explicitly enabled", async () => {
    process.env.DEMO_MODE = "true"; process.env.CENSUS_GEOCODER_BASE_URL = "http://127.0.0.1:3219/geocoder";
    const body = await (await districtPost(request("/api/district/lookup", { address: "123 QA Avenue" }))).json();
    expect(body.status).toBe("demo"); expect(fetch).not.toHaveBeenCalled();
  });
  it.each([["36", "10", "NY"], ["02", "00", "AK"], ["06", "11", "CA"]])("never substitutes fixture members for matched %s/%s", async (state, district, code) => {
    configureCensus(); vi.stubGlobal("fetch", vi.fn().mockResolvedValue(census(state, district)));
    const body = await (await districtPost(request("/api/district/lookup", { address: "123 QA Avenue" }))).json();
    expect(body.status).toBe("matched"); expect(body.stateCode).toBe(code);
    expect(body.houseMembers).toEqual([]); expect(body.senators).toEqual([]);
    expect(body.representativesMode).toBe("unavailable"); expect(body.warnings.length).toBeGreaterThan(0);
    expect(DistrictLookupResultSchema.safeParse(body).success).toBe(true);
  });
  it("missing geographies do not turn input coordinates into a matched district", async () => {
    configureCensus(); vi.stubGlobal("fetch", vi.fn().mockResolvedValue(Response.json({ result: {} })));
    const body = await (await districtPost(request("/api/district/lookup", { latitude: 42, longitude: -71 }))).json();
    expect(body.status).toBe("not_found"); expect(body.houseMembers).toEqual([]); expect(body.senators).toEqual([]);
  });
  it("invalid provider URL is caught and safely returns demo", async () => {
    configureCensus(); process.env.CENSUS_GEOCODER_URL = "invalid-base";
    const body = await (await districtPost(request("/api/district/lookup", { address: "123 QA Avenue" }))).json();
    expect(body.status).toBe("demo"); expect(fetch).not.toHaveBeenCalled();
  });
  it.each(["fetch", "body"])("bounded Census %s stall aborts and falls back", async (phase) => {
    configureCensus(); process.env.CENSUS_TIMEOUT_MS = "25"; vi.useFakeTimers();
    const never = new Promise<Response>(() => {});
    const fetchMock = vi.fn().mockImplementation(() => phase === "fetch" ? never : Promise.resolve({ ok: true, json: () => new Promise(() => {}) }));
    vi.stubGlobal("fetch", fetchMock);
    const promise = districtPost(request("/api/district/lookup", { address: "123 QA Avenue" }));
    await vi.advanceTimersByTimeAsync(26);
    const body = await (await promise).json();
    expect(body.status).toBe("demo"); expect(fetchMock.mock.calls[0][1].signal.aborted).toBe(true);
  });
  it("Congress member failure returns empty data rather than wrong-state fixtures", async () => {
    configureCensus(); process.env.CONGRESS_API_KEY = "qa-synthetic-key";
    vi.stubGlobal("fetch", vi.fn().mockImplementation((url) => String(url).includes("geocoder") ? Promise.resolve(census()) : Promise.resolve(Response.json({}, { status: 503 }))));
    const body = await (await districtPost(request("/api/district/lookup", { address: "123 QA Avenue" }))).json();
    expect(body.status).toBe("matched"); expect(body.stateCode).toBe("NY");
    expect(body.houseMembers).toEqual([]); expect(body.senators).toEqual([]);
  });
  it("filters explicit member geography while keeping correctly matched live members", async () => {
    configureCensus(); process.env.CONGRESS_API_KEY = "qa-synthetic-key";
    const members = [
      { name: "QA House Member", state: "New York", district: 10, terms: { item: [{ chamber: "House of Representatives" }] } },
      { name: "QA Other District", state: "NY", district: 11, terms: { item: [{ chamber: "House of Representatives" }] } },
      { name: "QA California Member", state: "CA", district: 10, terms: { item: [{ chamber: "House of Representatives" }] } },
      { name: "QA Senator", state: "New York", terms: { item: [{ chamber: "Senate" }] } },
      { name: "QA California Senator", state: "CA", terms: { item: [{ chamber: "Senate" }] } },
    ];
    vi.stubGlobal("fetch", vi.fn().mockImplementation((url) => String(url).includes("geocoder") ? Promise.resolve(census()) : Promise.resolve(Response.json({ members }))));
    const body = await (await districtPost(request("/api/district/lookup", { address: "123 QA Avenue" }))).json();
    expect(body.houseMembers.map((m: {name: string}) => m.name)).toEqual(["QA House Member"]);
    expect(body.senators.map((m: {name: string}) => m.name)).toEqual(["QA Senator"]);
    expect(body.representativesMode).toBe("live");
  });
});
