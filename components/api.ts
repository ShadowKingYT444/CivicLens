import type {
  AnalyzeResponse,
  BillDetail,
  Citation,
  FeedCard,
  HealthStatus,
  LessonFlashcard,
  QuizQuestion,
  SearchResult,
} from "./types";

export const demoCitations: Citation[] = [
  {
    id: "congress-about-bills",
    sourceType: "official",
    title: "Congress.gov: About Bills",
    url: "https://www.congress.gov/help/learn-about-the-legislative-process/bills",
    excerpt:
      "Official records distinguish bill text, actions, sponsors, summaries, and related votes.",
  },
  {
    id: "census-geocoder",
    sourceType: "official",
    title: "U.S. Census Geocoder",
    url: "https://geocoding.geo.census.gov/",
    excerpt:
      "District lookup should happen server-side so raw addresses are not exposed to model providers.",
  },
];

export const demoFeedCards: FeedCard[] = [
  {
    slug: "how-a-bill-moves",
    title: "How a bill moves without becoming a prediction",
    hook: "Follow actions and votes before drawing conclusions.",
    body:
      "A bill can be introduced, referred, amended, reported, passed by one chamber, reconciled, and signed. CivicLens treats each action as evidence, not as advice about what anyone should support.",
    category: "Congress",
    difficulty: 1,
    citations: [demoCitations[0]],
    quiz: {
      question: "Which item is strongest evidence for a bill's current status?",
      options: ["A campaign mailer", "The bill's official action history", "A social post"],
      correctIndex: 1,
      explanation: "Official action history is the source CivicLens should cite for status claims.",
    },
  },
  {
    slug: "spotting-framing",
    title: "Spot framing before you decide what a claim says",
    hook: "Loaded wording can change how a neutral fact feels.",
    body:
      "CivicLens flags emotionally loaded phrasing, missing comparisons, and uncertain source grounding so students can separate rhetoric from checkable claims.",
    category: "Media literacy",
    difficulty: 2,
    citations: [demoCitations[0]],
    quiz: {
      question: "What should a framing flag do?",
      options: ["Tell you how to vote", "Name rhetoric that may affect interpretation", "Hide the source"],
      correctIndex: 1,
      explanation: "The flag explains wording risk without making a political recommendation.",
    },
  },
  {
    slug: "district-privacy",
    title: "Why address privacy matters for civic tools",
    hook: "A district lookup needs an address, but an AI explanation does not.",
    body:
      "CivicLens sends addresses only to the server lookup flow and keeps them out of LLM prompts, logs, and durable storage.",
    category: "Privacy",
    difficulty: 1,
    citations: [demoCitations[1]],
    quiz: {
      question: "Where should raw address text go?",
      options: ["Only to the server-side district lookup", "Into the LLM prompt", "Into analytics logs"],
      correctIndex: 0,
      explanation: "The contract requires raw addresses to stay out of model prompts and logs.",
    },
  },
];

export async function getJson<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, {
    ...init,
    headers: {
      Accept: "application/json",
      ...(init?.headers ?? {}),
    },
  });

  const text = await response.text();
  const payload = text ? (JSON.parse(text) as T) : ({} as T);

  if (!response.ok) {
    const message =
      typeof payload === "object" && payload && "error" in payload
        ? String((payload as { error?: unknown }).error)
        : `Request failed with ${response.status}`;
    throw new Error(message);
  }

  return payload;
}

function normalizeFeedCards(rawCards: unknown[]): FeedCard[] {
  return rawCards
    .map((rawCard) => normalizeFeedCard(rawCard))
    .filter((card): card is FeedCard => Boolean(card));
}

function normalizeFeedCard(rawCard: unknown): FeedCard | null {
  if (!rawCard || typeof rawCard !== "object") return null;

  const card = rawCard as FeedCard;
  if (!card.slug || !card.title) return null;

  const sourceIds = Array.isArray(card.sourceIds) ? card.sourceIds.map(String) : [];
  const visual = card.visual ?? { category: card.category };
  const fallbackFlashcard: LessonFlashcard = {
    id: `${card.slug}-overview`,
    title: card.hook ? "Key idea" : card.title,
    body: card.hook || card.body,
    visual,
    citationIds: sourceIds,
  };
  const flashcards =
    Array.isArray(card.flashcards) && card.flashcards.length > 0
      ? card.flashcards
      : [fallbackFlashcard];
  const quizQuestions =
    Array.isArray(card.quizQuestions) && card.quizQuestions.length > 0
      ? card.quizQuestions
      : [normalizeQuiz(card.quiz ?? card.quizJson)].filter(
          (quiz): quiz is QuizQuestion => Boolean(quiz),
        );

  return {
    ...card,
    sourceIds,
    visual,
    flashcards,
    quizQuestions,
    quiz: card.quiz ?? quizQuestions[0] ?? null,
  };
}

export function normalizeFeedResponse(payload: unknown): FeedCard[] {
  if (Array.isArray(payload)) {
    const normalized = normalizeFeedCards(payload);
    return normalized.length > 0 ? normalized : normalizeFeedCards(demoFeedCards);
  }

  if (payload && typeof payload === "object") {
    const record = payload as Record<string, unknown>;
    const candidates = [record.cards, record.data, record.feed, record.items];
    const firstArray = candidates.find(Array.isArray);
    if (firstArray) {
      const normalized = normalizeFeedCards(firstArray);
      if (normalized.length > 0) return normalized;
    }
  }

  return normalizeFeedCards(demoFeedCards);
}

export function normalizeQuiz(
  raw: FeedCard["quiz"] | FeedCard["quizJson"] | FeedCard["quizQuestions"],
): QuizQuestion | null {
  if (!raw) return null;
  if (Array.isArray(raw)) return normalizeQuiz(raw[0]);
  if (typeof raw === "string") {
    try {
      return normalizeQuiz(JSON.parse(raw) as QuizQuestion);
    } catch {
      return null;
    }
  }

  return {
    ...raw,
    feedback: raw.feedback ?? {
      correct: raw.explanation,
      incorrect: "Check the source-backed lesson cards and try again.",
      citationIds: raw.citationIds,
    },
  };
}

export function normalizeAnalyzeResponse(payload: AnalyzeResponse): AnalyzeResponse {
  return {
    ...payload,
    result: payload.result ?? payload.analysis,
    citations: payload.citations ?? [],
    relatedBills: payload.relatedBills ?? [],
  };
}

export function normalizeSearchResponse(payload: unknown): SearchResult[] {
  if (Array.isArray(payload)) return payload as SearchResult[];
  if (payload && typeof payload === "object") {
    const record = payload as Record<string, unknown>;
    const candidates = [record.data, record.results, record.items];
    const firstArray = candidates.find(Array.isArray);
    if (firstArray) return firstArray as SearchResult[];
  }

  return [];
}

export function normalizeBillResponse(payload: unknown): BillDetail {
  if (payload && typeof payload === "object") {
    const record = payload as Record<string, unknown>;
    if (record.bill && typeof record.bill === "object") {
      return record.bill as BillDetail;
    }
    if (record.data && typeof record.data === "object") {
      return record.data as BillDetail;
    }
    return record as BillDetail;
  }

  return {};
}

export function healthLabel(status: HealthStatus | null): string {
  if (!status) return "Checking local demo services";
  if (!status.ok) return "Local services need attention";
  return status.mode === "demo" ? "Demo mode active" : "Live providers available";
}

export function billHref(bill: { congress?: string | number; type?: string; number?: string | number }) {
  if (!bill.congress || !bill.type || !bill.number) return "/bills";
  return `/bills/${bill.congress}/${String(bill.type).toLowerCase()}/${bill.number}`;
}
