import type {
  AnalyzeResponse as CoreAnalyzeResponse,
  AnalysisResult as CoreAnalysisResult,
  Citation as CoreCitation,
  ClaimCheck as CoreClaimCheck,
  TruthVerdict as CoreTruthVerdict,
} from "../lib/types";

export type Citation = Partial<Omit<CoreCitation, "bill" | "sourceType">> & {
  sourceType?: string;
  bill?: {
    congress?: number | string;
    type?: string;
    number?: string | number;
  };
};

export type QuizQuestion = {
  id?: string;
  question: string;
  options?: string[];
  choices?: string[];
  answerIndex?: number;
  correctIndex?: number;
  correctAnswer?: string;
  explanation?: string;
  feedback?: {
    correct?: string;
    incorrect?: string;
    retry?: string;
    citationIds?: string[];
  };
  citationIds?: string[];
  relatedAction?: string;
};

export type LessonVisual = {
  branch?: string;
  category?: string;
  icon?: string;
  accent?: string;
};

export type LessonFlashcard = {
  id?: string;
  eyebrow?: string;
  title: string;
  body: string;
  visual?: LessonVisual;
  citationIds?: string[];
  imageKey?: string;
  bullets?: string[];
};

export type FeedCard = {
  slug: string;
  title: string;
  hook?: string;
  body: string;
  category?: string;
  difficulty?: number;
  sourceIds?: string[];
  citations?: Citation[];
  visual?: LessonVisual;
  flashcards?: LessonFlashcard[];
  quizQuestions?: QuizQuestion[];
  quizJson?: QuizQuestion | string | null;
  quiz?: QuizQuestion | null;
  orderIndex?: number;
  isPublished?: boolean;
};

export type FramingFlag =
  | string
  | {
      label?: string;
      name?: string;
      type?: string;
      severity?: "low" | "medium" | "high" | string;
      explanation?: string;
      evidence?: string;
    };

export type TruthVerdict = CoreTruthVerdict;
export type ClaimCheck = CoreClaimCheck;
export type AnalysisResult = CoreAnalysisResult;

export type AnalyzeResponse = Omit<
  Partial<CoreAnalyzeResponse>,
  "result" | "analysis" | "citations"
> & {
  result?: CoreAnalysisResult;
  analysis?: CoreAnalysisResult;
  citations?: Citation[];
  error?: string;
};

export type SearchResult = {
  title?: string;
  label?: string;
  url?: string;
  href?: string;
  type?: string;
  snippet?: string;
  bill?: BillSummary;
};

export type BillSummary = {
  congress?: number | string;
  type?: string;
  number?: number | string;
  title?: string;
  shortTitle?: string;
  latestAction?: string;
  url?: string;
};

export type BillAction = {
  date?: string;
  actionDate?: string;
  text?: string;
  description?: string;
  actionCode?: string;
};

export type BillDetail = BillSummary & {
  mode?: "live" | "demo";
  summary?: string;
  actions?: BillAction[];
  sponsors?: Array<
    | string
    | { fullName?: string; name?: string; party?: string; state?: string }
  >;
  subjects?: string[];
  votes?: Array<{
    chamber?: string;
    date?: string;
    result?: string;
    question?: string;
  }>;
  citations?: Citation[];
  simpleTitle?: string;
  oneLineSummary?: string;
  inSimpleWords?: string;
  whatChanges?: string;
  whoIsAffected?: string;
  currentStatus?: string;
  stage?:
    | "introduced"
    | "committee"
    | "house"
    | "senate"
    | "president"
    | "law"
    | string;
};

export type DistrictLookupResult = {
  status?: string;
  source?: "live" | "fixture" | "unavailable";
  memberSource?: "live" | "fixture" | "unavailable";
  sourceDate?: string;
  message?: string;
  congress?: number;
  matchedAddress?: string;
  stateCode?: string;
  district?: string | number;
  coordinates?: { lat?: number; lng?: number; x?: number; y?: number };
  houseMembers?: Array<
    | string
    | {
        bioguideId?: string;
        name?: string;
        fullName?: string;
        party?: string;
        state?: string;
        district?: string | number | null;
        chamber?: string;
        officialUrl?: string;
        photoUrl?: string;
        imageAttribution?: string;
      }
  >;
  senators?: Array<
    | string
    | {
        bioguideId?: string;
        name?: string;
        fullName?: string;
        party?: string;
        state?: string;
        district?: string | number | null;
        chamber?: string;
        officialUrl?: string;
        photoUrl?: string;
        imageAttribution?: string;
      }
  >;
  privacyNote?: string;
  error?: string;
};

export type HealthStatus = {
  ok?: boolean;
  mode?: string;
  db?: string;
  congressApiConfigured?: boolean;
  llmConfigured?: boolean;
  embeddingsConfigured?: boolean;
  timestamp?: string;
};
