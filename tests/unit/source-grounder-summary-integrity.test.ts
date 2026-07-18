import { afterEach, describe, expect, it, vi } from "vitest";
import { fetchCongressBill } from "@/lib/civic/source-grounder";

const originalEnv = { ...process.env };

describe("Congress summary citation integrity", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    process.env = { ...originalEnv };
  });

  it("does not relabel a latest action or app fallback as an official summary", async () => {
    process.env = {
      ...originalEnv,
      CONGRESS_API_KEY: "test-key",
      CONGRESS_API_BASE_URL: "https://congress.test/v3",
    };
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: string | URL | Request) => {
        const url = String(input);
        if (url.includes("/summaries?")) {
          return Response.json({ summaries: [] });
        }
        if (url.includes("/actions?")) {
          return Response.json({
            actions: [
              { text: "Referred to committee.", actionDate: "2025-01-04" },
            ],
          });
        }
        return Response.json({
          bill: {
            title: "Sample Retirement Benefit Act",
            latestAction: {
              text: "Referred to committee.",
              actionDate: "2025-01-04",
            },
            sponsors: [],
            subjects: { legislativeSubjects: [] },
          },
        });
      }),
    );

    const bill = await fetchCongressBill(119, "hr", 999);

    expect(bill?.citations.map((citation) => citation.id)).toContain(
      "119-hr-999-action",
    );
    expect(bill?.citations.map((citation) => citation.id)).not.toContain(
      "119-hr-999-summary",
    );
    expect(
      bill?.citations.some((citation) =>
        /official summary/i.test(citation.title),
      ),
    ).toBe(false);
  });
});
