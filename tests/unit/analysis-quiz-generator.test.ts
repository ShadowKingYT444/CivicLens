import { describe, expect, it } from "vitest";
import { generateQuiz } from "@/lib/civic/quiz-generator";
import { DEMO_BILL } from "@/lib/civic/source-grounder";

describe("source-dependent analysis quizzes", () => {
  it("asks about the actual repeal and law-status distinction for the historic bill", () => {
    const quiz = generateQuiz(DEMO_BILL.citations);
    expect(quiz).toHaveLength(3);
    expect(quiz[0].correctAnswer).toMatch(/government pension offset.*windfall elimination/);
    expect(quiz[0].citationIds).toContain("hr82-govinfo-law");
    expect(quiz[1].correctAnswer).toBe("It became law");
    expect(quiz[1].choices).toContain("It guarantees a particular benefit for every person");
    expect(quiz[2].correctAnswer).toMatch(/Congress.*bill type.*bill number/);
  });

  it("teaches evidence gaps without inventing legislation when no sources exist", () => {
    const quiz = generateQuiz([]);
    expect(quiz.some((question) => /do not settle/.test(question.question))).toBe(true);
    expect(quiz.every((question) => question.citationIds.length === 0)).toBe(true);
    expect(JSON.stringify(quiz)).not.toMatch(/repeal|became law/);
  });
});
