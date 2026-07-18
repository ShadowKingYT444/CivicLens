import { afterEach, describe, expect, it, vi } from "vitest";
import { generateAnalysis } from "@/lib/ai/llm-client";
import type { Citation } from "@/lib/ai/schemas";

const originalEnv = { ...process.env };
const citations = [
  {
    id: "c1",
    sourceDocumentId: "bill-118-hr-82",
    sourceType: "bill",
    title: "H.R. 82",
    url: "https://www.congress.gov/bill/118th-congress/house-bill/82",
    excerpt: "H.R. 82 became Public Law 118-273.",
    bill: { congress: 118, type: "hr", number: 82 },
  },
] satisfies Citation[];

describe("provider analysis call budget", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    process.env = { ...originalEnv };
  });

  it("caps repair and failover calls across all configured providers", async () => {
    process.env = {
      ...originalEnv,
      NVIDIA_NIM_API_KEY: "nim-test",
      ENABLE_NIM: "true",
      GROQ_API_KEY: "groq-test",
      ENABLE_GROQ: "true",
      LLM_API_KEY: "generic-test",
      ENABLE_LLM: "true",
      LLM_ANALYSIS_DEADLINE_MS: "5000",
      LLM_ANALYSIS_MAX_CALLS: "2",
    };
    const fetchMock = vi
      .fn()
      .mockResolvedValue(
        Response.json({ choices: [{ message: { content: "{}" } }] }),
      );
    vi.stubGlobal("fetch", fetchMock);

    const generated = await generateAnalysis({
      claim: "Did H.R. 82 become law?",
      citations,
    });

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(generated.mode).toBe("demo");
    expect(generated.warnings).toEqual(
      expect.arrayContaining([
        expect.stringMatching(/deadline or call budget.*exhausted/i),
      ]),
    );
  });
});
