import { createHash } from "crypto";
import type { Citation, QuizQuestion } from "../ai/schemas";

export function generateQuiz(
  citations: Citation[],
  seed = "civic-literacy",
): QuizQuestion[] {
  const primary = citations[0];
  const sourceLabel = primary?.title || "the official source";
  const citationIds = primary ? [primary.id] : [];

  return [
    {
      id: `quiz-${stableQuizKey(primary, seed)}-source`,
      question: "What should you check first before accepting a civic claim?",
      choices: [
        "Whether an official source supports the claim",
        "Whether the claim is popular on social media",
        "Whether the claim uses strong emotional language",
        "Whether the claim names a political party",
      ],
      correctAnswer: "Whether an official source supports the claim",
      explanation: primary
        ? `The safest first step is to compare the claim with ${sourceLabel}.`
        : "The safest first step is to look for official source material before drawing a conclusion.",
      citationIds,
    },
  ];
}

function stableQuizKey(primary: Citation | undefined, seed: string): string {
  const identity = primary?.id ?? seed;
  return createHash("sha256").update(identity).digest("hex").slice(0, 16);
}
