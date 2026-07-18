import { beforeEach, describe, expect, it, vi } from "vitest";

const { retrieveGroundedSources, generateAnalysis } = vi.hoisted(() => ({
  retrieveGroundedSources: vi.fn(),
  generateAnalysis: vi.fn(),
}));

vi.mock("@/lib/civic/source-grounder", () => ({ retrieveGroundedSources }));
vi.mock("@/lib/ai/llm-client", () => ({ generateAnalysis }));

import { analyzeClaim } from "@/lib/ai/analyze-claim";

describe("analysis retrieval privacy", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    retrieveGroundedSources.mockResolvedValue({
      citations: [],
      mode: "demo",
      validationErrors: [],
    });
    generateAnalysis.mockResolvedValue({
      result: {},
      mode: "demo",
      warnings: [],
    });
  });

  it("redacts address, email, and phone data before retrieval or embedding", async () => {
    const rawClaim =
      "My P.O. Box 123, email terry@example.com, phone 415-555-0100 relates to this policy.";

    await analyzeClaim(rawClaim);

    const retrievalQuery = String(retrieveGroundedSources.mock.calls[0]?.[0]);
    expect(retrievalQuery).not.toContain("P.O. Box 123");
    expect(retrievalQuery).not.toContain("terry@example.com");
    expect(retrievalQuery).not.toContain("415-555-0100");
    expect(generateAnalysis).toHaveBeenCalledWith(
      expect.objectContaining({ claim: rawClaim }),
    );
  });
});
