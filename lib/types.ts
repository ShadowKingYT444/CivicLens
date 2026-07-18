export type BillType =
  "hr" | "s" | "hjres" | "sjres" | "hconres" | "sconres" | "hres" | "sres";

export type AnalysisStatus =
  | "answered"
  | "refused"
  | "insufficient_sources"
  | "not_enough_info"
  | "needs_clarification";

export type EvidenceStatus =
  | "grounded"
  | "partial"
  | "insufficient"
  | "not_enough_info"
  | "not_applicable";

export type TruthVerdict =
  "true" | "mostly_true" | "mixed" | "mostly_false" | "false" | "unverifiable";

export type SourceType =
  | "bill"
  | "vote"
  | "congress"
  | "govinfo"
  | "census"
  | "house"
  | "senate"
  | "constitution"
  | "courts"
  | "federal-register"
  | "records"
  | "elections"
  | "state-local"
  | "civil-rights"
  | "lobbying"
  | "concept-card"
  | "fixture"
  | "other";

export type ClaimType =
  | "BILL_REFERENCE"
  | "REPRESENTATIVE_ACTION"
  | "CIVIC_CONCEPT"
  | "POLICY_CLAIM"
  | "ELECTION_PROCESS"
  | "OUT_OF_SCOPE";

export type Chamber = "HOUSE" | "SENATE" | "JOINT" | "UNKNOWN";

export interface ParsedBillRef {
  raw: string;
  congress?: number;
  type: BillType;
  number: number;
}

export interface QuizQuestion {
  id?: string;
  question: string;
  options?: [string, string, string, string];
  choices?: string[];
  correctIndex?: number;
  correctAnswer?: string;
  explanation: string;
  citationIds?: string[];
}

export interface AnalysisQuizQuestion {
  id: string;
  question: string;
  choices: string[];
  correctAnswer: string;
  explanation: string;
  citationIds: string[];
}

export interface FramingFlag {
  type:
    | "LOADED_LANGUAGE"
    | "VAGUE_QUANTIFIER"
    | "CAUSAL_LEAP"
    | "MISSING_BASELINE"
    | "OPINION_AS_FACT"
    | "MOTIVE_CLAIM"
    | "UNSUPPORTED_STATISTIC";
  label: string;
  excerpt: string;
  explanation: string;
  neutralRewrite: string;
}

export interface Citation {
  id: string;
  sourceDocumentId: string;
  sourceType: SourceType;
  title: string;
  url: string;
  sourceDate?: string;
  excerpt: string;
  bill?: {
    congress?: number;
    type?: BillType;
    number?: number;
  };
}

export interface SourcePoint {
  text: string;
  citationIds: string[];
}

export interface ClaimCheck {
  claim: string;
  verdict: TruthVerdict;
  explanation: string;
  citationIds: string[];
}

export interface AnalysisResult {
  status: AnalysisStatus;
  evidenceStatus: EvidenceStatus;
  truthVerdict: TruthVerdict;
  verdictSummary: string;
  claimChecks: ClaimCheck[];
  normalizedClaim: string;
  oneSentenceAnswer: string;
  studentExplanation: string;
  keyContext: string[];
  whatOfficialSourcesSay: string[];
  contextGaps: string[];
  framingFlags: string[];
  quiz: AnalysisQuizQuestion[];
  refusalReason?: string;
}

export interface AnalyzeResponse {
  result: AnalysisResult;
  analysis: AnalysisResult;
  citations: Citation[];
  relatedBills: RelatedBillRef[];
  mode: "live" | "demo";
  sourceMode: "live" | "demo";
  warnings: string[];
  storage: {
    stored: boolean;
    reason?: string;
  };
}

export interface RelatedBillRef {
  congress?: number;
  type?: BillType;
  number?: number;
}

export interface AnalyzeClaimResult {
  result: AnalysisResult;
  citations: Citation[];
  relatedBills: RelatedBillRef[];
  mode: "live" | "demo";
  sourceMode: "live" | "demo";
  warnings: string[];
}

export interface ClaimClassification {
  type: ClaimType;
  billRefs: ParsedBillRef[];
  entities: string[];
  civicConcepts: string[];
  reason: string;
  allowed: boolean;
}

export interface BillSummaryView {
  congress: number;
  type: BillType | string;
  number: string;
  title: string;
  policyArea?: string;
  latestActionText?: string;
  latestActionDate?: string;
  url?: string;
}

export interface BillActionView {
  actionDate?: string;
  actionTime?: string;
  text: string;
  type?: string;
  sourceUrl?: string;
}

export interface BillSponsorView {
  bioguideId?: string;
  fullName: string;
  party?: string;
  state?: string;
  district?: number | null;
  role: "SPONSOR" | "COSPONSOR";
  date?: string;
}

export interface RollCallVoteView {
  congress: number;
  session?: number;
  chamber: Chamber;
  rollCallNumber: number;
  question?: string;
  description?: string;
  result?: string;
  date?: string;
  apiUrl?: string;
}

export interface BillDetailView extends BillSummaryView {
  originChamber?: string;
  introducedDate?: string;
  updateDate?: string;
  apiUrl?: string;
  congressUrl?: string;
  summary?: string;
  summaries: Array<{
    actionDesc?: string;
    text: string;
    updateDate?: string;
    sourceUrl?: string;
  }>;
  actions: BillActionView[];
  sponsors: BillSponsorView[];
  subjects: Array<{ name: string; type?: string }>;
  rollCalls: RollCallVoteView[];
  citations: Citation[];
}

export interface FeedCardData {
  slug: string;
  title: string;
  hook: string;
  body: string;
  category: string;
  difficulty: 1 | 2 | 3;
  sourceIds: string[];
  quiz: QuizQuestion;
  orderIndex: number;
  isPublished: boolean;
}

export interface Representative {
  bioguideId?: string;
  fullName: string;
  firstName?: string;
  lastName?: string;
  party?: string;
  state?: string;
  district?: number | null;
  chamber: Chamber;
  currentMember?: boolean;
  officialUrl?: string;
  depictionUrl?: string;
}

export interface DistrictLookupResult {
  status: "FOUND" | "NO_MATCH" | "MULTIPLE_MATCHES" | "ERROR";
  matchedAddress?: string;
  stateCode?: string;
  district?: number;
  coordinates?: {
    x: number;
    y: number;
  };
  houseMembers: Representative[];
  senators: Representative[];
  privacyNote: string;
  message?: string;
}

export interface SearchResult {
  type: "bill" | "card" | "source";
  title: string;
  href: string;
  excerpt: string;
  badge?: string;
}

export interface HealthResponse {
  ok: boolean;
  mode: "live" | "demo";
  db: "connected" | "unavailable" | "not_configured";
  congressApiConfigured: boolean;
  llmConfigured: boolean;
  embeddingsConfigured: boolean;
  timestamp: string;
}

export interface CongressUnavailable {
  ok: false;
  reason: string;
  status?: number;
}

export type CongressResult<T> = { ok: true; data: T } | CongressUnavailable;
