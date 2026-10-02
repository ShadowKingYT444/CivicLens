type AnyRecord = Record<string, unknown>;

export type LearnVisual = {
  branch?: string;
  category?: string;
  icon?: string;
  accent?: string;
};

export type LearnFlashcard = {
  id: string;
  title: string;
  body: string;
  visual: LearnVisual;
  citationIds: string[];
};

export type LearnQuizFeedback = {
  correct: string;
  incorrect: string;
  retry?: string;
  citationIds: string[];
};

export type LearnQuizQuestion = {
  id?: string;
  question: string;
  options: string[];
  correctIndex: number;
  explanation: string;
  feedback: LearnQuizFeedback;
  citationIds: string[];
  relatedAction?: string;
};

export type LearnLesson = {
  slug: string;
  title: string;
  hook: string;
  body: string;
  category: string;
  difficulty: 1 | 2 | 3;
  sourceIds: string[];
  visual: LearnVisual;
  flashcards: LearnFlashcard[];
  quizQuestions: LearnQuizQuestion[];
  quizJson: LearnQuizQuestion | null;
  orderIndex: number;
  isPublished: boolean;
};

export type LessonUnit = {
  section: number;
  unit: number;
  unitTitle: string;
};

export type LessonFlashcardView = LearnFlashcard & {
  eyebrow?: string;
  imageKey?: "capitolPlatform" | "capitolPath" | "starCoin" | "checkCoin" | "treasureChest";
  bullets?: string[];
};

export type LessonQuizView = {
  question: string;
  options: string[];
  correctIndex: number;
  explanation?: string;
  feedback: LearnQuizFeedback;
  citationIds: string[];
};

function asRecord(value: unknown): AnyRecord {
  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value) as unknown;
      return parsed && typeof parsed === "object" ? (parsed as AnyRecord) : {};
    } catch {
      return {};
    }
  }
  return value && typeof value === "object" ? (value as AnyRecord) : {};
}

function stringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.map(String).filter(Boolean) : [];
}

function text(value: unknown, fallback = ""): string {
  return typeof value === "string" && value.trim() ? value : fallback;
}

function normalizeVisual(value: unknown, category: string): LearnVisual {
  const record = asRecord(value);
  return {
    branch: text(record.branch, "civic-concept"),
    category: text(record.category, category),
    icon: text(record.icon, "book-open"),
    accent: text(record.accent, "civic-blue"),
  };
}

function normalizeFlashcards(record: AnyRecord, lessonVisual: LearnVisual): LearnFlashcard[] {
  const sourceIds = stringArray(record.sourceIds);
  const fallbackBody = text(record.hook, text(record.body, "Review this source-backed civic idea."));
  const fallback: LearnFlashcard = {
    id: `${String(record.slug)}-overview`,
    title: "Key idea",
    body: fallbackBody,
    visual: lessonVisual,
    citationIds: sourceIds,
  };

  if (!Array.isArray(record.flashcards)) return [fallback];

  const flashcards = record.flashcards
    .map((raw, index): LearnFlashcard | null => {
      const flashcard = asRecord(raw);
      const body = text(flashcard.body, text(flashcard.copy));
      if (!body) return null;

      return {
        id: text(flashcard.id, `${String(record.slug)}-${index + 1}`),
        title: text(flashcard.title, `Card ${index + 1}`),
        body,
        visual: normalizeVisual(flashcard.visual, lessonVisual.category ?? String(record.category)),
        citationIds: stringArray(flashcard.citationIds).length
          ? stringArray(flashcard.citationIds)
          : sourceIds,
      };
    })
    .filter((flashcard): flashcard is LearnFlashcard => Boolean(flashcard));

  return flashcards.length > 0 ? flashcards : [fallback];
}

function normalizeQuizQuestion(value: unknown, sourceIds: string[]): LearnQuizQuestion | null {
  const record = asRecord(value);
  const rawOptions = record.options ?? record.choices;
  const question = text(record.question).trim();
  if (!question || !Array.isArray(rawOptions) || rawOptions.length < 2 || rawOptions.length > 4) return null;
  if (!rawOptions.every((option) => typeof option === "string" && option.trim())) return null;
  const options = rawOptions.map((option: string) => option.trim());
  if (new Set(options.map((option) => option.toLowerCase())).size !== options.length) return null;

  // Do not turn corrupt persisted data into a question with an invented correct answer.
  const explicitAnswer = record.correctIndex !== undefined ? record.correctIndex : record.answerIndex;
  const answerIndex = explicitAnswer !== undefined
    ? typeof explicitAnswer === "number"
      ? explicitAnswer
      : typeof explicitAnswer === "string" && /^\d+$/.test(explicitAnswer)
        ? Number(explicitAnswer)
        : NaN
    : options.findIndex((option) => option === text(record.correctAnswer).trim());
  if (!Number.isInteger(answerIndex) || answerIndex < 0 || answerIndex >= options.length) return null;
  const citationIds = stringArray(record.citationIds).length
    ? stringArray(record.citationIds)
    : sourceIds;
  const feedback = asRecord(record.feedback);
  const feedbackCitationIds = stringArray(feedback.citationIds).length
    ? stringArray(feedback.citationIds)
    : citationIds;

  return {
    id: text(record.id) || undefined,
    question,
    options,
    correctIndex: answerIndex,
    explanation: text(record.explanation, "Use the cited source to check the answer."),
    feedback: {
      correct: text(feedback.correct, text(record.explanation, "Correct. The source supports this.")),
      incorrect: text(
        feedback.incorrect,
        "Review the flashcards and the cited official source before choosing again.",
      ),
      retry: text(feedback.retry) || undefined,
      citationIds: feedbackCitationIds,
    },
    citationIds,
    relatedAction: text(record.relatedAction) || undefined,
  };
}

function normalizeQuizQuestions(record: AnyRecord): LearnQuizQuestion[] {
  const sourceIds = stringArray(record.sourceIds);
  const candidates = Array.isArray(record.quizQuestions)
    ? record.quizQuestions
    : [record.quiz, record.quizJson].filter(Boolean);

  return candidates
    .map((candidate) => normalizeQuizQuestion(candidate, sourceIds))
    .filter((question): question is LearnQuizQuestion => Boolean(question));
}

export function normalizeLearnLesson(rawLesson: unknown): LearnLesson | null {
  const record = asRecord(rawLesson);
  const slug = text(record.slug);
  const title = text(record.title);
  const body = text(record.body);
  if (!slug || !title || !body) return null;

  const category = text(record.category, "Civics");
  const visual = normalizeVisual(record.visual, category);
  const quizQuestions = normalizeQuizQuestions(record);

  return {
    slug,
    title,
    hook: text(record.hook),
    body,
    category,
    difficulty: [1, 2, 3].includes(Number(record.difficulty))
      ? (Number(record.difficulty) as 1 | 2 | 3)
      : 1,
    sourceIds: stringArray(record.sourceIds),
    visual,
    flashcards: normalizeFlashcards(record, visual),
    quizQuestions,
    quizJson: quizQuestions[0] ?? null,
    orderIndex: Number(record.orderIndex ?? 0),
    isPublished: record.isPublished !== false,
  };
}

export function normalizeLearnCurriculum(rawLessons: unknown): LearnLesson[] {
  const lessons = Array.isArray(rawLessons)
    ? rawLessons
    : Object.values(asRecord(rawLessons)).find(Array.isArray) ?? [];

  return lessons
    .map((lesson) => normalizeLearnLesson(lesson))
    .filter((lesson): lesson is LearnLesson => Boolean(lesson && lesson.isPublished))
    .sort((a, b) => a.orderIndex - b.orderIndex || a.title.localeCompare(b.title));
}

function rawFlashcards(value: unknown): AnyRecord[] {
  const record = asRecord(value);
  return Array.isArray(record.flashcards)
    ? record.flashcards.map(asRecord)
    : [];
}

function imageKeyForBranch(branch?: string): LessonFlashcardView["imageKey"] {
  if (!branch) return "capitolPlatform";
  if (branch.includes("legislative")) return "capitolPath";
  if (branch.includes("rights") || branch.includes("checks")) return "starCoin";
  if (branch.includes("federal") || branch.includes("state")) return "treasureChest";
  return "capitolPlatform";
}

export function buildLessonFlashcards(card: unknown): LessonFlashcardView[] {
  const lesson = normalizeLearnLesson(card);
  if (!lesson) return [];

  const originals = rawFlashcards(card);
  return lesson.flashcards.map((flashcard, index) => {
    const original = originals[index] ?? {};
    const imageKey = text(original.imageKey) as LessonFlashcardView["imageKey"] | "";

    return {
      ...flashcard,
      eyebrow: text(original.eyebrow, lesson.category),
      imageKey: imageKey || imageKeyForBranch(flashcard.visual.branch),
      bullets: stringArray(original.bullets),
    };
  });
}

export function normalizeLessonQuiz(rawQuiz: unknown): LessonQuizView | null {
  const quiz = normalizeQuizQuestion(Array.isArray(rawQuiz) ? rawQuiz[0] : rawQuiz, []);
  if (!quiz) return null;

  return {
    question: quiz.question,
    options: quiz.options,
    correctIndex: quiz.correctIndex,
    explanation: quiz.explanation,
    feedback: quiz.feedback,
    citationIds: quiz.citationIds,
  };
}

export function getLessonUnit(cards: Array<{ category?: string; title?: string }>, index: number): LessonUnit {
  const safeIndex = Math.max(0, index);
  const card = cards[safeIndex];
  const section = Math.floor(safeIndex / 8) + 1;

  return {
    section,
    unit: (safeIndex % 8) + 1,
    unitTitle: card?.category || card?.title || "Civic foundations",
  };
}
