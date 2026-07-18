import { describe, expect, it } from "vitest";
import conceptCards from "@/data/concept-cards.json";
import { normalizeLearnCurriculum } from "@/lib/learn-curriculum";

const lessons = normalizeLearnCurriculum(conceptCards);

describe("learn curriculum model", () => {
  it("keeps every published concept usable as flashcards followed by quiz questions", () => {
    expect(lessons).toHaveLength(24);

    for (const lesson of lessons) {
      expect(lesson.sourceIds.length).toBeGreaterThan(0);
      expect(lesson.flashcards.length).toBeGreaterThanOrEqual(1);
      expect(lesson.quizQuestions.length).toBeGreaterThanOrEqual(1);
      expect(lesson.quizJson).toBe(lesson.quizQuestions[0]);

      for (const flashcard of lesson.flashcards) {
        expect(flashcard.body.length).toBeLessThanOrEqual(180);
        expect(flashcard.visual.branch).toBeTruthy();
        expect(flashcard.visual.category).toBeTruthy();
        expect(flashcard.citationIds.length).toBeGreaterThan(0);
        expect(flashcard.citationIds.every((id) => lesson.sourceIds.includes(id))).toBe(true);
      }

      for (const question of lesson.quizQuestions) {
        expect(question.options).toHaveLength(4);
        expect(question.correctIndex).toBeGreaterThanOrEqual(0);
        expect(question.correctIndex).toBeLessThan(4);
        expect(question.feedback.correct).toBeTruthy();
        expect(question.feedback.incorrect).toBeTruthy();
        expect(question.feedback.citationIds.every((id) => lesson.sourceIds.includes(id))).toBe(true);
      }
    }
  });

  it("proves the enriched flashcard and quiz-question model across the first several lessons", () => {
    const enrichedLessons = lessons.filter((lesson) => lesson.orderIndex <= 8);

    expect(enrichedLessons).toHaveLength(8);
    expect(enrichedLessons.every((lesson) => lesson.flashcards.length >= 2)).toBe(true);
    expect(enrichedLessons.every((lesson) => lesson.quizQuestions.length >= 2)).toBe(true);
    expect(enrichedLessons.map((lesson) => lesson.visual.branch)).toEqual([
      "three-branches",
      "checks-and-balances",
      "federal-state-local",
      "rights",
      "rights",
      "legislative",
      "legislative",
      "legislative",
    ]);
  });

  it("normalizes legacy concepts into a single source-grounded overview flashcard", () => {
    const legacyLesson = lessons.find((lesson) => lesson.slug === "senate-procedure");

    expect(legacyLesson?.flashcards).toHaveLength(1);
    expect(legacyLesson?.flashcards[0]).toMatchObject({
      id: "senate-procedure-overview",
      title: "Key idea",
      citationIds: ["source-pack-senate-rules-cloture", "source-pack-senate-votes"],
    });
    expect(legacyLesson?.quizQuestions[0]?.feedback.incorrect).toMatch(/source/i);
  });
});
