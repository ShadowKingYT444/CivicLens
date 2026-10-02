import { containsAddressLikeText } from "../privacy/redaction";
import { createHash } from "crypto";
import {
  AnalysisResultSchema,
  CitationSchema,
  type AnalysisResult,
  type Citation,
} from "./schemas";

const OFFICIAL_SOURCE_HOSTS = [
  "congress.gov",
  "www.congress.gov",
  "api.congress.gov",
  "archives.gov",
  "www.archives.gov",
  "govinfo.gov",
  "www.govinfo.gov",
  "census.gov",
  "geocoding.geo.census.gov",
  "house.gov",
  "www.house.gov",
  "federalregister.gov",
  "www.federalregister.gov",
  "uploads.federalregister.gov",
  "foia.gov",
  "www.foia.gov",
  "courtlistener.com",
  "www.courtlistener.com",
  "ecfr.gov",
  "www.ecfr.gov",
  "fec.gov",
  "www.fec.gov",
  "justice.gov",
  "www.justice.gov",
  "regulations.gov",
  "www.regulations.gov",
  "senate.gov",
  "www.senate.gov",
  "usaspending.gov",
  "www.usaspending.gov",
  "uscourts.gov",
  "www.uscourts.gov",
  "whitehouse.gov",
  "www.whitehouse.gov",
  "bls.gov",
  "www.bls.gov",
  "cbo.gov",
  "www.cbo.gov",
  "eia.gov",
  "www.eia.gov",
  "epa.gov",
  "www.epa.gov",
  "fns.usda.gov",
  "ice.gov",
  "www.ice.gov",
  "irs.gov",
  "www.irs.gov",
  "ssa.gov",
  "www.ssa.gov",
  "transportation.gov",
  "www.transportation.gov",
  "usa.gov",
  "www.usa.gov",
  "uscis.gov",
  "www.uscis.gov",
  "usda.gov",
  "www.usda.gov",
];

export type CitationValidationResult = {
  ok: boolean;
  errors: string[];
};

export class AnalysisValidationError extends Error {}

export function sha256Hex(input: string): string {
  return createHash("sha256").update(input).digest("hex");
}

export function projectAnalysisResultForStorage(
  result: unknown,
  storeRawInputs: boolean,
): unknown {
  if (
    storeRawInputs ||
    !result ||
    typeof result !== "object" ||
    Array.isArray(result)
  ) {
    return result;
  }

  const source = result as Record<string, unknown>;
  const projected: Record<string, unknown> = {};
  for (const key of ["status", "evidenceStatus", "truthVerdict"] as const) {
    if (source[key] !== undefined) projected[key] = source[key];
  }
  if (Array.isArray(source.claimChecks)) {
    projected.claimChecks = source.claimChecks.map((check) => {
      if (!check || typeof check !== "object" || Array.isArray(check)) {
        return {};
      }
      const record = check as Record<string, unknown>;
      return {
        verdict: record.verdict,
        citationIds: Array.isArray(record.citationIds)
          ? record.citationIds
          : [],
      };
    });
  }

  return projected;
}

export function projectCitationsForStorage(citations: unknown[], storeRawInputs: boolean): unknown[] {
  if (storeRawInputs) return citations;
  return citations.flatMap((value) => {
    const parsed = CitationSchema.safeParse(value);
    if (!parsed.success) return [];
    const { id, sourceDocumentId, sourceType, bill } = parsed.data;
    const url = new URL(parsed.data.url);
    url.search = "";
    url.hash = "";
    url.username = "";
    url.password = "";
    return [{ id, sourceDocumentId, sourceType, url: url.toString(), ...(bill ? { bill } : {}) }];
  });
}

export { redactSensitiveText } from "../privacy/redaction";

export function looksLikeAddress(input: string): boolean {
  return containsAddressLikeText(input.replace(/\[redacted address\]/gi, " "));
}

export function isPersuasionOrVotingAdvice(input: string): boolean {
  return containsPoliticalPersuasion(input);
}

export function isOfficialSourceUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    const host = parsed.hostname.toLowerCase();
    return parsed.protocol === "https:" && !parsed.username && !parsed.password && OFFICIAL_SOURCE_HOSTS.some(
      (officialHost) =>
        host === officialHost || host.endsWith(`.${officialHost}`),
    );
  } catch {
    return false;
  }
}

export function validateCitations(
  citations: Citation[],
): CitationValidationResult {
  const errors: string[] = [];
  const seenIds = new Set<string>();

  citations.forEach((citation, index) => {
    const parsed = CitationSchema.safeParse(citation);
    if (!parsed.success) {
      errors.push(`citation ${index + 1} is malformed`);
      return;
    }
    if (seenIds.has(citation.id)) {
      errors.push(`citation id ${citation.id} is duplicated`);
    }
    seenIds.add(citation.id);

    if (
      citation.sourceType !== "fixture" &&
      citation.sourceType !== "concept-card" &&
      !isOfficialSourceUrl(citation.url)
    ) {
      errors.push(`citation ${citation.id} is not an allowed official source`);
    }
  });

  return { ok: errors.length === 0, errors };
}

export function parseJsonObject(raw: string): unknown {
  const parsed = JSON.parse(raw.trim());
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new AnalysisValidationError("Expected a strict JSON object");
  }

  return parsed;
}

export function validateAnalysisPayload(
  payload: unknown,
  citations: Citation[],
  expectedClaim?: string,
): AnalysisResult {
  const result = AnalysisResultSchema.parse(normalizeAnalysisPayload(payload));
  const citationIds = new Set(citations.map((citation) => citation.id));
  const citationsById = new Map(
    citations.map((citation) => [citation.id, citation]),
  );
  const serialized = JSON.stringify(result);

  if (collectStrings(result).some(containsPoliticalPersuasion)) {
    throw new AnalysisValidationError(
      "Analysis output contains political persuasion or voting advice",
    );
  }

  const claimToCheck = expectedClaim
    ? semanticClaimText(expectedClaim)
    : result.normalizedClaim;
  const independentlyCheckableClauseCount =
    countIndependentlyCheckableClauses(claimToCheck);
  if (independentlyCheckableClauseCount > result.claimChecks.length) {
    throw new AnalysisValidationError(
      "Compound claim must be decomposed into separate claim checks",
    );
  }

  if (expectedClaim) {
    validateClaimCheckAlignment(claimToCheck, result.claimChecks);
  }

  const citedIds = Array.from(serialized.matchAll(/\[([A-Za-z0-9_-]+)\]/g)).map(
    (match) => match[1],
  );
  const unknownIds = citedIds.filter((id) => !citationIds.has(id));
  if (unknownIds.length > 0) {
    throw new AnalysisValidationError(
      "Unknown citation ids",
    );
  }

  const unknownClaimCheckIds = result.claimChecks
    .flatMap((check) => check.citationIds)
    .filter((id) => !citationIds.has(id));
  if (unknownClaimCheckIds.length > 0) {
    throw new AnalysisValidationError(
      "Unknown claim-check citation ids",
    );
  }

  const unknownQuizCitationIds = result.quiz
    .flatMap((question) => question.citationIds)
    .filter((id) => !citationIds.has(id));
  if (unknownQuizCitationIds.length > 0) {
    throw new AnalysisValidationError(
      "Unknown quiz citation ids",
    );
  }

  for (const question of result.quiz) {
    if (citations.length > 0 && question.citationIds.length === 0) {
      throw new AnalysisValidationError(
        "Every quiz generated from official evidence requires a supplied citation id",
      );
    }

    const quizEvidence = question.citationIds
      .map((id) => citationsById.get(id))
      .filter((citation): citation is Citation => Boolean(citation))
      .map(
        (citation) =>
          `${citation.title} ${citation.excerpt} ${citation.bill?.congress ?? ""} ${citation.bill?.type ?? ""} ${citation.bill?.number ?? ""}`,
      )
      .join(" ");
    validateQuizEvidence(question, quizEvidence);
  }

  const uncitedSettledCheck = result.claimChecks.find(
    (check) =>
      check.verdict !== "unverifiable" && check.citationIds.length === 0,
  );
  if (uncitedSettledCheck) {
    throw new AnalysisValidationError(
      "Every settled claim check requires at least one supplied citation id",
    );
  }

  for (const check of result.claimChecks) {
    if (check.verdict === "unverifiable") {
      continue;
    }
    if (check.verdict === "mixed") {
      throw new AnalysisValidationError(
        "A mixed claim check must be decomposed into directional checks",
      );
    }

    const citedEvidence = check.citationIds
      .map((id) => citationsById.get(id))
      .filter((citation): citation is Citation => Boolean(citation))
      .map(
        (citation) =>
          `${citation.title} ${citation.excerpt} ${citation.bill?.type ?? ""} ${citation.bill?.number ?? ""} ${citation.bill?.congress ?? ""}`,
      )
      .join(" ");
    validateSettledCheckEvidence(
      check.claim,
      check.explanation,
      citedEvidence,
      check.verdict,
    );
  }

  if (
    result.claimChecks.every((check) => check.verdict === "unverifiable") &&
    result.truthVerdict !== "unverifiable"
  ) {
    throw new AnalysisValidationError(
      "An analysis with only unverifiable claim checks must have an unverifiable overall verdict",
    );
  }

  if (
    result.truthVerdict === "true" &&
    result.claimChecks.some((check) => check.verdict !== "true")
  ) {
    throw new AnalysisValidationError(
      "A true overall verdict requires every material claim check to be true",
    );
  }

  if (
    result.truthVerdict === "false" &&
    result.claimChecks.some((check) => check.verdict !== "false")
  ) {
    throw new AnalysisValidationError(
      "A false overall verdict requires every material claim check to be false",
    );
  }

  if (
    result.truthVerdict === "mixed" &&
    !(
      result.claimChecks.some(
        (check) => check.verdict === "true" || check.verdict === "mostly_true",
      ) &&
      result.claimChecks.some(
        (check) =>
          check.verdict === "false" || check.verdict === "mostly_false",
      )
    )
  ) {
    throw new AnalysisValidationError(
      "A mixed overall verdict requires both supported and contradicted material claim checks",
    );
  }

  if (
    result.truthVerdict === "mostly_true" &&
    !result.claimChecks.some(
      (check) => check.verdict === "true" || check.verdict === "mostly_true",
    )
  ) {
    throw new AnalysisValidationError(
      "A mostly_true overall verdict requires supported material evidence",
    );
  }

  if (
    result.truthVerdict === "mostly_false" &&
    !result.claimChecks.some(
      (check) => check.verdict === "false" || check.verdict === "mostly_false",
    )
  ) {
    throw new AnalysisValidationError(
      "A mostly_false overall verdict requires contradicted material evidence",
    );
  }

  const derivedVerdict = deriveOverallVerdict(
    result.claimChecks.map((check) => check.verdict),
  );
  if (result.truthVerdict !== derivedVerdict) {
    throw new AnalysisValidationError(
      `Overall truth verdict must be derived from claim checks as ${derivedVerdict}`,
    );
  }

  if (result.evidenceStatus === "grounded" && citations.length === 0) {
    throw new AnalysisValidationError("Grounded analysis requires citations");
  }

  if (result.truthVerdict !== "unverifiable" && citations.length === 0) {
    throw new AnalysisValidationError("A substantive truth verdict requires citations");
  }

  return result;
}

function deriveOverallVerdict(
  verdicts: AnalysisResult["claimChecks"][number]["verdict"][],
): AnalysisResult["truthVerdict"] {
  if (verdicts.every((verdict) => verdict === "true")) return "true";
  if (verdicts.every((verdict) => verdict === "false")) return "false";
  if (verdicts.every((verdict) => verdict === "unverifiable")) {
    return "unverifiable";
  }
  if (
    verdicts.every((verdict) => verdict === "true" || verdict === "mostly_true")
  ) {
    return "mostly_true";
  }
  if (
    verdicts.every(
      (verdict) => verdict === "false" || verdict === "mostly_false",
    )
  ) {
    return "mostly_false";
  }
  if (verdicts.some((verdict) => verdict === "unverifiable")) {
    return "unverifiable";
  }
  return "mixed";
}

function normalizeAnalysisPayload(payload: unknown): unknown {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    return payload;
  }

  const normalized = { ...(payload as Record<string, unknown>) };
  if (normalized.refusalReason === null) {
    delete normalized.refusalReason;
  }

  return normalized;
}

function collectStrings(value: unknown): string[] {
  if (typeof value === "string") {
    return [value];
  }
  if (Array.isArray(value)) {
    return value.flatMap(collectStrings);
  }
  if (value && typeof value === "object") {
    return Object.values(value).flatMap(collectStrings);
  }
  return [];
}

function containsPoliticalPersuasion(text: string): boolean {
  const directedAdvice =
    /\b(?:i|we|you|students?|voters?|people)\s+(?:really\s+)?(?:should|must|need\s+to|ought\s+to)\s+(?:vote|support|oppose|elect|reject|endorse|choose|back|campaign|donate|volunteer)\b/i;
  const invertedAdvice =
    /\bshould\s+(?:i|we|you|students?|voters?|people)\s+(?:vote|support|oppose|elect|reject|endorse|choose|back)\b/i;
  const choiceAdvice =
    /\b(?:who|which\s+candidate|which\s+party|which\s+side)\s+should\s+(?:i|we|you|students?|voters?)\s+(?:vote\s+for|support|oppose|elect|reject)\b/i;
  const campaignRequest =
    /\b(?:campaign\s+strategy|attack\s+ad|persuad(?:e|ing)\s+(?:students?|people|voters?|the\s+public)|convinc(?:e|ing)\s+(?:students?|people|voters?|the\s+public)|help\s+(?:me|us|my|our)\s+(?:campaign|candidate|party)(?:\s+win)?|tell\s+(?:me|us)\s+(?:how|who)\s+to\s+vote)\b/i;
  const campaignContent =
    /\b(?:write|draft|create)\b.{0,80}\b(?:speech|script|message|post|campaign|endorsement|attack\s+ad|persuasion|voters?|candidate|party|senator|representative|governor|president)\b/i;
  const recommendation =
    /\b(?:recommend|endorse)\s+(?:a\s+|the\s+|this\s+)?(?:candidate|party|vote|side)|\b(?:best\s+(?:candidate|party|political\s+choice)|(?:only|right|smartest)\s+(?:candidate|party|political\s+choice)|deserves?\s+(?:my|your|our)\s+(?:vote|support))\b/i;
  const imperative =
    /^\s*(?:please\s+)?(?:vote\s+(?:for|against|yes|no)|(?:support|oppose|elect|reject|endorse|choose|back)\s+(?:(?:the|this|that|a)\s+)?(?:candidate|party|bill|measure|proposition|side)|(?:donate|volunteer)\s+(?:for|to))\b/i;
  const advocacyClaim =
    /\b(?:bill|measure|proposal|program|grants?|candidate|party|senator|representative|governor|president)\b.{0,50}\b(?:deserves?\s+(?:support|opposition)|should\s+be\s+(?:supported|backed|opposed)|is\s+the\s+(?:right|best)\s+choice)\b/i;

  return (
    directedAdvice.test(text) ||
    invertedAdvice.test(text) ||
    choiceAdvice.test(text) ||
    campaignRequest.test(text) ||
    campaignContent.test(text) ||
    recommendation.test(text) ||
    imperative.test(text) ||
    advocacyClaim.test(text)
  );
}

function countIndependentlyCheckableClauses(claim: string): number {
  const clauses = claim
    .split(/\s*(?:;|\b(?:and|but|while|whereas)\b)\s*/i)
    .map((clause) => clause.trim())
    .filter(Boolean);
  const predicatePattern =
    /\b(?:is|are|was|were|has|have|had|do|does|did|will|would|can|could|should|must|become|became|pass|passed|repeal|repealed|pay|pays|send|sends|give|gives|cut|cuts|raise|raises|lower|lowers|require|requires|required|allow|allows|allowed|ban|bans|banned|prohibit|prohibits|prohibited|fund|funds|funded)\b/i;
  const checkableCount = clauses.filter((clause) =>
    predicatePattern.test(clause),
  ).length;
  return Math.min(4, Math.max(1, checkableCount));
}

function validateClaimCheckAlignment(
  expectedClaim: string,
  claimChecks: AnalysisResult["claimChecks"],
): void {
  const expectedTerms = [
    ...new Set(meaningfulEvidenceTerms(removeEvidenceNegation(expectedClaim))),
  ];
  const checkedText = claimChecks.map((check) => check.claim).join(" ");
  const checkedTerms = new Set(
    meaningfulEvidenceTerms(removeEvidenceNegation(checkedText)),
  );
  const overlap = expectedTerms.filter((term) => checkedTerms.has(term)).length;
  const requiredOverlap = Math.max(2, Math.ceil(expectedTerms.length * 0.6));
  if (expectedTerms.length >= 2 && overlap < requiredOverlap) {
    throw new AnalysisValidationError("Claim checks do not cover the student's actual claim");
  }

  const expectedClauses = splitClaimClauses(expectedClaim);
  for (const check of claimChecks) {
    const checkTerms = new Set(
      meaningfulEvidenceTerms(removeEvidenceNegation(check.claim)),
    );
    const matchedClause = expectedClauses
      .map((clause) => {
        const clauseTerms = [
          ...new Set(meaningfulEvidenceTerms(removeEvidenceNegation(clause))),
        ];
        return {
          clause,
          clauseTermCount: clauseTerms.length,
          overlap: clauseTerms.filter((term) => checkTerms.has(term)).length,
        };
      })
      .sort((left, right) => right.overlap - left.overlap)[0];
    const requiredClauseOverlap = matchedClause
      ? Math.min(2, matchedClause.clauseTermCount, checkTerms.size)
      : 1;
    if (
      !matchedClause ||
      requiredClauseOverlap < 1 ||
      matchedClause.overlap < requiredClauseOverlap
    ) {
      throw new AnalysisValidationError("Claim check added material outside the student's claim");
    }
    if (
      hasEvidenceNegation(matchedClause.clause) !==
      hasEvidenceNegation(check.claim)
    ) {
      throw new AnalysisValidationError("Claim check changed the claim's truth polarity");
    }
  }
}

function splitClaimClauses(claim: string): string[] {
  const clauses = claim
    .split(/\s*(?:;|\b(?:and|but|while|whereas)\b)\s*/i)
    .map((clause) => clause.trim())
    .filter(Boolean);
  return clauses.length > 0 ? clauses : [claim];
}

function semanticClaimText(text: string): string {
  return text
    .replace(/\b(?:my\s+)?address\s+is\s+\[redacted address\]\s*,?/gi, " ")
    .replace(/\[redacted address\]\s*,?/gi, " ")
    .replace(/\bemail\s+is\s+\[redacted email\]\s*,?/gi, " ")
    .replace(/\[redacted email\]\s*,?/gi, " ")
    .replace(/\b(?:and\s+)?phone\s+is\s+\[redacted phone\]\s*;?/gi, " ")
    .replace(/\[redacted phone\]\s*;?/gi, " ")
    .replace(/^[\s,;:-]+/, "")
    .replace(/\s+/g, " ")
    .trim();
}

const EVIDENCE_STOP_WORDS = new Set([
  "about",
  "according",
  "after",
  "also",
  "and",
  "are",
  "because",
  "before",
  "being",
  "claim",
  "does",
  "excerpt",
  "from",
  "have",
  "into",
  "official",
  "only",
  "provided",
  "says",
  "source",
  "states",
  "that",
  "their",
  "there",
  "these",
  "they",
  "this",
  "those",
  "through",
  "under",
  "what",
  "when",
  "where",
  "which",
  "with",
  "would",
]);

function validateSettledCheckEvidence(
  claim: string,
  explanation: string,
  citedEvidence: string,
  verdict: AnalysisResult["claimChecks"][number]["verdict"],
): void {
  const evidenceNumbers = extractNumericDetails(citedEvidence);
  const unsupportedNumbers = extractNumericDetails(
    `${claim} ${explanation}`,
  ).filter(
    (number) =>
      isHighRiskNumericDetail(number) && !evidenceNumbers.includes(number),
  );
  if (unsupportedNumbers.length > 0) {
    throw new AnalysisValidationError(
      "Unsupported numeric detail in claim check",
    );
  }

  const claimTerms = meaningfulEvidenceTerms(claim);
  const evidenceTerms = new Set(meaningfulEvidenceTerms(citedEvidence));
  const overlapCount = Array.from(new Set(claimTerms)).filter((term) =>
    evidenceTerms.has(term),
  ).length;
  const requiredOverlap = Math.min(2, new Set(claimTerms).size);
  if (requiredOverlap > 0 && overlapCount < requiredOverlap) {
    throw new AnalysisValidationError(
      "Settled claim check is not meaningfully connected to its cited excerpts",
    );
  }

  const inferredVerdict = inferSimpleEvidenceVerdict(claim, citedEvidence);
  if (
    (verdict === "true" || verdict === "mostly_true") &&
    inferredVerdict !== "true"
  ) {
    throw new AnalysisValidationError(
      "Cited excerpts do not directly support this claim verdict",
    );
  }
  if (
    (verdict === "false" || verdict === "mostly_false") &&
    inferredVerdict !== "false"
  ) {
    throw new AnalysisValidationError(
      "Cited excerpts do not directly contradict this claim verdict",
    );
  }
}

function validateQuizEvidence(
  question: AnalysisResult["quiz"][number],
  citedEvidence: string,
): void {
  if (question.citationIds.length === 0) {
    return;
  }

  const evidenceNumbers = extractNumericDetails(citedEvidence);
  const unsupportedNumbers = extractNumericDetails(
    `${question.question} ${question.choices.join(" ")} ${question.correctAnswer} ${question.explanation}`,
  ).filter(
    (number) =>
      isHighRiskNumericDetail(number) && !evidenceNumbers.includes(number),
  );
  if (unsupportedNumbers.length > 0) {
    throw new AnalysisValidationError(
      "Unsupported numeric detail in quiz",
    );
  }
}

function inferSimpleEvidenceVerdict(
  claim: string,
  evidence: string,
): "true" | "false" | null {
  const claimTerms = [
    ...new Set(meaningfulEvidenceTerms(removeEvidenceNegation(claim))),
  ];
  const evidenceTerms = new Set(
    meaningfulEvidenceTerms(removeEvidenceNegation(evidence)),
  );
  const overlap = claimTerms.filter((term) => evidenceTerms.has(term)).length;
  const requiredOverlap = Math.max(2, Math.ceil(claimTerms.length * 0.6));
  if (claimTerms.length < 2 || overlap < requiredOverlap) {
    return null;
  }

  return hasRelevantEvidenceNegation(claim, claimTerms) ===
    hasRelevantEvidenceNegation(evidence, claimTerms)
    ? "true"
    : "false";
}

function hasEvidenceNegation(text: string): boolean {
  return /\b(?:did\s+not|does\s+not|do\s+not|is\s+not|was\s+not|were\s+not|cannot|can't|never|no)\b/i.test(
    normalizeNegationText(text),
  );
}

function removeEvidenceNegation(text: string): string {
  return normalizeNegationText(text).replace(
    /\b(?:did\s+not|does\s+not|do\s+not|is\s+not|was\s+not|were\s+not|cannot|can't|never|no)\b/gi,
    " ",
  );
}

function hasRelevantEvidenceNegation(
  text: string,
  focalTerms: string[],
): boolean {
  const terms = [...new Set(focalTerms)]
    .filter((term) => term.length >= 3)
    .map((term) => term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
  if (terms.length === 0) {
    return hasEvidenceNegation(text);
  }

  const negation =
    "(?:did\\s+not|does\\s+not|do\\s+not|is\\s+not|was\\s+not|were\\s+not|cannot|can't|never|no)";
  const nearbyTerm = new RegExp(
    `\\b${negation}\\b(?:\\s+[a-z][a-z'-]*){0,3}\\s+(?:${terms.join("|")})\\b`,
    "i",
  );
  return nearbyTerm.test(normalizeSemanticTokens(text));
}

function normalizeNegationText(text: string): string {
  const contractions: Record<string, string> = {
    "didn't": "did not",
    "doesn't": "does not",
    "don't": "do not",
    "isn't": "is not",
    "wasn't": "was not",
    "weren't": "were not",
    "can't": "cannot",
    "won't": "will not",
  };
  return text
    .replace(/\bpublic\s+law\s+no\.?\s*:?/gi, "public law number ")
    .replace(
      /\b(?:didn't|doesn't|don't|isn't|wasn't|weren't|can't|won't)\b/gi,
      (match) => contractions[match.toLowerCase()] ?? match,
    );
}

function normalizeSemanticTokens(text: string): string {
  return normalizeNegationText(text)
    .toLowerCase()
    .replace(/[a-z][a-z'-]{2,}/g, (term) => normalizeEvidenceTerm(term));
}

function extractNumericDetails(text: string): string[] {
  return Array.from(text.matchAll(/(?:\$\s*)?\d[\d,]*(?:\.\d+)?%?/g)).map(
    (match) => match[0].replace(/[,\s]/g, "").toLowerCase(),
  );
}

function isHighRiskNumericDetail(value: string): boolean {
  if (value.startsWith("$") || value.endsWith("%") || value.includes(".")) {
    return true;
  }

  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed >= 100;
}

function meaningfulEvidenceTerms(text: string): string[] {
  return (text.toLowerCase().match(/[a-z][a-z'-]{2,}/g) || [])
    .map(normalizeEvidenceTerm)
    .filter((term) => !EVIDENCE_STOP_WORDS.has(term));
}

function normalizeEvidenceTerm(term: string): string {
  const knownForms: Record<string, string> = {
    addressed: "address",
    applies: "apply",
    applied: "apply",
    became: "become",
    changed: "change",
    introduced: "introduce",
    listed: "list",
    lists: "list",
    passed: "pass",
    repealed: "repeal",
  };
  return knownForms[term] || term;
}

export function stripCitationIdsFromUserFields(
  result: AnalysisResult,
  citations: Citation[],
): AnalysisResult {
  const citationIds = new Set(citations.map((citation) => citation.id));
  const stripText = (text: string): string =>
    stripCitationIds(text, citationIds);

  return {
    ...result,
    normalizedClaim: stripText(result.normalizedClaim),
    verdictSummary: stripText(result.verdictSummary),
    claimChecks: result.claimChecks.map((check) => ({
      ...check,
      claim: stripText(check.claim),
      explanation: stripText(check.explanation),
    })),
    oneSentenceAnswer: stripText(result.oneSentenceAnswer),
    studentExplanation: stripText(result.studentExplanation),
    keyContext: result.keyContext.map(stripText),
    whatOfficialSourcesSay: result.whatOfficialSourcesSay.map(stripText),
    contextGaps: result.contextGaps.map(stripText),
    framingFlags: result.framingFlags.map(stripText),
    quiz: result.quiz.map((question) => ({
      ...question,
      question: stripText(question.question),
      choices: question.choices.map(stripText),
      correctAnswer: stripText(question.correctAnswer),
      explanation: stripText(question.explanation),
      citationIds: question.citationIds,
    })),
    refusalReason: result.refusalReason
      ? stripText(result.refusalReason)
      : undefined,
  };
}

function stripCitationIds(text: string, citationIds: Set<string>): string {
  let stripped = text;
  for (const id of citationIds) {
    const escaped = escapeRegExp(id);
    stripped = stripped
      .replace(new RegExp(`\\s*\\[${escaped}\\]`, "g"), "")
      .replace(new RegExp(`\\s*\\(${escaped}\\)`, "g"), "")
      .replace(
        new RegExp(
          `\\b(?:source|citation|cite)\\s+${escaped}\\b\\s*[:,-]?\\s*`,
          "gi",
        ),
        "the cited source ",
      )
      .replace(
        new RegExp(`\\b${escaped}\\s+(says|states|notes|lists|shows)\\b`, "gi"),
        "the cited source $1",
      );
  }

  return stripped
    .replace(/\s{2,}/g, " ")
    .replace(/\s+([.,;:!?])/g, "$1")
    .trim();
}

function escapeRegExp(input: string): string {
  return input.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
