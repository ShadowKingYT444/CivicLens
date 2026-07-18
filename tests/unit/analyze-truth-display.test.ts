import { describe, expect, it } from "vitest";
import { getTruthAssessment } from "@/components/analyze-client";
import type { AnalysisResult } from "@/components/types";

function result(overrides: Partial<AnalysisResult> = {}): AnalysisResult {
  return {
    status: "answered",
    evidenceStatus: "grounded",
    normalizedClaim: "H.R. 82 became law.",
    truthVerdict: "true",
    verdictSummary: "The source supports this claim.",
    claimChecks: [
      {
        claim: "H.R. 82 became law.",
        verdict: "true",
        explanation: "The source identifies the public law.",
        citationIds: ["c1"],
      },
    ],
    oneSentenceAnswer: "The source supports this claim.",
    studentExplanation: "The official record identifies the public law.",
    keyContext: [],
    whatOfficialSourcesSay: [],
    contextGaps: [],
    framingFlags: [],
    quiz: [],
    ...overrides,
  };
}

describe("analyzer truth-score presentation", () => {
  it("shows a score only for a sourced factual claim", () => {
    expect(getTruthAssessment(result())).toEqual({ showScore: true });
  });

  it("uses non-score states for information requests, refusals, and insufficient evidence", () => {
    expect(
      getTruthAssessment(
        result({ normalizedClaim: "What did H.R. 82 change?" }),
      ),
    ).toEqual({ showScore: false, label: "Information request" });
    expect(getTruthAssessment(result({ status: "refused" }))).toEqual({
      showScore: false,
      label: "Request not scored",
    });
    expect(
      getTruthAssessment(
        result({
          evidenceStatus: "insufficient",
          truthVerdict: "unverifiable",
        }),
      ),
    ).toEqual({
      showScore: false,
      label: "Official sources do not settle this claim",
    });
  });
});
