import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  completeLearningLesson,
  LEARNING_PROGRESS_EVENT,
  LEARNING_PROGRESS_KEY,
  readLearningProgress,
} from "@/lib/client-learning-progress";

describe("device learning progress", () => {
  beforeEach(() => window.localStorage.clear());

  it("starts a new learner with zero earned progress", () => {
    expect(readLearningProgress()).toEqual({ completedSlugs: [], xp: 0 });
  });

  it("persists a completion, emits an update, and never rewards repeated completion", () => {
    const listener = vi.fn();
    window.addEventListener(LEARNING_PROGRESS_EVENT, listener);
    const first = completeLearningLesson("three-branches");
    expect(first).toMatchObject({
      awarded: true,
      persisted: true,
      progress: { completedSlugs: ["three-branches"], xp: 25 },
    });
    expect(readLearningProgress()).toEqual(first.progress);
    expect(completeLearningLesson("three-branches")).toMatchObject({
      awarded: false,
      progress: { xp: 25 },
    });
    expect(completeLearningLesson("checks-and-balances").progress.xp).toBe(50);
    expect(listener).toHaveBeenCalledTimes(3);
    window.removeEventListener(LEARNING_PROGRESS_EVENT, listener);
  });

  it("recovers from corrupt data and derives XP only from unique valid lesson slugs", () => {
    window.localStorage.setItem(LEARNING_PROGRESS_KEY, "invalid json");
    expect(readLearningProgress().xp).toBe(0);
    window.localStorage.setItem(
      LEARNING_PROGRESS_KEY,
      JSON.stringify({
        completedSlugs: ["one", "one", null, 5, "", "two"],
        xp: 99999,
      }),
    );
    expect(readLearningProgress()).toEqual({
      completedSlugs: ["one", "two"],
      xp: 50,
    });
  });

  it("retains session progress and reports a blocked storage save", () => {
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new DOMException("Storage denied", "SecurityError");
    });
    const result = completeLearningLesson("one", { completedSlugs: [], xp: 0 });
    expect(result).toMatchObject({
      awarded: true,
      persisted: false,
      progress: { xp: 25 },
    });
    expect(completeLearningLesson("one", result.progress).awarded).toBe(false);
  });
});
