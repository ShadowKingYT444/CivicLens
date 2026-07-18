import { describe, expect, it } from "vitest";
import type { Citation } from "@/lib/ai/schemas";
import {
  looksLikeAddress,
  redactSensitiveText,
  validateAnalysisPayload,
  validateCitations,
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
  {
    id: "c2",
    sourceDocumentId: "vote-118-hr-1-house",
    sourceType: "vote",
    title: "House vote on H.R. 1",
    url: "https://clerk.house.gov/Votes/2025001",
    sourceDate: "2025-01-10",
    excerpt: "The House vote passed 220 to 215.",
  },
] satisfies Citation[];

function analysis(overrides: Record<string, unknown> = {}) {
  return {
    status: "answered",
    evidenceStatus: "grounded",
    normalizedClaim: "What happened to H.R. 1?",
    truthVerdict: "true",
    verdictSummary: "The official records support the checkable claim.",
    claimChecks: [
      {
        claim: "H.R. 1 was introduced in the House.",
        verdict: "true",
        explanation: "The Congress.gov record lists the House introduction.",
        citationIds: ["c1"],
      },
    ],
    oneSentenceAnswer:
      "H.R. 1 was introduced in the House on January 3, 2025. [c1]",
    studentExplanation: "The cited House vote passed 220 to 215. [c2]",
    keyContext: [
      "The official sources include a bill page and a vote page. [c1]",
    ],
    whatOfficialSourcesSay: [
      "Congress.gov lists the bill introduction date. [c1]",
    ],
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
    ...overrides,
  };
}

describe("citation validators", () => {
  it("accepts official citation URLs and unique ids", () => {
    expect(validateCitations(citations)).toMatchObject({
      ok: true,
      errors: [],
    });
  });

  it("rejects duplicate citation ids and unofficial source URLs", () => {
    const result = validateCitations([
      citations[0],
      {
        ...citations[0],
        title: "Unofficial copy",
        url: "https://example.com/bill",
      },
    ]);

    expect(result.ok).toBe(false);
    expect(result.errors).toEqual(
      expect.arrayContaining([
        expect.stringMatching(/duplicated/i),
        expect.stringMatching(/official source/i),
      ]),
    );
  });

  it("accepts factual analysis fields when every claim cites provided sources", () => {
    expect(validateAnalysisPayload(analysis(), citations)).toMatchObject({
      evidenceStatus: "grounded",
      oneSentenceAnswer: expect.stringContaining("[c1]"),
    });
  });

  it("rejects citation ids that were not supplied", () => {
    expect(() =>
      validateAnalysisPayload(
        analysis({
          oneSentenceAnswer: "H.R. 1 passed the House. [missing]",
        }),
        citations,
      ),
    ).toThrow(/unknown citation/i);
  });

  it("treats claim-check citation ids as authoritative instead of presentation prose", () => {
    expect(
      validateAnalysisPayload(
        analysis({
          oneSentenceAnswer: "Presentation text is rebuilt after validation.",
        }),
        citations,
      ).status,
    ).toBe("answered");
  });

  it("rejects unknown and missing claim-check citations", () => {
    expect(() =>
      validateAnalysisPayload(
        analysis({
          claimChecks: [
            {
              claim: "H.R. 1 was introduced in the House.",
              verdict: "true",
              explanation: "The official record lists the House introduction.",
              citationIds: ["missing"],
            },
          ],
        }),
        citations,
      ),
    ).toThrow(/unknown claim-check citation/i);

    expect(() =>
      validateAnalysisPayload(
        analysis({
          claimChecks: [
            {
              claim: "H.R. 1 was introduced in the House.",
              verdict: "true",
              explanation: "The official record lists the House introduction.",
              citationIds: [],
            },
          ],
        }),
        citations,
      ),
    ).toThrow(/settled claim check requires/i);
  });

  it("rejects mechanical citation laundering of an unsupported numeric claim", () => {
    expect(() =>
      validateAnalysisPayload(
        analysis({
          normalizedClaim: "H.R. 1 pays every retiree $5,000.",
          claimChecks: [
            {
              claim: "H.R. 1 pays every retiree $5,000.",
              verdict: "true",
              explanation:
                "The cited bill record supposedly proves a $5,000 payment.",
              citationIds: ["c1"],
            },
          ],
        }),
        citations,
      ),
    ).toThrow(/unsupported numeric detail.*5000/i);
  });

  it("rejects a settled verdict whose polarity conflicts with the cited excerpt", () => {
    expect(() =>
      validateAnalysisPayload(
        analysis({
          normalizedClaim: "H.R. 1 wasn't introduced in the House.",
          truthVerdict: "true",
          claimChecks: [
            {
              claim: "H.R. 1 wasn't introduced in the House.",
              verdict: "true",
              explanation: "The official record lists the introduction.",
              citationIds: ["c1"],
            },
          ],
        }),
        citations,
        "H.R. 1 wasn't introduced in the House.",
      ),
    ).toThrow(/do not directly support this claim verdict/i);
  });

  it("ignores unrelated negation elsewhere in a cited excerpt", () => {
    const citationWithUnrelatedNegation = {
      ...citations[0],
      excerpt:
        "H.R. 1 was introduced in the House. An employer did not withhold Social Security taxes.",
    };

    expect(
      validateAnalysisPayload(
        analysis({
          normalizedClaim: "H.R. 1 was not introduced in the House.",
          truthVerdict: "false",
          claimChecks: [
            {
              claim: "H.R. 1 was not introduced in the House.",
              verdict: "false",
              explanation: "The official record lists the introduction.",
              citationIds: ["c1"],
            },
          ],
        }),
        [citationWithUnrelatedNegation, citations[1]],
        "H.R. 1 was not introduced in the House.",
      ).truthVerdict,
    ).toBe("false");
  });

  it("rejects a false verdict when its citation actually supports the claim", () => {
    expect(() =>
      validateAnalysisPayload(
        analysis({
          normalizedClaim: "H.R. 1 was introduced in the House.",
          truthVerdict: "false",
          verdictSummary: "False, according to the model.",
          claimChecks: [
            {
              claim: "H.R. 1 was introduced in the House.",
              verdict: "false",
              explanation: "The official record lists the House introduction.",
              citationIds: ["c1"],
            },
          ],
        }),
        citations,
        "H.R. 1 was introduced in the House.",
      ),
    ).toThrow(/do not directly contradict this claim verdict/i);
  });

  it("does not accept opposite meanings merely because they share vocabulary", () => {
    expect(() =>
      validateAnalysisPayload(
        analysis({
          normalizedClaim: "The House vote did not pass 220 to 215.",
          truthVerdict: "true",
          claimChecks: [
            {
              claim: "The House vote did not pass 220 to 215.",
              verdict: "true",
              explanation:
                "The House vote record uses the same words and numbers.",
              citationIds: ["c2"],
            },
          ],
        }),
        citations,
        "The House vote did not pass 220 to 215.",
      ),
    ).toThrow(/do not directly support this claim verdict/i);
  });

  it("rejects persuasion hidden in context or quiz fields", () => {
    expect(() =>
      validateAnalysisPayload(
        analysis({
          keyContext: [
            "You should vote for the candidate who supports H.R. 1.",
          ],
        }),
        citations,
      ),
    ).toThrow(/political persuasion or voting advice/i);

    expect(() =>
      validateAnalysisPayload(
        analysis({
          quiz: [
            {
              id: "q1",
              question: "Which source lists the introduction?",
              choices: ["Congress.gov", "Vote against anyone who disagrees"],
              correctAnswer: "Congress.gov",
              explanation: "Support the candidate who voted for it.",
              citationIds: ["c1"],
            },
          ],
        }),
        citations,
      ),
    ).toThrow(/political persuasion or voting advice/i);
  });

  it("rejects missing and unknown quiz citation ids", () => {
    expect(() =>
      validateAnalysisPayload(
        analysis({ quiz: [{ ...analysis().quiz[0], citationIds: [] }] }),
        citations,
      ),
    ).toThrow(
      /quiz generated from official evidence requires a supplied citation/i,
    );

    expect(() =>
      validateAnalysisPayload(
        analysis({
          quiz: [{ ...analysis().quiz[0], citationIds: ["missing"] }],
        }),
        citations,
      ),
    ).toThrow(/unknown quiz citation ids/i);
  });

  it("redacts P.O. boxes, rural routes, numbered roads, and additional street suffixes", () => {
    const addresses = [
      "P.O. Box 42",
      "RR 7, Box 19",
      "77 County Road 12 Box 4",
      "22 Cedar Terrace Unit 5",
      "9 State Highway 10",
    ];

    for (const address of addresses) {
      expect(looksLikeAddress(address), address).toBe(true);
      const redacted = redactSensitiveText(
        `My mailing address is ${address}; check H.R. 1.`,
      );
      expect(redacted, address).toContain("[redacted address]");
      expect(redacted, address).not.toContain(address);
    }
  });

  it("does not allow insufficient evidence to produce a confident verdict", () => {
    expect(() =>
      validateAnalysisPayload(
        analysis({
          evidenceStatus: "insufficient",
          truthVerdict: "true",
          verdictSummary: "The source does not establish the claim.",
          claimChecks: [
            {
              claim: "H.R. 1 changed every retirement benefit.",
              verdict: "unverifiable",
              explanation:
                "The supplied sources do not establish retirement benefit changes.",
              citationIds: [],
            },
          ],
        }),
        citations,
      ),
    ).toThrow(/unverifiable overall verdict/i);
  });

  it("rejects mostly verdicts that point opposite every claim check", () => {
    expect(() =>
      validateAnalysisPayload(
        analysis({
          truthVerdict: "mostly_true",
          claimChecks: [
            {
              claim: "H.R. 1 was not introduced in the House.",
              verdict: "false",
              explanation: "The official record lists the introduction.",
              citationIds: ["c1"],
            },
          ],
        }),
        citations,
      ),
    ).toThrow(/mostly_true.*supported material evidence/i);
  });

  it("requires mixed claim checks to be decomposed into directional checks", () => {
    expect(() =>
      validateAnalysisPayload(
        analysis({
          truthVerdict: "mixed",
          claimChecks: [
            {
              claim: "H.R. 1 was introduced in the House.",
              verdict: "mixed",
              explanation: "The model combined different directions.",
              citationIds: ["c1"],
            },
          ],
        }),
        citations,
      ),
    ).toThrow(/must be decomposed into directional checks/i);
  });

  it("requires compound claims to be decomposed into separate checks", () => {
    expect(() =>
      validateAnalysisPayload(
        analysis({
          normalizedClaim:
            "H.R. 1 was introduced in the House and it pays every retiree $5,000.",
          claimChecks: [
            {
              claim: "H.R. 1 was introduced in the House.",
              verdict: "true",
              explanation:
                "The Congress.gov record lists the House introduction.",
              citationIds: ["c1"],
            },
          ],
        }),
        citations,
      ),
    ).toThrow(/compound claim must be decomposed into separate claim checks/i);
  });
});
