import { describe, expect, it } from "vitest";
import conceptCards from "@/data/concept-cards.json";
import sourcePacks from "@/data/source-packs.json";
import { CitationSchema } from "@/lib/ai/schemas";
import { buildLessonFlashcards, normalizeLearnCurriculum, normalizeLessonQuiz } from "@/lib/learn-curriculum";

const lessons = normalizeLearnCurriculum(conceptCards);
const sourceIds = new Set(sourcePacks.map((source) => source.id));

describe("learn curriculum model", () => {
  it("rejects corrupt questions instead of inventing an answer or padding choices", () => {
    const base = { question: "Which is the official record?", options: ["Bill text", "Campaign slogan"] };
    for (const answer of [undefined, null, false, "", "invalid", -1, 2, 0.5, Infinity]) {
      expect(normalizeLessonQuiz({ ...base, correctIndex: answer })).toBeNull();
    }
    expect(normalizeLessonQuiz({ ...base, correctAnswer: "Missing option" })).toBeNull();
    expect(normalizeLessonQuiz({ ...base, correctIndex: 8, correctAnswer: "Bill text" })).toBeNull();
    for (const options of [["Only one"], ["Same", " same "], ["", "Valid"], [1, "Valid"], ["A", "B", "C", "D", "E"]]) {
      expect(normalizeLessonQuiz({ ...base, options, correctIndex: 0 })).toBeNull();
    }
    expect(normalizeLessonQuiz({ ...base, question: " ", correctIndex: 0 })).toBeNull();
  });

  it("preserves valid two-to-four-option legacy answers without fabricated distractors", () => {
    const base = { question: "Which record?", choices: ["Bill text", "Slogan", "Comment"] };
    expect(normalizeLessonQuiz({ ...base, answerIndex: "2" })?.correctIndex).toBe(2);
    const answerText = normalizeLessonQuiz({ ...base, correctAnswer: "Bill text" });
    expect(answerText?.correctIndex).toBe(0);
    expect(answerText?.options).toEqual(base.choices);
    expect(normalizeLessonQuiz({ ...base, choices: ["Bill text", "Slogan"], correctIndex: 1 })?.options).toHaveLength(2);
  });

  it("offers four full eight-lesson sections with teaching and application practice", () => {
    expect(lessons).toHaveLength(32);
    expect(lessons.map((lesson) => lesson.orderIndex)).toEqual(Array.from({ length: 32 }, (_, i) => i + 1));
    expect(new Set(lessons.map((lesson) => lesson.slug)).size).toBe(lessons.length);

    for (const lesson of lessons) {
      expect(lesson.sourceIds.length).toBeGreaterThan(0);
      expect(lesson.sourceIds.every((id) => sourceIds.has(id))).toBe(true);
      expect(lesson.flashcards).toHaveLength(3);
      expect(lesson.quizQuestions).toHaveLength(3);
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
        expect(new Set(question.options).size).toBe(4);
        expect(question.correctIndex).toBeGreaterThanOrEqual(0);
        expect(question.correctIndex).toBeLessThan(4);
        expect(question.explanation.length).toBeGreaterThan(30);
        expect(question.feedback.correct).toBeTruthy();
        expect(question.feedback.incorrect).toBeTruthy();
        expect(question.feedback.retry).toBeTruthy();
        expect(question.citationIds.length).toBeGreaterThan(0);
        expect(question.citationIds.every((id) => lesson.sourceIds.includes(id))).toBe(true);
        expect(question.feedback.citationIds.every((id) => lesson.sourceIds.includes(id))).toBe(true);
      }
    }
  });

  it("has unique question and card identities without a predictable answer position", () => {
    const questions = lessons.flatMap((lesson) => lesson.quizQuestions);
    const flashcards = lessons.flatMap((lesson) => lesson.flashcards);
    expect(new Set(questions.map((question) => question.id)).size).toBe(96);
    expect(new Set(questions.map((question) => question.question)).size).toBe(96);
    expect(new Set(flashcards.map((flashcard) => flashcard.id)).size).toBe(96);
    for (const index of [0, 1, 2, 3]) {
      expect(questions.filter((question) => question.correctIndex === index).length).toBeGreaterThan(10);
    }
  });

  it("resolves teaching citations into schema-valid official primary-source links", () => {
    const allowedHosts = new Set([
      "www.archives.gov", "www.congress.gov", "www.house.gov", "clerk.house.gov",
      "www.senate.gov", "www.govinfo.gov", "www.uscourts.gov", "uploads.federalregister.gov",
      "www.foia.gov", "geocoding.geo.census.gov", "www.census.gov", "www.usa.gov",
      "www.justice.gov", "lda.senate.gov", "www.cbo.gov", "www.eia.gov", "www.bls.gov",
      "www.ssa.gov", "www.uscis.gov", "www.irs.gov", "www.fns.usda.gov",
      "www.transportation.gov", "www.epa.gov",
    ]);
    for (const source of sourcePacks) {
      expect(CitationSchema.safeParse(source.citation).success).toBe(true);
      expect(source.citation.id).toBe(source.id);
      expect(source.citation.url).toBe(source.url);
      expect(new URL(source.url).protocol).toBe("https:");
      expect(allowedHosts.has(new URL(source.url).hostname)).toBe(true);
    }
    expect(new Set(sourcePacks.map((source) => source.id)).size).toBe(sourcePacks.length);
  });

  it("keeps the original foundations route and visuals while enriching every lesson", () => {
    expect(lessons.slice(0, 8).map((lesson) => lesson.visual.branch)).toEqual([
      "three-branches", "checks-and-balances", "federal-state-local", "rights", "rights",
      "legislative", "legislative", "legislative",
    ]);
    const senate = lessons.find((lesson) => lesson.slug === "senate-procedure");
    expect(senate?.flashcards).toHaveLength(3);
    expect(senate?.quizQuestions).toHaveLength(3);
    expect(lessons.at(-1)?.slug).toBe("civic-evidence-challenge");
    expect(buildLessonFlashcards(conceptCards[0])).toHaveLength(3);
  });

  it("uses specific primary sources for constitutional amendments, juries, and election procedures", () => {
    expect(lessons.find((lesson) => lesson.slug === "due-process-equal-protection")?.sourceIds)
      .toContain("source-pack-constitutional-amendments");
    expect(lessons.find((lesson) => lesson.slug === "jury-service")?.sourceIds)
      .toContain("source-pack-jury-types");
    expect(lessons.find((lesson) => lesson.slug === "electoral-college")?.sourceIds)
      .toContain("source-pack-electoral-college");
  });

  it("still normalizes legacy published cards and filters unpublished drafts", () => {
    const legacy = {
      slug: "legacy-test", title: "Legacy lesson", body: "A source-backed legacy body.",
      hook: "A short legacy hook.", sourceIds: ["source-pack-constitution"], orderIndex: 1,
      quizJson: { question: "Which record?", options: ["Constitution", "Bill", "Vote", "Rule"], correctIndex: 0 },
    };
    const normalized = normalizeLearnCurriculum([legacy, { ...legacy, slug: "draft", isPublished: false }]);
    expect(normalized).toHaveLength(1);
    expect(normalized[0].flashcards[0]).toMatchObject({
      id: "legacy-test-overview", title: "Key idea", body: "A short legacy hook.",
      citationIds: ["source-pack-constitution"],
    });
    expect(normalized[0].quizQuestions[0].feedback.incorrect).toMatch(/source/i);
  });
});
