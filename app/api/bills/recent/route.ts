import { NextRequest, NextResponse } from "next/server";
import {
  getTrendingBillsFeed,
  MAX_TRENDING_BILL_LIMIT,
  MIN_TRENDING_BILL_LIMIT,
  TRENDING_BILL_LIMIT,
} from "../../../../lib/civic/trending-bills";

const FEED_CACHE_TTL_MS = 15 * 60 * 1_000;

let cachedFeed:
  | {
      congress: number;
      expiresAt: number;
      promise: ReturnType<typeof getTrendingBillsFeed>;
    }
  | undefined;
let lastSuccessfulFeed:
  | {
      congress: number;
      value: Awaited<ReturnType<typeof getTrendingBillsFeed>>;
    }
  | undefined;

export async function GET(request: NextRequest) {
  const congress = Number(
    process.env.CURRENT_CONGRESS ?? process.env.DEFAULT_CONGRESS ?? 119,
  );
  const rawLimit = Number(
    request.nextUrl.searchParams.get("limit") ?? TRENDING_BILL_LIMIT,
  );
  const requestedLimit = Number.isFinite(rawLimit)
    ? Math.min(
        MAX_TRENDING_BILL_LIMIT,
        Math.max(MIN_TRENDING_BILL_LIMIT, Math.trunc(rawLimit)),
      )
    : TRENDING_BILL_LIMIT;
  const feed = await getCachedTrendingBillsFeed(congress);
  const results = feed.results.slice(0, requestedLimit);
  const liveCount = results.filter((card) => card.mode === "live").length;
  const fixtureCount = results.length - liveCount;

  return NextResponse.json(
    {
      ...feed,
      composition: {
        kind:
          liveCount > 0 && fixtureCount > 0
            ? "mixed"
            : liveCount > 0
              ? "live"
              : "fixture",
        liveCount,
        fixtureCount,
      },
      results,
    },
    {
      headers: {
        "Cache-Control": "public, s-maxage=900, stale-while-revalidate=3600",
      },
    },
  );
}

function getCachedTrendingBillsFeed(congress: number) {
  const now = Date.now();
  if (
    cachedFeed &&
    cachedFeed.congress === congress &&
    cachedFeed.expiresAt > now
  ) {
    return cachedFeed.promise;
  }

  const promise = getTrendingBillsFeed({
    congress,
    limit: MAX_TRENDING_BILL_LIMIT,
  })
    .then((feed) => {
      lastSuccessfulFeed = { congress, value: feed };
      return feed;
    })
    .catch((error) => {
      if (lastSuccessfulFeed?.congress === congress) {
        return lastSuccessfulFeed.value;
      }
      cachedFeed = undefined;
      throw error;
    });
  cachedFeed = {
    congress,
    expiresAt: now + FEED_CACHE_TTL_MS,
    promise,
  };
  return promise;
}
