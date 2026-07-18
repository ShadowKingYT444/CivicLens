import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { AnalysisResult, Citation } from "@/lib/ai/schemas";
import { generateAnalysis } from "@/lib/ai/llm-client";
import { selectLlmProvider, selectLlmProviders } from "@/lib/ai/nim-client";
import {
  validateAnalysisPayload,
  validateCitations,
} from "@/lib/ai/validators";

const providerEnvKeys = [
  "ENABLE_NIM",
  "NVIDIA_NIM_API_KEY",
  "NVIDIA_API_KEY",
  "NVIDIA_NIM_BASE_URL",
  "NVIDIA_NIM_API_BASE_URL",
  "NVIDIA_NIM_API_BASE",
  "NVIDIA_NIM_MODEL",
  "NVIDIA_NIM_TIMEOUT_MS",
  "NIM_TIMEOUT_MS",
  "ENABLE_GROQ",
  "GROQ_API_KEY",
  "GROQ_BASE_URL",
  "GROQ_API_BASE_URL",
  "GROQ_MODEL",
  "GROQ_TIMEOUT_MS",
  "ENABLE_LLM",
  "LLM_API_KEY",
  "LLM_BASE_URL",
  "LLM_MODEL",
  "LLM_TIMEOUT_MS",
  "OPENAI_API_KEY",
  "OPENAI_BASE_URL",
  "OPENAI_MODEL",
  "LLM_ANALYSIS_DEADLINE_MS",
  "LLM_ANALYSIS_MAX_CALLS",
] as const;

const originalProviderEnv = new Map<string, string | undefined>(
  providerEnvKeys.map((key) => [key, process.env[key]]),
);

const citations = [
  {
    id: "c1",
    sourceDocumentId: "bill-118-hr-82",
    sourceType: "bill",
    title: "H.R. 82 - Social Security Fairness Act",
    url: "https://www.congress.gov/bill/118th-congress/house-bill/82",
    sourceDate: "2025-01-05",
    excerpt:
      "H.R. 82 became Public Law 118-273 and addressed Social Security offset rules.",
    bill: {
      congress: 118,
      type: "hr",
      number: 82,
    },
  },
] satisfies Citation[];

function clearProviderEnv() {
  for (const key of providerEnvKeys) {
    delete process.env[key];
  }
}

function restoreProviderEnv() {
  clearProviderEnv();
  for (const [key, value] of originalProviderEnv) {
    if (value !== undefined) {
      process.env[key] = value;
    }
  }
}

function analysisPayload(
  overrides: Partial<AnalysisResult> = {},
): AnalysisResult {
  return {
    status: "answered",
    evidenceStatus: "grounded",
    normalizedClaim: "Did H.R. 82 become law?",
    truthVerdict: "true",
    verdictSummary:
      "True — the official bill record lists H.R. 82 as Public Law 118-273.",
    claimChecks: [
      {
        claim: "H.R. 82 became public law.",
        verdict: "true",
        explanation: "Congress.gov lists H.R. 82 as Public Law 118-273.",
        citationIds: ["c1"],
      },
    ],
    oneSentenceAnswer: "Congress.gov lists H.R. 82 as Public Law 118-273. [c1]",
    studentExplanation:
      "The official bill record says H.R. 82 became public law. [c1]",
    keyContext: [
      "Congress.gov identifies the bill and public law status. [c1]",
    ],
    whatOfficialSourcesSay: ["H.R. 82 became Public Law 118-273. [c1]"],
    contextGaps: [
      "The supplied source does not estimate individual benefit changes.",
    ],
    framingFlags: [],
    quiz: [
      {
        id: "q1",
        question: "Which official source identifies H.R. 82?",
        choices: ["Congress.gov", "A campaign ad"],
        correctAnswer: "Congress.gov",
        explanation: "The official bill page is on Congress.gov. [c1]",
        citationIds: ["c1"],
      },
    ],
    ...overrides,
  };
}

function chatCompletion(content: string): Response {
  return new Response(
    JSON.stringify({
      choices: [{ message: { content } }],
    }),
    {
      status: 200,
      headers: { "Content-Type": "application/json" },
    },
  );
}

function failedResponse(status = 503): Response {
  return new Response(JSON.stringify({ error: "provider unavailable" }), {
    status,
  });
}

function parseRequest(fetchMock: ReturnType<typeof vi.fn>, index: number) {
  const [url, init] = fetchMock.mock.calls[index] as [string, RequestInit];
  return {
    url,
    init,
    body: JSON.parse(String(init.body)) as {
      model: string;
      temperature: number;
      max_tokens: number;
      response_format: { type: string };
      messages: Array<{ role: string; content: string }>;
    },
  };
}

describe("AI provider verification", () => {
  beforeEach(() => {
    clearProviderEnv();
    vi.unstubAllGlobals();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    restoreProviderEnv();
  });

  it("selects NIM before Groq before generic providers and honors explicit disables", () => {
    const env = {
      NVIDIA_NIM_API_KEY: "nim-secret",
      GROQ_API_KEY: "groq-secret",
      LLM_API_KEY: "generic-secret",
      LLM_TIMEOUT_MS: "9000",
    };

    expect(selectLlmProviders(env).map((provider) => provider.name)).toEqual([
      "nim",
      "groq",
      "generic",
    ]);
    expect(selectLlmProvider(env)).toMatchObject({
      name: "nim",
      baseUrl: "https://integrate.api.nvidia.com/v1",
      model: "meta/llama-3.1-8b-instruct",
      timeoutMs: 9000,
    });
    expect(
      selectLlmProviders({
        ...env,
        ENABLE_NIM: "false",
        ENABLE_GROQ: "0",
        ENABLE_LLM: "no",
      }),
    ).toEqual([]);
  });

  it("constructs NIM and Groq chat requests while falling through from a failed NIM call", async () => {
    process.env.NVIDIA_NIM_API_KEY = "nim-test-secret";
    process.env.NVIDIA_NIM_BASE_URL = "https://nim.example.test/v1/";
    process.env.NVIDIA_NIM_MODEL = "nim-model";
    process.env.GROQ_API_KEY = "groq-test-secret";
    process.env.GROQ_BASE_URL = "https://groq.example.test/openai/v1/";
    process.env.GROQ_MODEL = "groq-model";

    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(failedResponse())
      .mockResolvedValueOnce(chatCompletion(JSON.stringify(analysisPayload())));
    vi.stubGlobal("fetch", fetchMock);

    const generated = await generateAnalysis({
      claim: "Did H.R. 82 become law?",
      citations,
    });

    expect(generated.mode).toBe("live");
    expect(generated.result.status).toBe("answered");
    expect(generated.result.oneSentenceAnswer).not.toContain("[c1]");
    expect(fetchMock).toHaveBeenCalledTimes(2);

    const nimRequest = parseRequest(fetchMock, 0);
    expect(nimRequest.url).toBe("https://nim.example.test/v1/chat/completions");
    expect(nimRequest.init.headers).toMatchObject({
      Authorization: "Bearer nim-test-secret",
      "Content-Type": "application/json",
    });
    expect(nimRequest.body).toMatchObject({
      model: "nim-model",
      temperature: 0.1,
      max_tokens: 1200,
      response_format: { type: "json_object" },
    });
    expect(nimRequest.body.messages[0]).toMatchObject({ role: "system" });
    expect(nimRequest.body.messages[1].content).toContain(
      "Internal citation id: c1",
    );

    const groqRequest = parseRequest(fetchMock, 1);
    expect(groqRequest.url).toBe(
      "https://groq.example.test/openai/v1/chat/completions",
    );
    expect(groqRequest.init.headers).toMatchObject({
      Authorization: "Bearer groq-test-secret",
      "Content-Type": "application/json",
    });
    expect(groqRequest.body.model).toBe("groq-model");
  });

  it("stops at the first successful provider instead of spending the remaining call budget", async () => {
    process.env.NVIDIA_NIM_API_KEY = "nim-test-secret";
    process.env.GROQ_API_KEY = "groq-test-secret";
    process.env.LLM_ANALYSIS_MAX_CALLS = "4";
    const fetchMock = vi
      .fn()
      .mockResolvedValue(chatCompletion(JSON.stringify(analysisPayload())));
    vi.stubGlobal("fetch", fetchMock);

    const generated = await generateAnalysis({
      claim: "Did H.R. 82 become law?",
      citations,
    });

    expect(generated.mode).toBe("live");
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(parseRequest(fetchMock, 0).url).toContain(
      "integrate.api.nvidia.com",
    );
  });

  it("bounds repair and failover attempts with the shared analysis call budget", async () => {
    process.env.NVIDIA_NIM_API_KEY = "nim-test-secret";
    process.env.GROQ_API_KEY = "groq-test-secret";
    process.env.LLM_ANALYSIS_MAX_CALLS = "1";
    const fetchMock = vi.fn().mockResolvedValue(chatCompletion("not json"));
    vi.stubGlobal("fetch", fetchMock);

    const generated = await generateAnalysis({
      claim: "Did H.R. 82 become law?",
      citations,
    });

    expect(generated.mode).toBe("demo");
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(generated.warnings).toEqual(
      expect.arrayContaining([expect.stringMatching(/call budget exhausted/i)]),
    );
  });

  it("rejects a provider claim check that changes the student's truth polarity", async () => {
    process.env.NVIDIA_NIM_API_KEY = "nim-test-secret";
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(chatCompletion(JSON.stringify(analysisPayload())));
    vi.stubGlobal("fetch", fetchMock);

    const generated = await generateAnalysis({
      claim: "H.R. 82 did not become law.",
      citations,
    });

    expect(generated.mode).toBe("demo");
    expect(generated.result.truthVerdict).toBe("false");
    expect(generated.result.claimChecks[0]).toMatchObject({
      verdict: "false",
      citationIds: ["c1"],
    });
    expect(generated.result.verdictSummary).toMatch(/contradicts/i);
    expect(generated.warnings).toEqual(
      expect.arrayContaining([
        expect.stringMatching(/changed the claim's truth polarity/i),
        expect.stringMatching(/deterministic fallback/i),
      ]),
    );
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("rejects multi-check output that drops a negation shared across both parts", async () => {
    process.env.NVIDIA_NIM_API_KEY = "nim-test-secret";
    const positiveChecks = analysisPayload({
      normalizedClaim:
        "H.R. 82 repealed the government pension offset and windfall elimination rules.",
      claimChecks: [
        {
          claim: "H.R. 82 repealed the government pension offset.",
          verdict: "true",
          explanation: "The official source describes the repeal.",
          citationIds: ["c1"],
        },
        {
          claim: "H.R. 82 repealed the windfall elimination rule.",
          verdict: "true",
          explanation: "The official source describes the repeal.",
          citationIds: ["c1"],
        },
      ],
    });
    const fetchMock = vi
      .fn()
      .mockResolvedValue(chatCompletion(JSON.stringify(positiveChecks)));
    vi.stubGlobal("fetch", fetchMock);

    const generated = await generateAnalysis({
      claim:
        "H.R. 82 did not repeal the government pension offset or windfall elimination rules.",
      citations,
    });

    expect(generated.mode).toBe("demo");
    expect(generated.result.truthVerdict).toBe("unverifiable");
    expect(generated.warnings).toEqual(
      expect.arrayContaining([
        expect.stringMatching(/changed the claim's truth polarity/i),
      ]),
    );
  });

  it("rebuilds student-facing prose from validated official excerpts", async () => {
    process.env.NVIDIA_NIM_API_KEY = "nim-test-secret";
    const fabricatedPresentation = analysisPayload({
      oneSentenceAnswer: "Every retiree receives $5,000. [c1]",
      studentExplanation: "A fictional grant pays every retiree. [c1]",
      keyContext: ["The bill creates a fictional grant. [c1]"],
    });
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        chatCompletion(JSON.stringify(fabricatedPresentation)),
      );
    vi.stubGlobal("fetch", fetchMock);

    const generated = await generateAnalysis({
      claim: "Did H.R. 82 become law?",
      citations,
    });
    const serialized = JSON.stringify(generated.result);

    expect(generated.mode).toBe("live");
    expect(serialized).not.toMatch(/\$5,000|fictional grant/i);
    expect(generated.result.oneSentenceAnswer).toMatch(/public law/i);
    expect(generated.result.whatOfficialSourcesSay).toEqual([
      citations[0].excerpt,
    ]);
  });

  it("repairs invalid model output once before using deterministic demo fallback", async () => {
    process.env.NVIDIA_NIM_API_KEY = "nim-test-secret";

    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(chatCompletion("```json\n{}\n```"))
      .mockResolvedValueOnce(chatCompletion(JSON.stringify(analysisPayload())));
    vi.stubGlobal("fetch", fetchMock);

    const generated = await generateAnalysis({
      claim: "Did H.R. 82 become law?",
      citations,
    });

    expect(generated.mode).toBe("live");
    expect(generated.result.status).toBe("answered");
    expect(generated.result.oneSentenceAnswer).not.toContain("[c1]");
    expect(generated.warnings).toEqual(
      expect.arrayContaining([
        expect.stringMatching(/returned invalid analysis JSON/i),
      ]),
    );
    expect(fetchMock).toHaveBeenCalledTimes(2);

    const repairRequest = parseRequest(fetchMock, 1);
    expect(repairRequest.body.messages[2].content).toContain(
      "Repair this CivicLens model response",
    );
    expect(repairRequest.body.messages[2].content).toContain(
      "Allowed internal citation ids: c1",
    );
    expect(repairRequest.body.messages[2].content).toContain(
      "Validation errors:",
    );
  });

  it("falls back safely when malformed provider output and its repair both fail validation", async () => {
    process.env.NVIDIA_NIM_API_KEY = "nim-test-secret";

    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(chatCompletion("not json"))
      .mockResolvedValueOnce(
        chatCompletion(JSON.stringify({ status: "answered" })),
      );
    vi.stubGlobal("fetch", fetchMock);

    const generated = await generateAnalysis({
      claim: "Did H.R. 82 become law?",
      citations,
    });

    expect(generated.mode).toBe("demo");
    expect(generated.result.truthVerdict).toBe("true");
    expect(generated.warnings).toEqual(
      expect.arrayContaining([
        expect.stringMatching(/invalid analysis JSON/i),
        expect.stringMatching(/deterministic fallback/i),
      ]),
    );
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("keeps redacted address markers even when live model output paraphrases them away", async () => {
    process.env.NVIDIA_NIM_API_KEY = "nim-test-secret";

    const fetchMock = vi.fn().mockResolvedValueOnce(
      chatCompletion(
        JSON.stringify(
          analysisPayload({
            normalizedClaim: "Did H.R. 82 become law?",
          }),
        ),
      ),
    );
    vi.stubGlobal("fetch", fetchMock);

    const generated = await generateAnalysis({
      claim:
        "My address is 123 Main Street, email is terry@example.com, and phone is 415-555-0100; did H.R. 82 become law?",
      citations,
    });

    expect(generated.mode).toBe("live");
    expect(JSON.stringify(generated.result)).not.toContain("123 Main Street");
    expect(JSON.stringify(generated.result)).not.toContain("terry@example.com");
    expect(JSON.stringify(generated.result)).not.toContain("415-555-0100");
    expect(generated.result.normalizedClaim).toContain("[redacted address]");
    expect(generated.result.normalizedClaim).toContain("[redacted email]");
    expect(generated.result.normalizedClaim).toContain("[redacted phone]");

    const request = parseRequest(fetchMock, 0);
    expect(request.body.messages[1].content).not.toContain("123 Main Street");
    expect(request.body.messages[1].content).not.toContain("terry@example.com");
    expect(request.body.messages[1].content).not.toContain("415-555-0100");
    expect(request.body.messages[1].content).toContain("[redacted address]");
  });

  it("rejects a provider-generated political recommendation and uses neutral fallback output", async () => {
    process.env.NVIDIA_NIM_API_KEY = "nim-test-secret";
    const recommendation = analysisPayload({
      oneSentenceAnswer:
        "You should vote for the candidate who supports this bill. [c1]",
      studentExplanation:
        "Vote for that candidate because the bill became law. [c1]",
    });
    const fetchMock = vi
      .fn()
      .mockResolvedValue(chatCompletion(JSON.stringify(recommendation)));
    vi.stubGlobal("fetch", fetchMock);

    const generated = await generateAnalysis({
      claim: "Did H.R. 82 become law?",
      citations,
    });

    expect(generated.mode).toBe("demo");
    expect(JSON.stringify(generated.result)).not.toMatch(
      /you should vote for|vote for that candidate/i,
    );
    expect(generated.warnings).toEqual(
      expect.arrayContaining([expect.stringMatching(/invalid analysis JSON/i)]),
    );
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("validates citation sources and rejects uncited or unknown provider claims", () => {
    expect(validateCitations(citations)).toEqual({ ok: true, errors: [] });

    const invalidCitationResult = validateCitations([
      citations[0],
      {
        ...citations[0],
        title: "Unofficial mirror",
        url: "https://campaign.example/bill/hr82",
      },
    ]);
    expect(invalidCitationResult.ok).toBe(false);
    expect(invalidCitationResult.errors).toEqual(
      expect.arrayContaining([
        expect.stringMatching(/duplicated/i),
        expect.stringMatching(/official source/i),
      ]),
    );

    expect(validateAnalysisPayload(analysisPayload(), citations).status).toBe(
      "answered",
    );
    expect(() =>
      validateAnalysisPayload(
        analysisPayload({
          oneSentenceAnswer:
            "Congress.gov lists H.R. 82 as Public Law 118-273. [missing]",
        }),
        citations,
      ),
    ).toThrow(/unknown citation/i);
    expect(
      validateAnalysisPayload(
        analysisPayload({
          oneSentenceAnswer: "Presentation text is rebuilt after validation.",
        }),
        citations,
      ).status,
    ).toBe("answered");
  });

  it("refuses persuasion requests before any configured provider call", async () => {
    process.env.NVIDIA_NIM_API_KEY = "nim-test-secret";
    process.env.GROQ_API_KEY = "groq-test-secret";
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const generated = await generateAnalysis({
      claim:
        "Which candidate should I vote for if I care about Social Security?",
      citations,
    });

    expect(generated.mode).toBe("demo");
    expect(generated.result.status).toBe("refused");
    expect(generated.result.truthVerdict).toBe("unverifiable");
    expect(generated.result.refusalReason).toMatch(
      /does not recommend candidates/i,
    );
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("refuses speech-writing requests that target students on behalf of an officeholder", async () => {
    process.env.NVIDIA_NIM_API_KEY = "nim-test-secret";
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const generated = await generateAnalysis({
      claim: "Write a speech convincing students to back Senator Smith.",
      citations,
    });

    expect(generated.result.status).toBe("refused");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("does not treat a law-status source as proof of an unsupported year", async () => {
    const generated = await generateAnalysis({
      claim: "H.R. 82 became law in 2024.",
      citations,
    });

    expect(generated.mode).toBe("demo");
    expect(generated.result.truthVerdict).toBe("unverifiable");
  });

  it("uses deterministic demo analysis without provider calls when no LLM keys are present", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const generated = await generateAnalysis({
      claim: "What did H.R. 82 do?",
      citations,
    });

    expect(generated.mode).toBe("demo");
    expect(generated.result.status).toBe("answered");
    expect(generated.result.evidenceStatus).toBe("grounded");
    expect(generated.result.truthVerdict).toBe("unverifiable");
    expect(generated.result.verdictSummary).toMatch(
      /official excerpts|official evidence|official source/i,
    );
    expect(generated.result.claimChecks).toHaveLength(1);
    expect(generated.result.quiz[0].citationIds).toEqual(["c1"]);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
