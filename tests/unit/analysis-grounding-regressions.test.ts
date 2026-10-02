import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { generateAnalysis } from "@/lib/ai/llm-client";
import { AnalysisResultSchema, type Citation } from "@/lib/ai/schemas";

const originalEnv = { ...process.env };
const law: Citation = {
  id: "law", sourceDocumentId: "PLAW-118publ273", sourceType: "govinfo",
  title: "H.R. 82 — Public Law 118-273", url: "https://www.govinfo.gov/app/details/PLAW-118publ273",
  excerpt: "H.R. 82 repeals the government pension offset and windfall elimination rules.",
  bill: { congress: 118, type: "hr", number: 82 },
};

describe("analysis grounding regressions", () => {
  beforeEach(() => {
    process.env = { ...originalEnv };
    for (const key of ["NVIDIA_NIM_API_KEY", "NVIDIA_API_KEY", "GROQ_API_KEY", "LLM_API_KEY", "OPENAI_API_KEY"]) delete process.env[key];
  });
  afterEach(() => { process.env = { ...originalEnv }; });

  it("does not apply a repeal fixture verdict to a different bill", async () => {
    const unrelated = { ...law, excerpt: `${law.excerpt} A separate reference names H.R. 999.`, bill: { congress: 118, type: "hr" as const, number: 82 } };
    const result = await generateAnalysis({ claim: "H.R. 999 repeals the government pension offset.", citations: [unrelated] });
    expect(result.result.truthVerdict).toBe("unverifiable");
  });

  it("does not produce a canned verdict for an unrelated arbitrary claim", async () => {
    const result = await generateAnalysis({ claim: "Every public school must close during the election.", citations: [law] });
    expect(result.result.truthVerdict).toBe("unverifiable");
    expect(result.result.claimChecks[0].claim).toMatch(/public school/);
  });

  it("keeps long official excerpts inside the response contract in demo mode", async () => {
    const citation = { ...law, excerpt: `${law.excerpt} ${"The official record describes retirement provisions. ".repeat(19)}`.slice(0, 1200) };
    const result = await generateAnalysis({ claim: "What did H.R. 82 change?", citations: [citation] });
    expect(AnalysisResultSchema.safeParse(result.result).success).toBe(true);
    expect(result.result.whatOfficialSourcesSay[0].length).toBeLessThanOrEqual(700);
    expect(result.result.oneSentenceAnswer.length).toBeLessThanOrEqual(500);
  });
});
