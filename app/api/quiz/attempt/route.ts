import { randomUUID } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import conceptCards from "../../../../data/concept-cards.json";
import { QuizAttemptRequestSchema } from "../../../../lib/ai/schemas";
import { getPrisma } from "../../../../lib/db/prisma";
import { normalizeLearnCurriculum } from "../../../../lib/learn-curriculum";

const curriculum = normalizeLearnCurriculum(conceptCards);

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  const parsed = QuizAttemptRequestSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid quiz attempt", issues: parsed.error.flatten().fieldErrors },
      { status: 400 },
    );
  }

  const attempt = parsed.data;
  const lesson = curriculum.find((candidate) => candidate.slug === attempt.quizId);
  const question = lesson?.quizQuestions.find((candidate) => candidate.id === attempt.questionId);
  if (!question) {
    // Generated questions exist only in the current browser session. A supplied
    // answer key can provide practice feedback, but cannot certify a saved score.
    return NextResponse.json({
      correct: Boolean(attempt.correctAnswer && normalizeAnswer(attempt.selectedAnswer) === normalizeAnswer(attempt.correctAnswer)),
      recorded: false,
      mode: "demo",
      gradingSource: "client_practice",
      reason: "This session question has no server-verified answer key; no verified attempt was saved.",
    });
  }

  const selectedIndex = question.options.findIndex((option) => normalizeAnswer(option) === normalizeAnswer(attempt.selectedAnswer));
  if (selectedIndex < 0) {
    return NextResponse.json({ error: "Selected answer is not an option for this question" }, { status: 400 });
  }
  const correct = selectedIndex === question.correctIndex;
  const recorded = await recordAttempt(attempt.quizId, attempt.questionId, selectedIndex, question.correctIndex, correct);
  return NextResponse.json({ correct, recorded, mode: recorded ? "live" : "demo", gradingSource: "server_curriculum", ...(!recorded ? { reason: "Verified practice feedback; database storage was unavailable or unconfirmed." } : {}) });
}

async function recordAttempt(
  quizSlug: string,
  questionId: string,
  selectedIndex: number,
  correctIndex: number,
  correct: boolean,
): Promise<boolean> {
  const prisma = await getPrisma();
  if (!prisma?.$queryRawUnsafe) return false;

  try {
    const rows = await prisma.$queryRawUnsafe<Array<{ id: string }>>(
      `
      INSERT INTO "QuizAttempt" ("id", "conceptCardId", "quizSlug", "selectedIndex", "correctIndex", "isCorrect", "createdAt")
      VALUES ($1, (SELECT "id" FROM "ConceptCard" WHERE "slug" = $2 LIMIT 1), $3, $4, $5, $6, NOW())
      RETURNING "id"
      `,
      randomUUID(),
      quizSlug,
      `${quizSlug}:${questionId}`,
      selectedIndex,
      correctIndex,
      correct,
    );
    return rows.length > 0;
  } catch {
    return false;
  }
}

function normalizeAnswer(answer: string): string {
  return answer.trim().toLowerCase().replace(/\s+/g, " ");
}
