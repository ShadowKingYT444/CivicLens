import { z } from "zod";
import type {
  AnalysisQuizQuestion as AnalysisQuizQuestionContract,
  AnalysisResult as AnalysisResultContract,
  BillType as BillTypeContract,
  Citation as CitationContract,
  ClaimCheck as ClaimCheckContract,
  TruthVerdict as TruthVerdictContract,
} from "../types";

export const BillTypeSchema = z.enum([
  "hr",
  "s",
  "hjres",
  "sjres",
  "hconres",
  "sconres",
  "hres",
  "sres",
]) satisfies z.ZodType<BillTypeContract>;

export const SourceTypeSchema = z.enum([
  "bill",
  "vote",
  "congress",
  "govinfo",
  "census",
  "house",
  "senate",
  "constitution",
  "courts",
  "federal-register",
  "records",
  "elections",
  "state-local",
  "civil-rights",
  "lobbying",
  "concept-card",
  "fixture",
  "other",
]);

export const CitationSchema = z
  .object({
    id: z.string().min(1).max(80),
    sourceDocumentId: z.string().min(1).max(160),
    sourceType: SourceTypeSchema,
    title: z.string().min(1).max(240),
    url: z.string().url(),
    sourceDate: z.string().max(40).optional(),
    excerpt: z.string().min(1).max(1200),
    bill: z
      .object({
        congress: z.number().int().min(1).max(200).optional(),
        type: BillTypeSchema.optional(),
        number: z.number().int().min(1).max(999999).optional(),
      })
      .optional(),
  })
  .strict() satisfies z.ZodType<CitationContract>;

export const QuizQuestionSchema = z
  .object({
    id: z.string().min(1).max(80),
    question: z.string().min(1).max(280),
    choices: z.array(z.string().min(1).max(180)).min(2).max(5),
    correctAnswer: z.string().min(1).max(180),
    explanation: z.string().min(1).max(500),
    citationIds: z.array(z.string().min(1).max(80)).max(5).default([]),
  })
  .strict() satisfies z.ZodType<AnalysisQuizQuestionContract>;

export const TruthVerdictSchema = z.enum([
  "true",
  "mostly_true",
  "mixed",
  "mostly_false",
  "false",
  "unverifiable",
]) satisfies z.ZodType<TruthVerdictContract>;

export const ClaimCheckSchema = z
  .object({
    claim: z.string().min(1).max(500),
    verdict: TruthVerdictSchema,
    explanation: z.string().min(1).max(700),
    citationIds: z.array(z.string().min(1).max(80)).max(5),
  })
  .strict() satisfies z.ZodType<ClaimCheckContract>;

export const AnalysisResultSchema = z
  .object({
    status: z.enum([
      "answered",
      "refused",
      "insufficient_sources",
      "not_enough_info",
      "needs_clarification",
    ]),
    evidenceStatus: z.enum([
      "grounded",
      "partial",
      "insufficient",
      "not_enough_info",
      "not_applicable",
    ]),
    normalizedClaim: z.string().min(1).max(500),
    truthVerdict: TruthVerdictSchema,
    verdictSummary: z.string().min(1).max(700),
    claimChecks: z.array(ClaimCheckSchema).min(1).max(4),
    oneSentenceAnswer: z.string().min(1).max(500),
    studentExplanation: z.string().min(1).max(2000),
    keyContext: z.array(z.string().min(1).max(500)).max(6),
    whatOfficialSourcesSay: z.array(z.string().min(1).max(700)).max(8),
    contextGaps: z.array(z.string().min(1).max(500)).max(6),
    framingFlags: z.array(z.string().min(1).max(300)).max(6),
    quiz: z.array(QuizQuestionSchema).min(1).max(3),
    refusalReason: z.string().min(1).max(500).optional(),
  })
  .strict() satisfies z.ZodType<AnalysisResultContract>;

export const AnalysisRequestSchema = z.object({
  claim: z.string().trim().min(10).max(2000),
});

export const SearchQuerySchema = z.object({
  q: z.string().trim().min(1).max(200),
});

export const BillRouteParamsSchema = z.object({
  congress: z.coerce.number().int().min(1).max(200),
  type: BillTypeSchema,
  number: z.coerce.number().int().min(1).max(999999),
});

export const DistrictLookupRequestSchema = z
  .object({
    address: z.string().trim().min(5).max(250).optional(),
    latitude: z.number().min(-90).max(90).optional(),
    longitude: z.number().min(-180).max(180).optional(),
  })
  .refine(
    (value) =>
      Boolean(value.address) ||
      (typeof value.latitude === "number" &&
        typeof value.longitude === "number"),
    {
      message: "Address or coordinates are required.",
    },
  );

export const RepresentativeSummarySchema = z.object({
  bioguideId: z.string().min(1).max(20).optional(),
  name: z.string().min(1).max(160).optional(),
  fullName: z.string().min(1).max(160).optional(),
  party: z.string().max(80).optional(),
  state: z.string().max(40).optional(),
  district: z
    .union([z.string().max(20), z.number()])
    .optional()
    .nullable(),
  chamber: z.string().max(80).optional(),
  officialUrl: z.string().url().optional(),
  photoUrl: z.string().url().optional(),
  imageAttribution: z.string().max(240).optional(),
});

export const DistrictLookupResultSchema = z.object({
  status: z.enum(["matched", "demo", "unavailable", "not_found"]),
  matchedAddress: z.string().max(300).optional(),
  stateCode: z.string().length(2).optional(),
  district: z.string().max(4).optional(),
  coordinates: z
    .object({
      latitude: z.number(),
      longitude: z.number(),
    })
    .optional(),
  houseMembers: z
    .array(z.union([z.string().min(1).max(160), RepresentativeSummarySchema]))
    .default([]),
  senators: z
    .array(z.union([z.string().min(1).max(160), RepresentativeSummarySchema]))
    .default([]),
  privacyNote: z.string().min(1).max(300),
});

export const QuizAttemptRequestSchema = z.object({
  quizId: z.string().min(1).max(120),
  questionId: z.string().min(1).max(120),
  selectedAnswer: z.string().min(1).max(180),
  correctAnswer: z.string().min(1).max(180).optional(),
  citationIds: z.array(z.string().min(1).max(80)).max(5).default([]),
});

export type BillType = BillTypeContract;
export type Citation = CitationContract;
export type QuizQuestion = AnalysisQuizQuestionContract;
export type TruthVerdict = TruthVerdictContract;
export type ClaimCheck = ClaimCheckContract;
export type AnalysisResult = AnalysisResultContract;
export type DistrictLookupResult = z.infer<typeof DistrictLookupResultSchema>;
