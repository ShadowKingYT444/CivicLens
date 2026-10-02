export const LEARNING_PROGRESS_KEY = "civiclens.learning.v1";
export const LEARNING_PROGRESS_EVENT = "civiclens-learning-progress";
export const LESSON_XP = 25;

export type LearningProgress = { completedSlugs: string[]; xp: number };

function normalizeProgress(value: unknown): LearningProgress {
  const record =
    value && typeof value === "object"
      ? (value as Record<string, unknown>)
      : {};
  const completedSlugs = Array.isArray(record.completedSlugs)
    ? [
        ...new Set(
          record.completedSlugs.filter(
            (slug): slug is string =>
              typeof slug === "string" && slug.length > 0 && slug.length <= 200,
          ),
        ),
      ]
    : [];
  // XP comes from completed lessons, never an untrusted stored total.
  return { completedSlugs, xp: completedSlugs.length * LESSON_XP };
}

export function readLearningProgress(): LearningProgress {
  if (typeof window === "undefined") return { completedSlugs: [], xp: 0 };
  try {
    const stored = window.localStorage.getItem(LEARNING_PROGRESS_KEY);
    return normalizeProgress(stored ? JSON.parse(stored) : null);
  } catch {
    return { completedSlugs: [], xp: 0 };
  }
}

export function completeLearningLesson(
  slug: string,
  current = readLearningProgress(),
) {
  const previous = normalizeProgress(current);
  const progress = normalizeProgress({
    completedSlugs: [...previous.completedSlugs, slug],
  });
  const awarded = progress.xp > previous.xp;
  let persisted = false;
  if (typeof window !== "undefined") {
    try {
      window.localStorage.setItem(
        LEARNING_PROGRESS_KEY,
        JSON.stringify(progress),
      );
      persisted = true;
    } catch {
      // The reader keeps session progress and exposes the failed save.
    }
    window.dispatchEvent(
      new CustomEvent(LEARNING_PROGRESS_EVENT, { detail: progress }),
    );
  }
  return { progress, awarded, persisted };
}
