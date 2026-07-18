import { afterEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const { feedMock } = vi.hoisted(() => ({ feedMock: vi.fn() }));

vi.mock("@/lib/civic/trending-bills", () => ({
  getTrendingBillsFeed: feedMock,
  MAX_TRENDING_BILL_LIMIT: 24,
  MIN_TRENDING_BILL_LIMIT: 1,
  TRENDING_BILL_LIMIT: 16,
}));

import { GET } from "@/app/api/bills/recent/route";

describe("recent bills route cache", () => {
  afterEach(() => {
    vi.useRealTimers();
    feedMock.mockReset();
  });

  it("hydrates the 24-card maximum, exposes cache headers, and retains stale success after refresh failure", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-07-09T12:00:00Z"));
    feedMock.mockResolvedValueOnce(feedWithLiveCards(24));

    const first = await GET(
      new NextRequest("http://localhost/api/bills/recent?limit=24"),
    );
    const firstBody = await first.json();

    expect(feedMock).toHaveBeenCalledWith({ congress: 119, limit: 24 });
    expect(firstBody.results).toHaveLength(24);
    expect(firstBody.composition).toEqual({
      kind: "live",
      liveCount: 24,
      fixtureCount: 0,
    });
    expect(first.headers.get("cache-control")).toMatch(
      /s-maxage=900.*stale-while-revalidate=3600/,
    );

    vi.advanceTimersByTime(16 * 60 * 1_000);
    feedMock.mockRejectedValueOnce(new Error("refresh failed"));
    const stale = await GET(
      new NextRequest("http://localhost/api/bills/recent?limit=17"),
    );
    const staleBody = await stale.json();

    expect(feedMock).toHaveBeenCalledTimes(2);
    expect(staleBody.results).toHaveLength(17);
    expect(staleBody.composition).toEqual({
      kind: "live",
      liveCount: 17,
      fixtureCount: 0,
    });
  });
});

function feedWithLiveCards(count: number) {
  return {
    mode: "live",
    congress: 119,
    composition: {
      kind: "live",
      liveCount: count,
      fixtureCount: 0,
    },
    results: Array.from({ length: count }, (_, index) => ({
      mode: "live",
      title: `Bill ${index + 1}`,
    })),
  };
}
