import { describe, expect, it } from "vitest";
import { projectAnalysisResultForStorage } from "@/lib/ai/validators";

describe("analysis storage privacy projection", () => {
  const result = {
    status: "answered",
    evidenceStatus: "grounded",
    truthVerdict: "true",
    normalizedClaim: "A private claim restatement.",
    verdictSummary: "The official source settles the claim.",
    claimChecks: [
      {
        claim: "A private decomposed claim.",
        verdict: "true",
        explanation: "The cited source supports it.",
        citationIds: ["c1"],
      },
    ],
    oneSentenceAnswer: "UNIQUE_SENTINEL_CLAIM is true.",
    studentExplanation: "UNIQUE_SENTINEL_CLAIM appears here too.",
    contextGaps: ["UNIQUE_SENTINEL_CLAIM"],
    framingFlags: ["UNIQUE_SENTINEL_CLAIM"],
    quiz: [
      {
        id: "quiz-unique-sentinel-claim",
        question: "Is UNIQUE_SENTINEL_CLAIM true?",
      },
    ],
  };

  it("omits claim text when raw-input storage is disabled", () => {
    const projected = projectAnalysisResultForStorage(result, false) as Record<
      string,
      unknown
    >;

    expect(projected).not.toHaveProperty("normalizedClaim");
    expect(projected).toMatchObject({
      status: "answered",
      evidenceStatus: "grounded",
      truthVerdict: "true",
      claimChecks: [
        {
          verdict: "true",
          citationIds: ["c1"],
        },
      ],
    });
    expect(
      (projected.claimChecks as Array<Record<string, unknown>>)[0],
    ).not.toHaveProperty("claim");
    expect(result).toHaveProperty("normalizedClaim");
    expect(result.claimChecks[0]).toHaveProperty("claim");
    expect(JSON.stringify(projected)).not.toMatch(/UNIQUE_SENTINEL_CLAIM/i);
  });

  it("keeps the complete result only when raw-input storage is enabled", () => {
    expect(projectAnalysisResultForStorage(result, true)).toBe(result);
  });
});
