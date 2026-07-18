import { generateQuiz } from "../civic/quiz-generator";
import {
  buildAnalysisPrompt,
  buildRepairPrompt,
  CIVICLENS_ANALYSIS_SYSTEM_PROMPT,
} from "./prompts";
import {
  isLlmConfigured,
  requestChatCompletion,
  selectLlmProviders,
  type ChatMessage,
  type LlmProvider,
} from "./nim-client";
import type {
  AnalysisResult,
  Citation,
  ClaimCheck,
  TruthVerdict,
} from "./schemas";
import {
  isPersuasionOrVotingAdvice,
  looksLikeAddress,
  parseJsonObject,
  redactSensitiveText,
  stripCitationIdsFromUserFields,
  validateAnalysisPayload,
} from "./validators";

export type GenerateAnalysisInput = {
  claim: string;
  citations: Citation[];
  validationErrors?: string[];
};

type ProviderAnalysisBudget = {
  calls: number;
  maxCalls: number;
  deadline: number;
};

const DEFAULT_ANALYSIS_DEADLINE_MS = 25_000;
const DEFAULT_ANALYSIS_MAX_CALLS = 3;

export { isLlmConfigured } from "./nim-client";

export async function generateAnalysis(input: GenerateAnalysisInput): Promise<{
  result: AnalysisResult;
  mode: "live" | "demo";
  warnings: string[];
}> {
  const validationErrors = input.validationErrors || [];
  const citations = validationErrors.length > 0 ? [] : input.citations;
  const refusal = getRefusalReason(input.claim);
  if (refusal) {
    return {
      result: buildRefusal(input.claim, citations, refusal),
      mode: "demo",
      warnings: [...validationErrors],
    };
  }

  let safeClaim = redactSensitiveText(input.claim);
  const unresolvedAddressRisk = looksLikeAddress(safeClaim);
  if (unresolvedAddressRisk) {
    safeClaim = "[redacted address]";
  }
  const inputWasRedacted = safeClaim !== input.claim;
  const warnings = [...validationErrors];

  if (unresolvedAddressRisk) {
    warnings.push(
      "Address-like input could not be safely isolated and was excluded from model analysis.",
    );
  }

  if (validationErrors.length > 0) {
    warnings.push(
      "Retrieved citations failed validation and were excluded from model analysis.",
    );
  }

  if (
    isLlmConfigured() &&
    citations.length > 0 &&
    !unresolvedAddressRisk &&
    !isInformationalQuestion(safeClaim)
  ) {
    const live = await tryLiveAnalysis(safeClaim, citations, warnings);
    if (live) {
      const presentedLive = buildProviderPresentation(
        live,
        safeClaim,
        citations,
      );
      const guardedLive = applyDeterministicTruthGuard(
        presentedLive,
        safeClaim,
        citations,
      );
      return {
        result: inputWasRedacted
          ? { ...guardedLive, normalizedClaim: normalizeClaim(safeClaim) }
          : guardedLive,
        mode: "live",
        warnings,
      };
    }
    warnings.push(
      "LLM output was unavailable or failed validation; deterministic fallback used.",
    );
  }

  return {
    result: buildDeterministicAnalysis(safeClaim, citations),
    mode: "demo",
    warnings,
  };
}

function applyDeterministicTruthGuard(
  result: AnalysisResult,
  claim: string,
  citations: Citation[],
): AnalysisResult {
  const deterministicTruth = buildDeterministicTruth(claim, citations);
  if (deterministicTruth.truthVerdict === "unverifiable") {
    return result;
  }

  const guardedResult: AnalysisResult = {
    ...result,
    truthVerdict: deterministicTruth.truthVerdict,
    verdictSummary: deterministicTruth.verdictSummary,
    claimChecks: deterministicTruth.claimChecks,
    oneSentenceAnswer: deterministicTruth.verdictSummary,
    studentExplanation: buildStudentExplanation(
      deterministicTruth.truthVerdict,
    ),
  };

  try {
    return validateAnalysisPayload(guardedResult, citations, claim);
  } catch {
    return result;
  }
}

function buildProviderPresentation(
  result: AnalysisResult,
  claim: string,
  citations: Citation[],
): AnalysisResult {
  const citationsById = new Map(
    citations.map((citation) => [citation.id, citation]),
  );
  const sourceBackedChecks = result.claimChecks.map((check) => {
    if (check.verdict === "unverifiable") {
      return {
        ...check,
        explanation:
          "The provided official excerpts do not directly prove or disprove this part of the claim.",
      };
    }

    const citedExcerpt = check.citationIds
      .map((id) => citationsById.get(id)?.excerpt)
      .find((excerpt): excerpt is string => Boolean(excerpt));
    const relationship =
      check.verdict === "true" || check.verdict === "mostly_true"
        ? "supports"
        : check.verdict === "false" || check.verdict === "mostly_false"
          ? "contradicts"
          : "provides relevant evidence about";

    return {
      ...check,
      explanation: citedExcerpt
        ? truncateText(
            `The official record ${relationship} this check: ${citedExcerpt}`,
            700,
          )
        : "The provided official excerpts do not directly prove or disprove this part of the claim.",
    };
  });
  const verdictLabel = result.truthVerdict
    .split("_")
    .map((word) => `${word.slice(0, 1).toUpperCase()}${word.slice(1)}`)
    .join(" ");
  const explanations = sourceBackedChecks.map((check) => check.explanation);
  const verdictSummary = truncateText(
    `${verdictLabel}: ${explanations.join(" ")}`,
    700,
  );

  return {
    ...result,
    normalizedClaim: normalizeClaim(claim),
    claimChecks: sourceBackedChecks,
    verdictSummary,
    oneSentenceAnswer: truncateText(verdictSummary, 500),
    studentExplanation: truncateText(explanations.join(" "), 2_000),
    keyContext: explanations.slice(0, 6).map((text) => truncateText(text, 500)),
    whatOfficialSourcesSay: citations
      .slice(0, 8)
      .map((citation) => truncateText(citation.excerpt, 700)),
    contextGaps: sourceBackedChecks
      .filter((check) => check.verdict === "unverifiable")
      .slice(0, 6)
      .map((check) => truncateText(check.explanation, 500)),
    framingFlags: detectFramingFlags(claim),
    quiz: generateQuiz(citations, normalizeClaim(claim)),
  };
}

function getRefusalReason(claim: string): string | null {
  if (isPersuasionOrVotingAdvice(claim)) {
    return "CivicLens can explain official civic information, but it does not recommend candidates, parties, votes, or campaign strategy.";
  }

  return null;
}

async function tryLiveAnalysis(
  claim: string,
  citations: Citation[],
  warnings: string[],
): Promise<AnalysisResult | null> {
  const providers = selectLlmProviders();
  const budget = createProviderAnalysisBudget();

  const messages: ChatMessage[] = [
    { role: "system", content: CIVICLENS_ANALYSIS_SYSTEM_PROMPT },
    { role: "user", content: buildAnalysisPrompt(claim, citations) },
  ];

  for (const provider of providers) {
    if (providerAnalysisBudgetExhausted(budget)) {
      warnings.push("Provider analysis deadline or call budget was exhausted.");
      break;
    }
    const result = await tryProviderAnalysis(
      provider,
      messages,
      citations,
      warnings,
      claim,
      budget,
    );
    if (result) {
      return result;
    }
  }

  return null;
}

async function tryProviderAnalysis(
  provider: LlmProvider,
  messages: ChatMessage[],
  citations: Citation[],
  warnings: string[],
  claim: string,
  budget: ProviderAnalysisBudget,
): Promise<AnalysisResult | null> {
  try {
    const firstContent = await requestChatCompletionWithinBudget(
      provider,
      messages,
      budget,
    );
    if (!firstContent) {
      return null;
    }

    const firstValidation = parseAndValidate(firstContent, citations, claim);
    if (firstValidation.result) {
      return stripCitationIdsFromUserFields(firstValidation.result, citations);
    }
    warnings.push(
      `${provider.name} returned invalid analysis JSON: ${firstValidation.errors.join("; ")}`,
    );

    const repairedContent = await requestChatCompletionWithinBudget(
      provider,
      [
        ...messages,
        {
          role: "user",
          content: buildRepairPrompt(
            firstContent,
            firstValidation.errors,
            citations,
          ),
        },
      ],
      budget,
    );
    if (!repairedContent) {
      return null;
    }

    const repairedValidation = parseAndValidate(
      repairedContent,
      citations,
      claim,
    );
    if (!repairedValidation.result) {
      warnings.push(
        `${provider.name} repair failed validation: ${repairedValidation.errors.join("; ")}`,
      );
    }
    return repairedValidation.result
      ? stripCitationIdsFromUserFields(repairedValidation.result, citations)
      : null;
  } catch (error) {
    warnings.push(
      `${provider.name} provider failed: ${error instanceof Error ? error.message : "unknown error"}`,
    );
    return null;
  }
}

function createProviderAnalysisBudget(): ProviderAnalysisBudget {
  const deadlineMs = parseBoundedInteger(
    process.env.LLM_ANALYSIS_DEADLINE_MS,
    10,
    30_000,
    DEFAULT_ANALYSIS_DEADLINE_MS,
  );
  const maxCalls = parseBoundedInteger(
    process.env.LLM_ANALYSIS_MAX_CALLS,
    1,
    4,
    DEFAULT_ANALYSIS_MAX_CALLS,
  );
  return { calls: 0, maxCalls, deadline: Date.now() + deadlineMs };
}

function providerAnalysisBudgetExhausted(
  budget: ProviderAnalysisBudget,
): boolean {
  return budget.calls >= budget.maxCalls || Date.now() >= budget.deadline;
}

async function requestChatCompletionWithinBudget(
  provider: LlmProvider,
  messages: ChatMessage[],
  budget: ProviderAnalysisBudget,
): Promise<string | null> {
  if (providerAnalysisBudgetExhausted(budget)) {
    throw new Error("Provider analysis deadline or call budget exhausted");
  }

  budget.calls += 1;
  const remainingMs = Math.max(1, budget.deadline - Date.now());
  const boundedProvider = {
    ...provider,
    timeoutMs: Math.min(provider.timeoutMs, remainingMs),
  };
  let deadlineTimer: ReturnType<typeof setTimeout> | undefined;

  try {
    return await Promise.race([
      requestChatCompletion(boundedProvider, messages),
      new Promise<never>((_, reject) => {
        deadlineTimer = setTimeout(
          () => reject(new Error("Provider analysis deadline exhausted")),
          remainingMs,
        );
      }),
    ]);
  } finally {
    if (deadlineTimer) {
      clearTimeout(deadlineTimer);
    }
  }
}

function parseBoundedInteger(
  raw: string | undefined,
  minimum: number,
  maximum: number,
  fallback: number,
): number {
  const parsed = Number.parseInt(raw || "", 10);
  if (!Number.isFinite(parsed)) {
    return fallback;
  }
  return Math.min(maximum, Math.max(minimum, parsed));
}

function parseAndValidate(
  content: string,
  citations: Citation[],
  claim: string,
): {
  result: AnalysisResult | null;
  errors: string[];
} {
  try {
    const parsed = normalizeModelPayload(parseJsonObject(content), citations);
    return {
      result: validateAnalysisPayload(parsed, citations, claim),
      errors: [],
    };
  } catch (error) {
    return {
      result: null,
      errors: [
        error instanceof Error ? error.message : "invalid analysis JSON",
      ],
    };
  }
}

function normalizeModelPayload(payload: unknown, citations: Citation[]) {
  if (!payload || typeof payload !== "object") {
    return payload;
  }

  const normalized = { ...(payload as Record<string, unknown>) };
  if (
    typeof normalized.refusalReason === "string" &&
    !normalized.refusalReason.trim()
  ) {
    delete normalized.refusalReason;
  }

  if (!Array.isArray(normalized.quiz) || normalized.quiz.length === 0) {
    normalized.quiz = generateQuiz(
      citations,
      String(normalized.normalizedClaim || "this analysis"),
    );
  }

  return normalized;
}

function buildDeterministicAnalysis(
  claim: string,
  citations: Citation[],
): AnalysisResult {
  const normalizedClaim = normalizeClaim(claim);
  const hasSources = citations.length > 0;
  const hasBillSources = citations.some((citation) => citation.bill);
  const truth = buildDeterministicTruth(claim, citations);
  const informationalQuestion = isInformationalQuestion(claim);
  const sourceSummaries = citations
    .slice(0, 3)
    .map((citation) => summarizeCitation(citation))
    .filter(Boolean);

  const result: AnalysisResult = {
    status: hasSources ? "answered" : "not_enough_info",
    evidenceStatus: hasBillSources
      ? "grounded"
      : hasSources
        ? "partial"
        : "not_enough_info",
    normalizedClaim,
    truthVerdict: truth.truthVerdict,
    verdictSummary: truth.verdictSummary,
    claimChecks: truth.claimChecks,
    oneSentenceAnswer: hasSources
      ? truth.verdictSummary
      : "CivicLens did not find enough official source context to evaluate this claim.",
    studentExplanation: hasSources
      ? informationalQuestion
        ? "CivicLens used the retrieved official excerpts directly because the student asked for an explanation rather than making a claim to score."
        : buildStudentExplanation(truth.truthVerdict)
      : "A civic-literacy answer needs official source material. Try naming a bill number, agency, chamber, vote, or district so the system can retrieve a grounded source.",
    keyContext: sourceSummaries,
    whatOfficialSourcesSay: hasSources
      ? citations.slice(0, 4).map((citation) => citation.excerpt)
      : [],
    contextGaps: hasSources
      ? [
          hasBillSources
            ? "This explains the official status and source text; it does not estimate personal benefit changes."
            : "The deterministic demo path does not infer facts beyond the retrieved official source excerpts.",
        ]
      : [
          "No matching official source excerpt was available in the demo fixture or database search.",
        ],
    framingFlags: detectFramingFlags(claim),
    quiz: generateQuiz(citations, normalizedClaim),
  };

  const cleaned = stripCitationIdsFromUserFields(result, citations);
  try {
    return validateAnalysisPayload(cleaned, citations, claim);
  } catch {
    return downgradeDeterministicAnalysis(cleaned, claim, citations.length > 0);
  }
}

function downgradeDeterministicAnalysis(
  result: AnalysisResult,
  claim: string,
  hasSources: boolean,
): AnalysisResult {
  const parts = claim
    .split(/\s*(?:;|\b(?:and|but|while|whereas)\b)\s*/i)
    .map((part) => part.trim())
    .filter(Boolean)
    .slice(0, 4);
  return {
    ...result,
    evidenceStatus: hasSources ? "partial" : "not_enough_info",
    truthVerdict: "unverifiable",
    verdictSummary: hasSources
      ? "The supplied official excerpts do not directly settle every material part of this claim."
      : "CivicLens did not find enough official evidence to judge this claim.",
    claimChecks: (parts.length > 0 ? parts : [claim]).map((part) => ({
      claim: normalizeClaim(part),
      verdict: "unverifiable" as const,
      explanation:
        "The supplied official excerpts do not directly prove or disprove this part of the claim.",
      citationIds: [],
    })),
    oneSentenceAnswer: hasSources
      ? "The available official evidence is not specific enough for a safe true-or-false verdict."
      : "CivicLens did not find enough official evidence for a safe verdict.",
    studentExplanation:
      "Unverifiable does not mean true or false. It means the available official excerpts do not settle the claim as written.",
  };
}

function buildStudentExplanation(verdict: TruthVerdict): string {
  if (verdict === "true") {
    return "The official excerpt states the same key fact as the claim. This verdict covers only that fact, not anything the source leaves out.";
  }
  if (verdict === "false") {
    return "The official excerpt states the opposite of the claim's key fact. This verdict covers only the part the source directly settles.";
  }

  return "The official excerpts do not settle the claim's main point. Unverifiable does not mean true or false; it means more official evidence is needed.";
}

function buildDeterministicTruth(
  claim: string,
  citations: Citation[],
): {
  truthVerdict: TruthVerdict;
  verdictSummary: string;
  claimChecks: ClaimCheck[];
} {
  const checkableClaim = normalizeClaim(claim);
  if (isInformationalQuestion(claim)) {
    const primaryCitation =
      citations.find((citation) =>
        /government pension offset|windfall elimination|repeal/i.test(
          `${citation.title} ${citation.excerpt}`,
        ),
      ) ?? citations[0];
    const answer = primaryCitation
      ? `This is a question, not a true-or-false claim. The official source says: ${primaryCitation.excerpt}`
      : "This is a question, not a true-or-false claim, and no matching official excerpt was available.";
    return {
      truthVerdict: "unverifiable",
      verdictSummary: answer,
      claimChecks: [
        {
          claim: checkableClaim,
          verdict: "unverifiable",
          explanation:
            "Questions ask for information; they do not make a factual statement that can be labeled true or false.",
          citationIds: primaryCitation ? [primaryCitation.id] : [],
        },
      ],
    };
  }

  const directMatch = findDirectTruthMatch(claim, citations);

  if (directMatch) {
    const supported = directMatch.verdict === "true";
    return {
      truthVerdict: directMatch.verdict,
      verdictSummary: supported
        ? truncateText(
            `True - the official record supports this claim: ${directMatch.citation.excerpt}`,
            700,
          )
        : truncateText(
            `False - the official record contradicts this claim: ${directMatch.citation.excerpt}`,
            700,
          ),
      claimChecks: [
        {
          claim: checkableClaim,
          verdict: directMatch.verdict,
          explanation: supported
            ? "The cited official excerpt states the same key fact."
            : "The cited official excerpt states the opposite of the key fact.",
          citationIds: [directMatch.citation.id],
        },
      ],
    };
  }

  const hasSources = citations.length > 0;
  return {
    truthVerdict: "unverifiable",
    verdictSummary: hasSources
      ? "The supplied official excerpts do not directly settle this claim."
      : "CivicLens did not find enough official evidence to judge this claim.",
    claimChecks: [
      {
        claim: checkableClaim,
        verdict: "unverifiable",
        explanation: hasSources
          ? "The excerpts give related context, but they do not prove or disprove this exact claim."
          : "No matching official excerpt was available, so CivicLens cannot safely judge this claim.",
        citationIds: [],
      },
    ],
  };
}

function findDirectTruthMatch(
  claim: string,
  citations: Citation[],
): { verdict: "true" | "false"; citation: Citation } | null {
  if (/;|\b(?:and|but|while|whereas)\b/i.test(claim)) {
    return null;
  }

  const billRef = extractBillReference(claim);
  const lawStatusClaim =
    /\b(?:become|became|is|was)\s+(?:a\s+)?(?:public\s+)?law\b/i.test(claim) ||
    /\bdid\s+(?:not\s+)?become\s+(?:a\s+)?(?:public\s+)?law\b/i.test(claim);

  if (billRef && lawStatusClaim) {
    const matchingCitation = citations.find((citation) => {
      const citationRef =
        citation.bill?.type && citation.bill.number
          ? { type: citation.bill.type, number: citation.bill.number }
          : extractBillReference(`${citation.title} ${citation.excerpt}`);
      if (
        !citationRef ||
        citationRef.type !== billRef.type ||
        citationRef.number !== billRef.number
      ) {
        return false;
      }
      return /\bbecame\s+(?:a\s+)?public\s+law\b|\bpublic\s+law(?:\s+(?:no\.?|number))?\s*\d/i.test(
        `${citation.title} ${citation.excerpt} ${citation.sourceDate ?? ""}`,
      );
    });

    if (matchingCitation) {
      const claimedLawNumber = extractPublicLawNumber(claim);
      const sourceLawNumber = extractPublicLawNumber(
        `${matchingCitation.title} ${matchingCitation.excerpt}`,
      );
      const numberContradicted = Boolean(
        claimedLawNumber &&
        sourceLawNumber &&
        claimedLawNumber !== sourceLawNumber,
      );
      const matchingSourceText = `${matchingCitation.title} ${matchingCitation.excerpt} ${matchingCitation.sourceDate ?? ""} ${matchingCitation.bill?.type ?? ""} ${matchingCitation.bill?.number ?? ""} ${matchingCitation.bill?.congress ?? ""}`;
      if (hasUnsupportedClaimQualifiers(claim, matchingSourceText)) {
        return null;
      }
      return {
        verdict: isNegatedClaim(claim) || numberContradicted ? "false" : "true",
        citation: matchingCitation,
      };
    }
  }

  if (/^\s*(?:what|who|why|how|where|when)\b/i.test(claim)) {
    return null;
  }

  const claimNegated = isNegatedClaim(claim);
  const claimCore = canonicalEvidenceText(
    claimNegated ? removeNegation(claim) : claim,
  );
  if (claimCore.length < 18) {
    return null;
  }

  for (const citation of citations) {
    const sourceText = canonicalEvidenceText(
      `${citation.title} ${citation.excerpt} ${citation.sourceDate ?? ""} ${citation.bill?.type ?? ""} ${citation.bill?.number ?? ""} ${citation.bill?.congress ?? ""}`,
    );
    if (sourceText.includes(claimCore)) {
      return { verdict: claimNegated ? "false" : "true", citation };
    }

    const claimTerms = canonicalEvidenceTerms(claimCore);
    const sourceTerms = new Set(canonicalEvidenceTerms(sourceText));
    const directlySettledRepealClaim =
      billRef &&
      claimTerms.includes("repeal") &&
      ["government", "pension", "offset", "windfall", "elimination"].filter(
        (term) => claimTerms.includes(term) && sourceTerms.has(term),
      ).length >= 3 &&
      sourceTerms.has("repeal");
    if (directlySettledRepealClaim) {
      if (hasUnsupportedClaimQualifiers(claim, sourceText)) {
        return null;
      }
      return { verdict: claimNegated ? "false" : "true", citation };
    }
  }

  return null;
}

function hasUnsupportedClaimQualifiers(
  claim: string,
  sourceText: string,
): boolean {
  const claimNumbers = claim.match(/\d[\d,]*(?:\.\d+)?%?/g) ?? [];
  const normalizedSource = sourceText.replace(/,/g, "");
  if (
    claimNumbers.some(
      (number) => !normalizedSource.includes(number.replace(/,/g, "")),
    )
  ) {
    return true;
  }

  const scopeQualifiers = [
    "only",
    "every",
    "all",
    "always",
    "exactly",
    "solely",
  ];
  const lowerClaim = claim.toLowerCase();
  const lowerSource = sourceText.toLowerCase();
  return scopeQualifiers.some(
    (qualifier) =>
      new RegExp(`\\b${qualifier}\\b`).test(lowerClaim) &&
      !new RegExp(`\\b${qualifier}\\b`).test(lowerSource),
  );
}

function extractBillReference(
  text: string,
): { type: string; number: number } | null {
  const house = text.match(/\b(?:h\.?\s*r\.?|house\s+bill)\s*[-.]?\s*(\d+)\b/i);
  if (house) {
    return { type: "hr", number: Number(house[1]) };
  }
  const senate = text.match(/\b(?:s\.?|senate\s+bill)\s*[-.]?\s*(\d+)\b/i);
  return senate ? { type: "s", number: Number(senate[1]) } : null;
}

function extractPublicLawNumber(text: string): string | null {
  const match = text.match(
    /\bpublic\s+law(?:\s+(?:no\.?|number))?\s*(\d+)\s*(?:-|\u2013)\s*(\d+)\b/i,
  );
  return match ? `${Number(match[1])}-${Number(match[2])}` : null;
}

function isNegatedClaim(text: string): boolean {
  return /\b(?:did\s+not|does\s+not|do\s+not|is\s+not|was\s+not|were\s+not|never|didn't|doesn't|isn't|wasn't|weren't)\b/i.test(
    text,
  );
}

function removeNegation(text: string): string {
  return text.replace(
    /\b(?:did\s+not|does\s+not|do\s+not|is\s+not|was\s+not|were\s+not|never|didn't|doesn't|isn't|wasn't|weren't)\b/gi,
    "",
  );
}

function canonicalEvidenceText(text: string): string {
  return text
    .toLowerCase()
    .replace(/\bbecame\b/g, "become")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function isInformationalQuestion(text: string): boolean {
  return /^\s*(?:what|who|why|how|where|when)\b/i.test(text);
}

function canonicalEvidenceTerms(text: string): string[] {
  const stopWords = new Set([
    "and",
    "bill",
    "did",
    "does",
    "for",
    "house",
    "not",
    "official",
    "only",
    "or",
    "senate",
    "the",
    "this",
  ]);
  return canonicalEvidenceText(text)
    .split(" ")
    .map((term) => {
      const forms: Record<string, string> = {
        changed: "change",
        changes: "change",
        eliminated: "eliminate",
        provisions: "rule",
        provision: "rule",
        repealed: "repeal",
        rules: "rule",
      };
      return forms[term] || term;
    })
    .filter((term) => term.length > 1 && !stopWords.has(term));
}

function truncateText(text: string, maxLength: number): string {
  const clean = text.replace(/\s+/g, " ").trim();
  if (clean.length <= maxLength) return clean;
  return `${clean
    .slice(0, maxLength - 3)
    .replace(/\s+\S*$/, "")
    .trim()}...`;
}

function summarizeCitation(citation: Citation): string {
  if (!citation.title && !citation.excerpt) {
    return "";
  }

  const title = citation.title || "Official source";
  const excerpt = citation.excerpt || "No excerpt returned.";
  return `${title}: ${excerpt}`;
}

function buildRefusal(
  claim: string,
  citations: Citation[],
  refusalReason: string,
): AnalysisResult {
  const result: AnalysisResult = {
    status: "refused",
    evidenceStatus: "not_applicable",
    normalizedClaim: normalizeClaim(claim),
    truthVerdict: "unverifiable",
    verdictSummary: refusalReason,
    claimChecks: [
      {
        claim: normalizeClaim(claim),
        verdict: "unverifiable",
        explanation:
          "CivicLens does not score requests for political persuasion or voting advice.",
        citationIds: [],
      },
    ],
    oneSentenceAnswer: refusalReason,
    studentExplanation:
      "You can still ask for a neutral explanation of a bill, vote, representative, district, or official source without asking CivicLens to persuade or recommend a political choice.",
    keyContext: [],
    whatOfficialSourcesSay: [],
    contextGaps: [],
    framingFlags: detectFramingFlags(claim),
    quiz: generateQuiz(citations, claim),
    refusalReason,
  };

  return stripCitationIdsFromUserFields(result, citations);
}

function detectFramingFlags(claim: string): string[] {
  const flags: string[] = [];
  if (/\b(always|never|everyone|no one)\b/i.test(claim)) {
    flags.push(
      "Absolute wording can hide exceptions; check the official source for scope.",
    );
  }
  if (/\b(shocking|corrupt|evil|traitor|destroy)\b/i.test(claim)) {
    flags.push(
      "Loaded language may be framing the issue before the evidence is checked.",
    );
  }
  return flags;
}

function normalizeClaim(claim: string): string {
  const trimmed = redactSensitiveText(claim).replace(/\s+/g, " ").trim();
  const bounded =
    trimmed.length > 499 ? `${trimmed.slice(0, 496).trimEnd()}...` : trimmed;
  return bounded.endsWith(".") || bounded.endsWith("?")
    ? bounded
    : `${bounded}.`;
}
