import { describe, expect, it, vi } from "vitest";
import { createCongressClient } from "@/lib/clients/congress-client";
import { createCensusClient } from "@/lib/clients/census-client";

describe("official civic client identity", () => {
  it("never substitutes an unrelated saved bill when a reference is unavailable", async () => {
    const client = createCongressClient({ env: {} });
    await expect(client.getBill({ raw: "H.R. 999999", congress: 119, type: "hr", number: 999999 })).rejects.toMatchObject({ code: "NOT_FOUND" });
    expect(await client.searchBills("completely unrelated search term")).toEqual([]);
  });

  it("filters keyword results instead of treating an ignored query parameter as search", async () => {
    const fetcher = vi.fn().mockResolvedValue(Response.json({ bills: [
      { congress: 119, type: "HR", number: "10", title: "Student Education Act" },
      { congress: 119, type: "HR", number: "11", title: "Defense Procurement Act" },
    ] }));
    const client = createCongressClient({ apiKey: "test-key", fetcher, env: {} });
    const results = await client.searchBills("student");
    expect(results).toHaveLength(1);
    expect(results[0]).toMatchObject({ number: 10, source: "live", url: "https://www.congress.gov/bill/119th-congress/house-bill/10" });
    const url = new URL(String(fetcher.mock.calls[0][0]));
    expect(url.pathname).toBe("/v3/bill/119");
    expect(url.searchParams.has("query")).toBe(false);
  });

  it("rejects a mismatched official response instead of assigning it the requested identity", async () => {
    const fetcher = vi.fn().mockResolvedValue(Response.json({ bill: { congress: 119, type: "HR", number: 11, title: "Other bill" } }));
    const client = createCongressClient({ apiKey: "test-key", fetcher, env: {} });
    await expect(client.getBill({ raw: "", congress: 119, type: "hr", number: 10 })).rejects.toMatchObject({ code: "NOT_FOUND" });
  });

  it("marks live geocoder failures as errors without silently becoming a sample district", async () => {
    const client = createCensusClient({ live: true, env: {}, fetcher: vi.fn().mockRejectedValue(new Error("offline")) });
    expect(await client.lookupDistrict("A valid public street address")).toMatchObject({ status: "error", source: "live", houseMembers: [], senators: [] });
  });
});
