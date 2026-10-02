import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { POST } from "@/app/api/district/lookup/route";

function request(body: unknown) {
  return new NextRequest("http://localhost/api/district/lookup", { method: "POST", body: JSON.stringify(body), headers: { "Content-Type": "application/json" } });
}
function censusPayload(state = "NY", district = "10", congress = 119) {
  return { result: { addressMatches: [{ matchedAddress: "PRIVATE ADDRESS", coordinates: { x: -73.99, y: 40.7 }, geographies: {
    States: [{ STUSAB: state }],
    [`${congress}th Congressional Districts`]: [{ BASENAME: district }],
  } }] } };
}

beforeEach(() => {
  vi.stubEnv("CENSUS_GEOCODER_ENABLED", "true");
  vi.stubEnv("CENSUS_GEOCODER_LIVE", "true");
  vi.stubEnv("CURRENT_CONGRESS", "119");
  vi.stubEnv("CONGRESS_API_KEY", "");
});
afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); });

describe("district lookup truthfulness and privacy", () => {
  it("returns unavailable with no unrelated representatives on upstream failure", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("unreachable")));
    const response = await POST(request({ address: "Private street in New York NY 10001" }));
    expect(await response.json()).toMatchObject({ status: "unavailable", source: "unavailable", houseMembers: [], senators: [] });
    expect(response.headers.get("cache-control")).toContain("no-store");
  });

  it("matches NY without substituting California representatives or echoing precise location", async () => {
    const fetcher = vi.fn().mockResolvedValue(Response.json(censusPayload()));
    vi.stubGlobal("fetch", fetcher);
    const body = await (await POST(request({ address: "Private street in New York NY 10001" }))).json();
    expect(body).toMatchObject({ status: "matched", stateCode: "NY", district: "10", memberSource: "unavailable", houseMembers: [], senators: [] });
    expect(body).not.toHaveProperty("matchedAddress");
    expect(body).not.toHaveProperty("coordinates");
    expect(new URL(String(fetcher.mock.calls[0][0])).searchParams.get("vintage")).toBe("ACS2025_Current");
  });

  it("does not apply future election districts to current representatives", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(Response.json(censusPayload("NY", "10", 120))));
    const body = await (await POST(request({ latitude: 40.7, longitude: -73.99 }))).json();
    expect(body).toMatchObject({ status: "not_found", houseMembers: [], senators: [] });
  });

  it("shows a saved sample only when explicitly requested and makes no provider request", async () => {
    const fetcher = vi.fn();
    vi.stubGlobal("fetch", fetcher);
    const body = await (await POST(request({ demo: true }))).json();
    expect(body).toMatchObject({ status: "demo", source: "fixture", stateCode: "CA", district: "11", sourceDate: "2026-07-06" });
    expect(body.message).toContain("not a lookup of your location");
    expect(fetcher).not.toHaveBeenCalled();
  });

  it("supports an at-large delegate district and does not invent senators for DC", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(Response.json(censusPayload("DC", "Delegate District (at Large)"))));
    const body = await (await POST(request({ address: "1600 Pennsylvania Ave NW, Washington, DC 20500" }))).json();
    expect(body).toMatchObject({ status: "matched", stateCode: "DC", district: "At-Large", senators: [] });
  });
});
