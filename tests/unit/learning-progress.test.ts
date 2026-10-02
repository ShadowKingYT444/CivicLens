import { describe, expect, it } from "vitest";
import {
  emptyLearningProgress,
  finishLearningLesson,
  learningStreak,
  markLessonForReview,
  nextLearningIndex,
  parseLearningProgress,
} from "@/lib/learning-progress";

describe("learning progress", () => {
  it("starts with no invented completions and unlocks lessons sequentially", () => {
    let progress = emptyLearningProgress();
    expect(nextLearningIndex(["one", "two", "three"], progress)).toBe(0);
    progress = finishLearningLesson(progress, "one", "2026-09-29", true);
    expect(nextLearningIndex(["one", "two", "three"], progress)).toBe(1);
    progress = finishLearningLesson(progress, "three", "2026-09-29", true);
    expect(nextLearningIndex(["one", "two", "three"], progress)).toBe(1);
  });
  it("awards a completion once and retains missed concepts until a clean replay", () => {
    let progress = markLessonForReview(emptyLearningProgress(), "one");
    progress = finishLearningLesson(progress, "one", "2026-09-29", false);
    expect(progress.reviewSlugs).toEqual(["one"]);
    progress = finishLearningLesson(progress, "one", "2026-09-30", true);
    expect(progress.completed).toEqual({ one: "2026-09-29" });
    expect(progress.reviewSlugs).toEqual([]);
    expect(progress.activityDays).toEqual(["2026-09-29", "2026-09-30"]);
  });
  it("counts consecutive civil days including yesterday before today's practice", () => {
    let progress = finishLearningLesson(
      emptyLearningProgress(),
      "one",
      "2026-09-28",
      true,
    );
    progress = finishLearningLesson(progress, "two", "2026-09-29", true);
    expect(learningStreak(progress, "2026-09-30")).toBe(2);
    expect(learningStreak(progress, "2026-10-01")).toBe(0);
    expect(learningStreak(emptyLearningProgress(), "2026-09-30")).toBe(0);
  });
  it("recovers safely from corrupt storage and rejects invalid dates", () => {
    expect(parseLearningProgress("broken")).toEqual(emptyLearningProgress());
    expect(parseLearningProgress('{"version":2}')).toEqual(
      emptyLearningProgress(),
    );
    const progress = parseLearningProgress(
      JSON.stringify({
        version: 1,
        completed: { one: "2026-02-30", two: "2026-09-29" },
        activityDays: ["2026-02-30", "2026-09-29", "2026-09-29"],
        reviewSlugs: [null, "two", "two"],
      }),
    );
    expect(progress.completed).toEqual({ two: "2026-09-29" });
    expect(progress.activityDays).toEqual(["2026-09-29"]);
    expect(progress.reviewSlugs).toEqual(["two"]);
    expect(parseLearningProgress(JSON.stringify(progress))).toEqual(progress);
  });
});
