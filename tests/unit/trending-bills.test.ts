import { describe, expect, it, vi } from "vitest";
import {
  buildBillCitationPacket,
  createDeterministicBillExplainer,
} from "@/lib/ai/bill-enrichment";
import {
  getDemoTrendingBills,
  getTrendingBillsFeed,
  MAX_TRENDING_BILL_LIMIT,
  rankLiveBillCandidates,
  TRENDING_BILL_LIMIT,
  type TrendingBillCard,
} from "@/lib/civic/trending-bills";
import type {
  CongressBillDetail,
  CongressClient,
  CongressSearchResult,
} from "@/lib/clients/congress-client";

describe("trending bills feed", () => {
  it("ships a deterministic high-impact demo deck with flashcard-ready cited fields", () => {
    const cards = getDemoTrendingBills();

    expect(cards).toHaveLength(TRENDING_BILL_LIMIT);
    expect(cards.length).toBeGreaterThanOrEqual(12);
    expect(new Set(cards.map((card) => card.href)).size).toBe(cards.length);
    expect(
      new Set(cards.map((card) => card.issueArea)).size,
    ).toBeGreaterThanOrEqual(10);
    expect(cards[0]).toMatchObject({
      mode: "fixture",
      impactLabel: expect.stringMatching(/high impact/i),
      detailRouteTarget: "/bills/119/hr/1",
      bill: {
        congress: 119,
        type: "hr",
        number: 1,
      },
    });

    for (const card of cards) {
      expect(card.hook).toBeTruthy();
      expect(card.keyPoints.length).toBeGreaterThanOrEqual(3);
      expect(card.keyPoints.length).toBeLessThanOrEqual(5);
      expect(card.currentStep.label).toBeTruthy();
      expect(card.whyItMatters.text).toBeTruthy();
      expect(card.whatChanges.text).toBeTruthy();
      expect(card.whoIsAffected.text).toBeTruthy();
      expect(card.enrichment).toEqual({
        method: "deterministic",
        officialDetail: true,
      });
      expect(card.citations.length).toBeGreaterThanOrEqual(1);
      expect(card.href).toBe(card.detailRouteTarget);
      expect(card.url).toMatch(/^https:\/\/www\.congress\.gov\/bill\//);
      expect(allCitationIdsArePresent(card)).toBe(true);
      expect(
        card.citations.every((citation) =>
          citationMatchesCard(citation.url, card),
        ),
      ).toBe(true);
    }
  });

  it("clamps demo and live limits to the 1-24 API contract", async () => {
    expect(getDemoTrendingBills(0)).toHaveLength(1);
    expect(getDemoTrendingBills(Number.NaN)).toHaveLength(TRENDING_BILL_LIMIT);
    expect(getDemoTrendingBills(10_000).length).toBeLessThanOrEqual(
      MAX_TRENDING_BILL_LIMIT,
    );

    const bills = Array.from({ length: 40 }, (_, index) =>
      liveBill({
        number: 500 + index,
        title: `Federal Budget and Appropriations Act ${index + 1}`,
        latestAction: "Passed House.",
      }),
    );
    let listedLimit = 0;
    let detailCalls = 0;
    const baseClient = mockCongressClient(bills);
    const client: CongressClient = {
      ...baseClient,
      async listBills(options) {
        listedLimit =
          typeof options === "number"
            ? options
            : (options?.limit ?? TRENDING_BILL_LIMIT);
        return { ok: true, source: "live", data: bills };
      },
      async getBill(ref) {
        detailCalls += 1;
        return baseClient.getBill(ref);
      },
    };

    const feed = await getTrendingBillsFeed({
      congress: 119,
      limit: 1_000_000,
      client,
    });

    expect(feed.results).toHaveLength(MAX_TRENDING_BILL_LIMIT);
    expect(listedLimit).toBeLessThanOrEqual(144);
    expect(detailCalls).toBeLessThanOrEqual(MAX_TRENDING_BILL_LIMIT);
  });

  it("ranks recent live bills toward high-impact categories and away from ceremonial records", () => {
    const ranked = rankLiveBillCandidates([
      liveBill({
        number: 100,
        title: "Federal Budget and Appropriations Act",
        latestAction: "Became Public Law No: 119-100.",
      }),
      liveBill({
        number: 101,
        title: "To designate the post office facility in Example City",
        latestAction:
          "Referred to the House Committee on Oversight and Government Reform.",
      }),
      liveBill({
        number: 102,
        title: "Mental Health and Substance Use Reauthorization Act",
        latestAction: "Passed/agreed to in House.",
      }),
    ]);

    expect(ranked[0]?.bill.number).toBe(100);
    expect(ranked[0]?.impactLabel).toMatch(/budget|taxes/i);
    expect(
      ranked.find((candidate) => candidate.bill.number === 101)?.score,
    ).toBeLessThan(0);
  });

  it("suppresses duplicate bill identities before enrichment", () => {
    const duplicateA = liveBill({
      number: 301,
      title: "Federal Budget Act",
      latestAction: "Introduced.",
    });
    const duplicateB = liveBill({
      number: 301,
      title: "Federal Budget Act",
      latestAction: "Passed House.",
    });
    const ranked = rankLiveBillCandidates([duplicateA, duplicateB]);

    expect(
      ranked.filter((candidate) => candidate.bill.number === 301),
    ).toHaveLength(1);
    expect(ranked[0]?.bill.latestAction?.text).toBe("Passed House.");
  });

  it("prefers live Congress.gov results when enough high-impact records are available", async () => {
    const client = mockCongressClient([
      liveBill({
        number: 201,
        title: "Federal Budget and Tax Act",
        latestAction: "Became Public Law No: 119-201.",
      }),
      liveBill({
        number: 202,
        title: "Public Health and Mental Health Act",
        latestAction: "Passed/agreed to in House.",
      }),
      liveBill({
        number: 203,
        title: "Immigration and Border Review Act",
        latestAction: "Presented to President.",
      }),
    ]);

    const feed = await getTrendingBillsFeed({
      congress: 119,
      limit: 3,
      client,
    });

    expect(feed.mode).toBe("live");
    expect(feed.composition).toEqual({
      kind: "live",
      liveCount: 3,
      fixtureCount: 0,
    });
    expect(feed.results).toHaveLength(3);
    expect(feed.results.every((card) => card.mode === "live")).toBe(true);
    expect(
      feed.results.every((card) =>
        card.citations.some(
          (citation) => citation.publisher === "Congress.gov",
        ),
      ),
    ).toBe(true);
    expect(feed.results.every(allCitationIdsArePresent)).toBe(true);
    expect(feed.results.every((card) => card.enrichment.officialDetail)).toBe(
      true,
    );
    expect(
      feed.results.every((card) => card.whoIsAffected.text.length > 20),
    ).toBe(true);
  });

  it("fills a partial live deck with curated cited cards up to the requested limit", async () => {
    const client = mockCongressClient([
      liveBill({
        number: 201,
        title: "Federal Budget and Tax Act",
        latestAction: "Became Public Law No: 119-201.",
      }),
      liveBill({
        number: 202,
        title: "Public Health and Mental Health Act",
        latestAction: "Passed/agreed to in House.",
      }),
      liveBill({
        number: 203,
        title: "Immigration and Border Review Act",
        latestAction: "Presented to President.",
      }),
    ]);

    const feed = await getTrendingBillsFeed({
      congress: 119,
      limit: 5,
      client,
    });

    expect(feed.mode).toBe("live");
    expect(feed.composition).toEqual({
      kind: "mixed",
      liveCount: 3,
      fixtureCount: 2,
    });
    expect(feed.results).toHaveLength(5);
    expect(feed.results.slice(0, 3).every((card) => card.mode === "live")).toBe(
      true,
    );
    expect(feed.results.slice(3).every((card) => card.mode === "fixture")).toBe(
      true,
    );
    expect(feed.results.every(allCitationIdsArePresent)).toBe(true);
  });

  it("falls back to the curated deck when live matches are too narrow or ceremonial", async () => {
    const client = mockCongressClient([
      liveBill({
        number: 66,
        title: "Federal Employee Student Debt Transparency Act",
        latestAction:
          "Referred to the House Committee on Oversight and Government Reform.",
      }),
      liveBill({
        number: 67,
        title: "To designate the post office facility in Example City",
        latestAction:
          "Referred to the House Committee on Oversight and Government Reform.",
      }),
      liveBill({
        number: 68,
        title: "Federal Reporting Study Act",
        latestAction:
          "Referred to the House Committee on Oversight and Government Reform.",
      }),
    ]);

    const feed = await getTrendingBillsFeed({
      congress: 119,
      limit: 3,
      client,
    });

    expect(feed.mode).toBe("fixture");
    expect(feed.composition).toEqual({
      kind: "fixture",
      liveCount: 0,
      fixtureCount: 3,
    });
    expect(feed.results[0]?.detailRouteTarget).toBe("/bills/119/hr/1");
  });

  it("falls back to fixtures when the Congress listing provider rejects", async () => {
    const client = mockCongressClient([]);
    client.listBills = async () => {
      throw new Error("Congress provider unavailable");
    };

    const feed = await getTrendingBillsFeed({
      congress: 119,
      limit: 12,
      client,
    });

    expect(feed.mode).toBe("fixture");
    expect(feed.composition).toEqual({
      kind: "fixture",
      liveCount: 0,
      fixtureCount: 12,
    });
    expect(feed.results).toHaveLength(12);
    expect(feed.results.every((card) => card.mode === "fixture")).toBe(true);
  });

  it("discards mismatched bill detail instead of laundering it into a different card", async () => {
    const candidate = liveBill({
      number: 401,
      title: "Federal Budget Integrity Act",
      latestAction: "Passed House.",
    });
    const client = mockCongressClient([candidate]);
    const matchingGetter = client.getBill.bind(client);
    client.getBill = async (ref) => ({
      ...(await matchingGetter(ref)),
      number: 999,
      title: "Unrelated Health Bill",
      summaries: [
        {
          text: "This unrelated bill pays hospitals $9,999.",
          date: "2025-07-01",
        },
      ],
    });

    const feed = await getTrendingBillsFeed({
      congress: 119,
      limit: 1,
      client,
    });
    const card = feed.results[0];

    expect(feed.mode).toBe("fixture");
    expect(card.mode).toBe("fixture");
    expect(card.bill.number).not.toBe(401);
    expect(JSON.stringify(card)).not.toContain("Unrelated Health Bill");
    expect(JSON.stringify(card)).not.toContain("$9,999");
  });

  it("spends the model budget on the first successfully hydrated live details", async () => {
    const bills = Array.from({ length: 5 }, (_, index) =>
      liveBill({
        number: 601 + index,
        title: `Federal Budget Act ${index + 1}`,
        latestAction: "Passed House.",
      }),
    );
    const baseClient = mockCongressClient(bills);
    const client: CongressClient = {
      ...baseClient,
      async getBill(ref) {
        if (ref.number === 601) throw new Error("detail unavailable");
        const detail = await baseClient.getBill(ref);
        return ref.number === 602 ? { ...detail, source: "fixture" } : detail;
      },
    };
    const generateExplainer = vi.fn(async (detail: CongressBillDetail) => {
      const citations = buildBillCitationPacket(detail);
      return {
        explainer: createDeterministicBillExplainer(detail, citations),
        citations,
        method: "deterministic" as const,
      };
    });

    const feed = await getTrendingBillsFeed({
      congress: 119,
      limit: 5,
      client,
      generateExplainer,
    });

    expect(generateExplainer).toHaveBeenCalledTimes(2);
    expect(
      generateExplainer.mock.calls.map(([detail]) => detail.number),
    ).toEqual([603, 604]);
    expect(feed.composition).toEqual({
      kind: "mixed",
      liveCount: 3,
      fixtureCount: 2,
    });
  });

  it("returns fixture fill when detail hydration exceeds the overall deadline", async () => {
    const candidate = liveBill({
      number: 701,
      title: "Federal Budget Deadline Act",
      latestAction: "Passed House.",
    });
    const client = mockCongressClient([candidate]);
    client.getBill = async () => new Promise<CongressBillDetail>(() => {});

    const startedAt = Date.now();
    const feed = await getTrendingBillsFeed({
      congress: 119,
      limit: 1,
      client,
      enrichmentDeadlineMs: 250,
    });

    expect(Date.now() - startedAt).toBeLessThan(1_000);
    expect(feed.mode).toBe("fixture");
    expect(feed.results[0]?.mode).toBe("fixture");
  });
});

function allCitationIdsArePresent(card: TrendingBillCard): boolean {
  const citationIds = new Set(card.citations.map((citation) => citation.id));
  const citedFieldIds = [
    ...card.hookCitationIds,
    ...card.keyPoints.flatMap((point) => point.citationIds),
    ...card.currentStep.citationIds,
    ...card.whyItMatters.citationIds,
    ...card.whatChanges.citationIds,
    ...card.whoIsAffected.citationIds,
  ];

  return (
    citedFieldIds.length > 0 && citedFieldIds.every((id) => citationIds.has(id))
  );
}

function citationMatchesCard(url: string, card: TrendingBillCard): boolean {
  const segment =
    card.bill.type === "hr"
      ? "house-bill"
      : card.bill.type === "s"
        ? "senate-bill"
        : null;
  return segment
    ? url.includes(
        `/bill/${card.bill.congress}th-congress/${segment}/${card.bill.number}`,
      )
    : url.startsWith("https://www.congress.gov/");
}

function liveBill({
  number,
  title,
  latestAction,
}: {
  number: number;
  title: string;
  latestAction: string;
}): CongressSearchResult {
  return {
    source: "live",
    congress: 119,
    type: "hr",
    number,
    title,
    url: `https://www.congress.gov/bill/119th-congress/house-bill/${number}`,
    latestAction: {
      date: "2025-07-01",
      text: latestAction,
    },
  };
}

function mockCongressClient(bills: CongressSearchResult[]): CongressClient {
  return {
    mode: "live",
    configured: true,
    async listBills() {
      return { ok: true, source: "live", data: bills };
    },
    async getBill(ref): Promise<CongressBillDetail> {
      const bill =
        bills.find(
          (candidate) =>
            candidate.number === ref.number && candidate.type === ref.type,
        ) ?? bills[0];
      return {
        source: "live",
        congress: ref.congress ?? 119,
        type: ref.type,
        number: ref.number,
        title: bill.title,
        latestAction: bill.latestAction,
        sponsors: [],
        subjects: ["Economics and Public Finance"],
        summaries: [
          {
            date: "2025-07-01",
            text: "This bill changes federal program rules and funding authorities. The official summary gives students a source-backed starting point.",
          },
        ],
        actions: bill.latestAction ? [bill.latestAction] : [],
        citations: [],
      };
    },
    async searchBills() {
      return [];
    },
    async listHouseVotes() {
      return { ok: true, source: "fixture", data: [] };
    },
    async listMembersByCongress() {
      return { ok: true, source: "fixture", data: [] };
    },
  };
}
