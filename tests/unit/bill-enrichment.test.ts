import { describe, expect, it, vi } from "vitest";
import {
  buildBillCitationPacket,
  createDeterministicBillExplainer,
  generateBillExplainer,
  isMatchingBillDetail,
} from "@/lib/ai/bill-enrichment";
import type { LlmProvider } from "@/lib/ai/nim-client";
import type { CongressBillDetail } from "@/lib/clients/congress-client";

const providers: LlmProvider[] = [
  {
    name: "groq",
    apiKey: "test",
    baseUrl: "https://groq.test/v1",
    model: "groq-test",
    timeoutMs: 100,
  },
  {
    name: "nim",
    apiKey: "test",
    baseUrl: "https://nim.test/v1",
    model: "nim-test",
    timeoutMs: 100,
  },
];

describe("official bill enrichment", () => {
  it("builds source-specific citations tied only to the requested bill detail", () => {
    const detail = officialDetail();
    const citations = buildBillCitationPacket(detail);

    expect(citations.map((citation) => citation.sourceType)).toEqual(
      expect.arrayContaining([
        "congress_bill",
        "congress_summary",
        "congress_action",
      ]),
    );
    expect(
      citations.every((citation) => citation.publisher === "Congress.gov"),
    ).toBe(true);
    expect(citations.every((citation) => citation.bill.congress === 119)).toBe(
      true,
    );
    expect(
      citations.every(
        (citation) =>
          citation.bill.type === "hr" && citation.bill.number === 201,
      ),
    ).toBe(true);
    expect(
      citations.find((citation) => citation.sourceType === "congress_summary")
        ?.excerpt,
    ).toContain("school meal grants");
    expect(
      citations.find((citation) => citation.sourceType === "congress_action")
        ?.excerpt,
    ).toContain("Passed House");
    expect(
      isMatchingBillDetail(detail, { congress: 119, type: "hr", number: 201 }),
    ).toBe(true);
    expect(
      isMatchingBillDetail(detail, { congress: 119, type: "hr", number: 999 }),
    ).toBe(false);
    expect(
      isMatchingBillDetail(
        { ...detail, source: "fixture" },
        { congress: 119, type: "hr", number: 201 },
      ),
    ).toBe(false);
  });

  it("creates a cautious deterministic fallback with cited who-is-affected text", () => {
    const detail = officialDetail();
    const citations = buildBillCitationPacket(detail);
    const explainer = createDeterministicBillExplainer(detail, citations);
    const knownIds = new Set(citations.map((citation) => citation.id));

    expect(explainer.keyPoints).toHaveLength(4);
    expect(explainer.whoIsAffected.text).toMatch(
      /does not clearly list every person or organization/i,
    );
    expect(allExplainerIds(explainer).every((id) => knownIds.has(id))).toBe(
      true,
    );
  });

  it("describes missing summary text as a response gap, not proof that no summary exists", () => {
    const explainer = createDeterministicBillExplainer({
      ...officialDetail(),
      summaries: [],
    });
    const serialized = JSON.stringify(explainer);

    expect(serialized).toMatch(
      /no official summary text was available in this response/i,
    );
    expect(serialized).not.toMatch(
      /congress(?:\.gov)? (?:has|provides) no summary/i,
    );
  });

  it("rejects malformed or hallucinated enrichment and never leaks it into the fallback", async () => {
    const request = vi.fn().mockResolvedValue(
      JSON.stringify({
        hook: {
          text: "This invented bill pays every student $9,999.",
          citationIds: ["hallucinated-source"],
        },
        keyPoints: [
          { text: "Invented point one.", citationIds: ["hallucinated-source"] },
          { text: "Invented point two.", citationIds: ["hallucinated-source"] },
          {
            text: "Invented point three.",
            citationIds: ["hallucinated-source"],
          },
        ],
        whyItMatters: {
          text: "Invented impact.",
          citationIds: ["hallucinated-source"],
        },
        whatChanges: {
          text: "Invented change.",
          citationIds: ["hallucinated-source"],
        },
        whoIsAffected: {
          text: "Every student.",
          citationIds: ["hallucinated-source"],
        },
      }),
    );

    const result = await generateBillExplainer(officialDetail(), {
      providers: [providers[0]],
      request,
    });

    expect(result.method).toBe("deterministic");
    expect(JSON.stringify(result.explainer)).not.toContain("$9,999");
    expect(JSON.stringify(result.explainer)).not.toContain(
      "hallucinated-source",
    );
  });

  it("rejects invented numeric details even when they borrow a real citation id", async () => {
    const summaryId = buildBillCitationPacket(officialDetail()).find(
      (citation) => citation.sourceType === "congress_summary",
    )!.id;
    const invented = {
      hook: {
        text: "The bill pays every student $9,999.",
        citationIds: [summaryId],
      },
      keyPoints: [
        {
          text: "The bill changes school meal grants.",
          citationIds: [summaryId],
        },
        {
          text: "The summary covers schools and students.",
          citationIds: [summaryId],
        },
        {
          text: "The summary covers grant eligibility.",
          citationIds: [summaryId],
        },
      ],
      whyItMatters: {
        text: "School meal grant eligibility could change.",
        citationIds: [summaryId],
      },
      whatChanges: {
        text: "School meal grant eligibility changes.",
        citationIds: [summaryId],
      },
      whoIsAffected: {
        text: "Schools and students using the grant program.",
        citationIds: [summaryId],
      },
    };

    const result = await generateBillExplainer(officialDetail(), {
      providers: [providers[0]],
      request: vi.fn().mockResolvedValue(JSON.stringify(invented)),
    });

    expect(result.method).toBe("llm");
    expect(JSON.stringify(result.explainer)).not.toContain("$9,999");
  });

  it("rejects unsupported negative claims instead of treating uncertainty as grounded", async () => {
    const summaryId = buildBillCitationPacket(officialDetail()).find(
      (citation) => citation.sourceType === "congress_summary",
    )!.id;
    const cited = (text: string) => ({ text, citationIds: [summaryId] });
    const result = await generateBillExplainer(officialDetail(), {
      providers: [providers[0]],
      request: vi.fn().mockResolvedValue(
        JSON.stringify({
          hook: cited("The bill does not raise taxes."),
          keyPoints: [
            cited("The summary describes school meal grants."),
            cited("The summary covers grant eligibility."),
            cited("The summary names schools and students."),
          ],
          whyItMatters: cited("School meal grant eligibility changes."),
          whatChanges: cited("The bill changes school meal grant eligibility."),
          whoIsAffected: cited("Schools and students use the grant program."),
        }),
      ),
    });

    expect(result.method).toBe("llm");
    expect(JSON.stringify(result.explainer)).not.toContain(
      "does not raise taxes",
    );
  });

  it("rejects unsupported positive claims that only share a few topic words", async () => {
    const summaryId = buildBillCitationPacket(officialDetail()).find(
      (citation) => citation.sourceType === "congress_summary",
    )!.id;
    const cited = (text: string) => ({ text, citationIds: [summaryId] });
    const result = await generateBillExplainer(officialDetail(), {
      providers: [providers[0]],
      request: vi.fn().mockResolvedValue(
        JSON.stringify({
          hook: cited("The school meal bill creates a national food lottery."),
          keyPoints: [
            cited("The summary describes school meal grants."),
            cited("The summary changes school meal grant eligibility."),
            cited("Schools and students use the school meal grants."),
          ],
          whyItMatters: cited("School meal grant eligibility changes."),
          whatChanges: cited("The bill changes school meal grant eligibility."),
          whoIsAffected: cited(
            "Schools and students use the school meal grants.",
          ),
        }),
      ),
    });

    expect(result.method).toBe("llm");
    expect(JSON.stringify(result.explainer)).not.toContain("food lottery");
  });

  it("replaces persuasive model fields while preserving other grounded fields", async () => {
    const summaryId = buildBillCitationPacket(officialDetail()).find(
      (citation) => citation.sourceType === "congress_summary",
    )!.id;
    const cited = (text: string) => ({ text, citationIds: [summaryId] });
    const result = await generateBillExplainer(officialDetail(), {
      providers: [providers[0]],
      request: vi.fn().mockResolvedValue(
        JSON.stringify({
          hook: cited("School meal grants deserve support."),
          keyPoints: [
            cited("The summary describes federal school meal grants."),
            cited("The bill changes eligibility and reporting rules."),
            cited("Schools and students use federal school meal grants."),
          ],
          whyItMatters: cited("School meal grant eligibility changes."),
          whatChanges: cited(
            "The bill changes eligibility and reporting rules for federal school meal grants.",
          ),
          whoIsAffected: cited(
            "Schools and students use federal school meal grants.",
          ),
        }),
      ),
    });

    expect(result.method).toBe("llm");
    expect(JSON.stringify(result.explainer)).not.toMatch(
      /deserve support|should support|vote for|vote against/i,
    );
  });

  it("does not use a bill title alone as proof that a program is created", async () => {
    const billId = buildBillCitationPacket(officialDetail()).find(
      (citation) => citation.sourceType === "congress_bill",
    )!.id;
    const summaryId = buildBillCitationPacket(officialDetail()).find(
      (citation) => citation.sourceType === "congress_summary",
    )!.id;
    const safe = (text: string) => ({ text, citationIds: [summaryId] });
    const result = await generateBillExplainer(officialDetail(), {
      providers: [providers[0]],
      request: vi.fn().mockResolvedValue(
        JSON.stringify({
          hook: {
            text: "The School Meal Grant Improvement Act creates a new national program.",
            citationIds: [billId],
          },
          keyPoints: [
            safe("The bill changes eligibility and reporting rules."),
            safe("School meal grants are used by schools and students."),
            safe("The summary describes federal school meal grants."),
          ],
          whyItMatters: safe("School meal grant eligibility changes."),
          whatChanges: safe(
            "The bill changes eligibility and reporting rules for federal school meal grants.",
          ),
          whoIsAffected: safe(
            "Schools and students use federal school meal grants.",
          ),
        }),
      ),
    });

    expect(result.method).toBe("llm");
    expect(JSON.stringify(result.explainer)).not.toContain(
      "creates a new national program",
    );
  });

  it("rejects an uncertainty claim unless the cited source expresses that uncertainty", async () => {
    const citations = buildBillCitationPacket(officialDetail());
    const summaryId = citations.find(
      (citation) => citation.sourceType === "congress_summary",
    )!.id;
    const actionId = citations.find(
      (citation) => citation.sourceType === "congress_action",
    )!.id;
    const result = await generateBillExplainer(officialDetail(), {
      providers: [providers[0]],
      request: vi.fn().mockResolvedValue(
        JSON.stringify({
          hook: {
            text: "The bill changes school meal grants.",
            citationIds: [summaryId],
          },
          keyPoints: [
            {
              text: "The summary describes school meal grants.",
              citationIds: [summaryId],
            },
            {
              text: "The summary covers grant eligibility.",
              citationIds: [summaryId],
            },
            {
              text: "The House passed the bill by recorded vote.",
              citationIds: [actionId],
            },
          ],
          whyItMatters: {
            text: "School meal grant eligibility changes.",
            citationIds: [summaryId],
          },
          whatChanges: {
            text: "The bill changes school meal grant eligibility.",
            citationIds: [summaryId],
          },
          whoIsAffected: {
            text: "The effect on schools is unclear.",
            citationIds: [summaryId],
          },
        }),
      ),
    });

    expect(result.method).toBe("llm");
    expect(JSON.stringify(result.explainer)).not.toContain(
      "effect on schools is unclear",
    );
  });

  it("falls through a failed NIM call to a valid cited Groq enrichment", async () => {
    const citations = buildBillCitationPacket(officialDetail());
    const summaryId = citations.find(
      (citation) => citation.sourceType === "congress_summary",
    )!.id;
    const actionId = citations.find(
      (citation) => citation.sourceType === "congress_action",
    )!.id;
    const request = vi.fn(async (provider: LlmProvider) => {
      if (provider.name === "nim")
        throw new Error("temporary provider failure");
      return JSON.stringify({
        hook: {
          text: "The bill changes eligibility and reporting rules for federal school meal grants.",
          citationIds: [summaryId],
        },
        keyPoints: [
          {
            text: "School meal grants are used by schools and students.",
            citationIds: [summaryId],
          },
          {
            text: "The bill changes eligibility and reporting rules.",
            citationIds: [summaryId],
          },
          {
            text: "Passed House by recorded vote.",
            citationIds: [actionId],
          },
        ],
        whyItMatters: {
          text: "Schools and students use federal school meal grants.",
          citationIds: [summaryId],
        },
        whatChanges: {
          text: "The bill changes eligibility and reporting rules for federal school meal grants.",
          citationIds: [summaryId],
        },
        whoIsAffected: {
          text: "Schools and students use federal school meal grants.",
          citationIds: [summaryId],
        },
      });
    });

    const result = await generateBillExplainer(officialDetail(), {
      providers,
      request,
    });

    expect(result).toMatchObject({ method: "llm", provider: "groq" });
    expect(request).toHaveBeenCalledTimes(2);
    expect(request.mock.calls.map(([provider]) => provider.name)).toEqual([
      "nim",
      "groq",
    ]);
  });

  it("uses a configured OpenAI-compatible provider for bill enrichment", async () => {
    const detail = officialDetail();
    const generic: LlmProvider = { ...providers[0], name: "generic" };
    const request = vi.fn().mockResolvedValue(JSON.stringify(createDeterministicBillExplainer(detail)));
    const result = await generateBillExplainer(detail, { providers: [generic], request });
    expect(request).toHaveBeenCalledOnce();
    expect(result).toMatchObject({ method: "llm", provider: "generic" });
  });

  it("uses deterministic official-source output when every provider fails", async () => {
    const request = vi
      .fn()
      .mockRejectedValue(new Error("provider unavailable"));

    const result = await generateBillExplainer(officialDetail(), {
      providers,
      request,
    });

    expect(result.method).toBe("deterministic");
    expect(result.provider).toBeUndefined();
    expect(result.explainer.whatChanges.text).toContain("school meal grants");
    expect(request).toHaveBeenCalledTimes(2);
  });

  it("bounds hostile provider lists and stops at the overall explainer deadline", async () => {
    const request = vi.fn(async () => new Promise<string | null>(() => {}));
    const startedAt = Date.now();
    const result = await generateBillExplainer(officialDetail(), {
      providers: Array.from(
        { length: 20 },
        (_, index) => providers[index % providers.length]!,
      ),
      request,
      deadlineMs: 250,
    });

    expect(Date.now() - startedAt).toBeLessThan(1_000);
    expect(result.method).toBe("deterministic");
    expect(request).toHaveBeenCalledTimes(1);
  });
});

function officialDetail(): CongressBillDetail {
  return {
    source: "live",
    congress: 119,
    type: "hr",
    number: 201,
    title: "School Meal Grant Improvement Act",
    shortTitle: "School Meal Grant Improvement Act",
    introducedDate: "2025-01-03",
    latestAction: {
      date: "2025-06-01",
      text: "Passed House by recorded vote.",
    },
    sponsors: [],
    subjects: ["Education", "School meals"],
    summaries: [
      {
        date: "2025-05-20",
        text: "This bill changes eligibility and reporting rules for federal school meal grants used by schools and students.",
      },
    ],
    actions: [
      { date: "2025-01-03", text: "Introduced in House." },
      { date: "2025-06-01", text: "Passed House by recorded vote." },
    ],
    citations: [],
  };
}

function allExplainerIds(
  explainer: ReturnType<typeof createDeterministicBillExplainer>,
): string[] {
  return [
    ...explainer.hook.citationIds,
    ...explainer.keyPoints.flatMap((point) => point.citationIds),
    ...explainer.whyItMatters.citationIds,
    ...explainer.whatChanges.citationIds,
    ...explainer.whoIsAffected.citationIds,
  ];
}
