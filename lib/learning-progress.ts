export const LEARNING_PROGRESS_KEY = "civiclens.learning.v1";
export const LESSON_XP = 25;

export type LearningProgress = {
  version: 1;
  completed: Record<string, string>;
  reviewSlugs: string[];
  activityDays: string[];
};

export function emptyLearningProgress(): LearningProgress {
  return { version: 1, completed: {}, reviewSlugs: [], activityDays: [] };
}

/** Civil dates use the student's device timezone; UTC arithmetic avoids DST gaps. */
export function localLearningDay(date = new Date()): string {
  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, "0"),
    String(date.getDate()).padStart(2, "0"),
  ].join("-");
}

function validDay(value: unknown): value is string {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value))
    return false;
  const parsed = new Date(`${value}T00:00:00Z`);
  return (
    !Number.isNaN(parsed.getTime()) &&
    parsed.toISOString().slice(0, 10) === value
  );
}

export function parseLearningProgress(raw: string | null): LearningProgress {
  if (!raw) return emptyLearningProgress();
  try {
    const parsed: unknown = JSON.parse(raw);
    if (
      !parsed ||
      typeof parsed !== "object" ||
      !("version" in parsed) ||
      parsed.version !== 1
    )
      return emptyLearningProgress();
    const value = parsed as Record<string, unknown>;
    const completed: Record<string, string> = {};
    if (
      value.completed &&
      typeof value.completed === "object" &&
      !Array.isArray(value.completed)
    ) {
      for (const [slug, day] of Object.entries(value.completed).slice(0, 200)) {
        if (/^[a-z0-9-]{1,120}$/.test(slug) && validDay(day))
          completed[slug] = day;
      }
    }
    return {
      version: 1,
      completed,
      reviewSlugs: Array.isArray(value.reviewSlugs)
        ? [
            ...new Set(
              value.reviewSlugs.filter(
                (slug): slug is string =>
                  typeof slug === "string" && /^[a-z0-9-]{1,120}$/.test(slug),
              ),
            ),
          ].slice(0, 200)
        : [],
      activityDays: Array.isArray(value.activityDays)
        ? [...new Set(value.activityDays.filter(validDay))].sort().slice(-400)
        : [],
    };
  } catch {
    return emptyLearningProgress();
  }
}

export function markLessonForReview(
  progress: LearningProgress,
  slug: string,
): LearningProgress {
  return {
    ...progress,
    reviewSlugs: [...new Set([...progress.reviewSlugs, slug])],
  };
}

export function finishLearningLesson(
  progress: LearningProgress,
  slug: string,
  day: string,
  cleanPass: boolean,
): LearningProgress {
  return {
    ...progress,
    completed: {
      ...progress.completed,
      [slug]: progress.completed[slug] ?? day,
    },
    activityDays: [...new Set([...progress.activityDays, day])]
      .sort()
      .slice(-400),
    reviewSlugs: cleanPass
      ? progress.reviewSlugs.filter((item) => item !== slug)
      : progress.reviewSlugs,
  };
}

export function nextLearningIndex(
  slugs: string[],
  progress: LearningProgress,
): number {
  const index = slugs.findIndex((slug) => !progress.completed[slug]);
  return index < 0 ? Math.max(0, slugs.length - 1) : index;
}

export function learningStreak(
  progress: LearningProgress,
  today = localLearningDay(),
): number {
  const days = new Set(progress.activityDays);
  let cursor = new Date(`${today}T00:00:00Z`);
  if (!days.has(today)) cursor = new Date(cursor.getTime() - 86_400_000);
  let streak = 0;
  while (days.has(cursor.toISOString().slice(0, 10))) {
    streak += 1;
    cursor = new Date(cursor.getTime() - 86_400_000);
  }
  return streak;
}
