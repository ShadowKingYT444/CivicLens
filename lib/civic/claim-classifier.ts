import { INPUT_LIMITS } from "../constants";
import { ValidationError } from "../errors";
import { redactClaimText } from "../privacy/redaction";
import { parseBillRefs, type ParsedBillRef } from "./bill-parser";
import { detectFraming, type FramingFlag } from "./framing-detector";

export type ClaimCategory =
  | "bill"
  | "representative"
  | "vote_record"
  | "government_action"
  | "civic_process"
  | "persuasion_or_campaign"
  | "general_civic"
  | "out_of_scope";

export type ClaimConfidence = "high" | "medium" | "low";

export interface ClaimClassification {
  normalizedClaim: string;
  category: ClaimCategory;
  confidence: ClaimConfidence;
  isCivic: boolean;
  isPersuasion: boolean;
  requiresAddress: boolean;
  billRefs: ParsedBillRef[];
  framingFlags: FramingFlag[];
  refusalReason?: string;
  evidenceNeeds: Array<"bill_text" | "vote_record" | "member_record" | "district_lookup" | "official_context">;
}

const PERSUASION_PATTERN =
  /\b(?:who should i vote for|should i vote|should i support|should i oppose|vote for|vote against|support this candidate|oppose this candidate|which party should|persuade voters|convince voters|campaign message|campaign script|attack ad|target voters|microtarget|donate to|endorse)\b/i;
const REPRESENTATIVE_PATTERN = /\b(?:my representative|my rep\b|my congress(?:man|woman|person)?|senator|house member|district)\b/i;
const VOTE_RECORD_PATTERN = /\b(?:voted|vote record|roll call|yea|nay|passed the house|passed the senate|final passage)\b/i;
const GOVERNMENT_ACTION_PATTERN = /\b(?:law|executive order|agency|regulation|supreme court|public law|rulemaking|appropriation|budget)\b/i;
const CIVIC_PROCESS_PATTERN = /\b(?:how does|what is|explain|difference between|how can congress|committee|filibuster|veto|amendment)\b/i;
const ADDRESS_NEED_PATTERN = /\b(?:my representative|my district|who represents me|near me|where i live|my address|zip code)\b/i;

export function classifyClaim(input: string): ClaimClassification {
  const normalizedInput = normalizeClaim(input);

  if (
    normalizedInput.length < INPUT_LIMITS.claimMinLength ||
    normalizedInput.length > INPUT_LIMITS.claimMaxLength
  ) {
    throw new ValidationError("Claim length is outside the supported range.", {
      min: INPUT_LIMITS.claimMinLength,
      max: INPUT_LIMITS.claimMaxLength,
    });
  }

  const redacted = redactClaimText(normalizedInput);
  const normalizedClaim = redacted.redacted;
  const billRefs = parseBillRefs(normalizedClaim);
  const framingFlags = detectFraming(normalizedClaim);
  const isPersuasion = PERSUASION_PATTERN.test(normalizedClaim);
  const requiresAddress = ADDRESS_NEED_PATTERN.test(normalizedClaim);
  const category = chooseCategory(normalizedClaim, billRefs, isPersuasion);
  const isCivic = category !== "out_of_scope";

  return {
    normalizedClaim,
    category,
    confidence: chooseConfidence(category, billRefs, framingFlags),
    isCivic,
    isPersuasion,
    requiresAddress,
    billRefs,
    framingFlags,
    refusalReason: isPersuasion
      ? "CivicLens can explain official records neutrally, but it cannot provide voting advice, candidate recommendations, persuasion copy, or campaign strategy."
      : undefined,
    evidenceNeeds: chooseEvidenceNeeds(category, billRefs, requiresAddress),
  };
}

export function normalizeClaim(input: string): string {
  return input.trim().replace(/\s+/g, " ");
}

function chooseCategory(input: string, billRefs: ParsedBillRef[], isPersuasion: boolean): ClaimCategory {
  if (isPersuasion) return "persuasion_or_campaign";
  if (VOTE_RECORD_PATTERN.test(input)) return "vote_record";
  if (billRefs.length > 0 || /\b(?:h\.?r\.?|s\.?|resolution|bill)\b/i.test(input)) return "bill";
  if (REPRESENTATIVE_PATTERN.test(input)) return "representative";
  if (GOVERNMENT_ACTION_PATTERN.test(input)) return "government_action";
  if (CIVIC_PROCESS_PATTERN.test(input)) return "civic_process";
  if (/\b(?:congress|federal|state legislature|election|voting|court|government)\b/i.test(input)) {
    return "general_civic";
  }

  return "out_of_scope";
}

function chooseConfidence(
  category: ClaimCategory,
  billRefs: ParsedBillRef[],
  framingFlags: FramingFlag[],
): ClaimConfidence {
  if (category === "out_of_scope") return "low";
  if (billRefs.length > 0 || category === "representative" || category === "vote_record") return "high";
  if (framingFlags.some((flag) => flag.severity === "high")) return "medium";
  return "medium";
}

function chooseEvidenceNeeds(
  category: ClaimCategory,
  billRefs: ParsedBillRef[],
  requiresAddress: boolean,
): ClaimClassification["evidenceNeeds"] {
  const needs = new Set<ClaimClassification["evidenceNeeds"][number]>();

  if (billRefs.length > 0 || category === "bill") needs.add("bill_text");
  if (category === "vote_record") needs.add("vote_record");
  if (category === "representative") needs.add("member_record");
  if (requiresAddress) needs.add("district_lookup");
  if (category !== "out_of_scope") needs.add("official_context");

  return [...needs];
}
