import { describe, expect, it } from "vitest";
import trendingBills from "@/data/trending-bills.json";

type CitedText = { text: string; citationIds: string[] };

describe("trending bill fixture evidence", () => {
  it("ties every fixture citation and hook to the exact bill identity", () => {
    expect(trendingBills.bills).toHaveLength(16);

    for (const bill of trendingBills.bills) {
      const citationIds = new Set(
        bill.citations.map((citation) => citation.id),
      );
      expect(
        bill.hookCitationIds.length,
        `${bill.id} hook citations`,
      ).toBeGreaterThan(0);
      expect(
        bill.hookCitationIds.every((id) => citationIds.has(id)),
        `${bill.id} hook citations`,
      ).toBe(true);

      for (const citation of bill.citations) {
        expect(citation.bill, `${bill.id}/${citation.id} identity`).toEqual({
          congress: bill.congress,
          type: bill.type,
          number: bill.number,
        });
        expect(citation.url, `${bill.id}/${citation.id} URL`).toContain(
          `/bill/${bill.congress}th-congress/${bill.type === "hr" ? "house-bill" : "senate-bill"}/${bill.number}`,
        );
      }
    }
  });

  it("requires every visible factual field to be traceable to its cited excerpt", () => {
    for (const bill of trendingBills.bills) {
      const citations = new Map(
        bill.citations.map((citation) => [citation.id, citation]),
      );
      const fields: Array<[string, CitedText]> = [
        ["hook", { text: bill.hook, citationIds: bill.hookCitationIds }],
        ...bill.keyPoints.map(
          (point, index) =>
            [`keyPoints[${index}]`, point] as [string, CitedText],
        ),
        ["currentStep", bill.currentStep],
        ["whyItMatters", bill.whyItMatters],
        ["whatChanges", bill.whatChanges],
        ["whoIsAffected", bill.whoIsAffected],
      ];

      for (const [fieldName, field] of fields) {
        expect(
          field.citationIds.length,
          `${bill.id}/${fieldName} citation count`,
        ).toBeGreaterThan(0);
        const evidence = field.citationIds
          .map((id) => citations.get(id))
          .filter((citation): citation is NonNullable<typeof citation> =>
            Boolean(citation),
          )
          .map((citation) => `${citation.title} ${citation.excerpt}`)
          .join(" ");
        expect(
          evidence.length,
          `${bill.id}/${fieldName} known citations`,
        ).toBeGreaterThan(0);
        expect(
          unsupportedNumbers(field.text, evidence),
          `${bill.id}/${fieldName} numeric support`,
        ).toEqual([]);
        expect(
          meaningfulOverlap(field.text, evidence),
          `${bill.id}/${fieldName} excerpt overlap`,
        ).toBeGreaterThanOrEqual(2);
      }
    }
  });
});

const STOP_WORDS = new Set([
  "about",
  "after",
  "also",
  "and",
  "are",
  "bill",
  "congress",
  "does",
  "from",
  "how",
  "into",
  "law",
  "official",
  "provided",
  "says",
  "source",
  "summary",
  "that",
  "the",
  "their",
  "this",
  "through",
  "use",
  "what",
  "when",
  "which",
  "with",
]);

function meaningfulOverlap(text: string, evidence: string): number {
  const evidenceTerms = new Set(terms(evidence));
  return [...new Set(terms(text))].filter((term) => evidenceTerms.has(term))
    .length;
}

function terms(text: string): string[] {
  return (text.toLowerCase().match(/[a-z][a-z'-]{2,}/g) ?? [])
    .map((term) => term.replace(/(?:ing|ed|s)$/i, ""))
    .filter((term) => term.length >= 3 && !STOP_WORDS.has(term));
}

function unsupportedNumbers(text: string, evidence: string): string[] {
  const evidenceNumbers = new Set(numbers(evidence));
  return numbers(text).filter((number) => !evidenceNumbers.has(number));
}

function numbers(text: string): string[] {
  return [...text.matchAll(/\d[\d,]*(?:\.\d+)?%?/g)].map((match) =>
    match[0].replace(/,/g, ""),
  );
}
