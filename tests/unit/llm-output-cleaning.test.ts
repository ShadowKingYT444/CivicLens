import { describe, expect, it } from "vitest";
import type { AnalysisResult, Citation } from "@/lib/ai/schemas";
import {
  parseJsonObject,
  stripCitationIdsFromUserFields,
  validateAnalysisPayload,
} from "@/lib/ai/validators";

const citations = [
  {
    id: "c1",
    sourceDocumentId: "bill-118-hr-1",
    sourceType: "bill",
    title: "H.R. 1 - Sample Bill",
    url: "https://www.congress.gov/bill/118th-congress/house-bill/1",
    sourceDate: "2025-01-03",
    excerpt: "H.R. 1 was introduced in the House on January 3, 2025.",
  },
] satisfies Citation[];

const analysis = {
  status: "answered",
  evidenceStatus: "grounded",
  normalizedClaim: "What happened to H.R. 1?",
  truthVerdict: "true",
  verdictSummary: "Source c1 says the bill was introduced. [c1]",
  claimChecks: [
    {
      claim: "Source c1 says H.R. 1 was introduced. [c1]",
      verdict: "true",
      explanation: "c1 states that H.R. 1 was introduced in the House. [c1]",
      citationIds: ["c1"],
    },
  ],
  oneSentenceAnswer: "Source c1 says H.R. 1 was introduced in the House. [c1]",
  studentExplanation:
    "c1 states the bill was introduced on January 3, 2025. [c1]",
  keyContext: ["Congress.gov lists the bill introduction date. [c1]"],
  whatOfficialSourcesSay: ["H.R. 1 was introduced in the House. [c1]"],
  contextGaps: ["No Senate vote is included in the provided sources. [c1]"],
  framingFlags: [],
  quiz: [
    {
      id: "q1",
      question: "Which source lists the bill introduction date?",
      choices: ["Congress.gov", "A campaign site"],
      correctAnswer: "Congress.gov",
      explanation: "The bill page is an official Congress.gov source. [c1]",
      citationIds: ["c1"],
    },
  ],
} satisfies AnalysisResult;

describe("LLM output cleaning", () => {
  it("requires a strict JSON object before schema validation", () => {
    expect(parseJsonObject(JSON.stringify({ ok: true }))).toEqual({ ok: true });
    expect(() => parseJsonObject('```json\n{"ok":true}\n```')).toThrow(/json/i);
    expect(() => parseJsonObject("[1,2,3]")).toThrow(/object/i);
  });

  it("removes internal citation ids from student-facing fields", () => {
    const cleaned = stripCitationIdsFromUserFields(analysis, citations);
    const serialized = JSON.stringify(cleaned);

    expect(cleaned.oneSentenceAnswer).toBe(
      "the cited source says H.R. 1 was introduced in the House.",
    );
    expect(cleaned.studentExplanation).toBe(
      "the cited source states the bill was introduced on January 3, 2025.",
    );
    expect(cleaned.verdictSummary).toBe(
      "the cited source says the bill was introduced.",
    );
    expect(cleaned.claimChecks[0].explanation).toBe(
      "the cited source states that H.R. 1 was introduced in the House.",
    );
    expect(cleaned.claimChecks[0].citationIds).toEqual(["c1"]);
    expect(cleaned.quiz[0].citationIds).toEqual(["c1"]);
    expect(serialized).not.toContain("[c1]");
    expect(serialized).not.toContain("Source c1");
  });

  it("accepts provider JSON that uses null for optional refusalReason", () => {
    const payload = {
      ...analysis,
      refusalReason: null,
    };

    expect(validateAnalysisPayload(payload, citations).status).toBe("answered");
  });
});
