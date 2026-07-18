import { NextRequest, NextResponse } from "next/server";
import { QuizAttemptRequestSchema } from "../../../../lib/ai/schemas";
import { sha256Hex } from "../../../../lib/ai/validators";
import { getPrisma } from "../../../../lib/db/prisma";

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
  const correct = attempt.correctAnswer
    ? normalizeAnswer(attempt.selectedAnswer) === normalizeAnswer(attempt.correctAnswer)
    : false;
  const recorded = await recordAttempt(attempt.quizId, attempt.questionId, attempt.selectedAnswer, correct, attempt.citationIds);

  return NextResponse.json({
    correct,
    recorded,
    mode: recorded ? "live" : "demo",
  });
}

async function recordAttempt(
  quizId: string,
  questionId: string,
  selectedAnswer: string,
  correct: boolean,
  citationIds: string[],
): Promise<boolean> {
  const prisma = await getPrisma();
  if (!prisma?.$queryRawUnsafe) {
    return false;
  }

  try {
    await prisma.$queryRawUnsafe(
      `
      INSERT INTO quiz_attempts (quiz_id, question_id, selected_answer_hash, is_correct, citation_ids, created_at)
      VALUES ($1, $2, $3, $4, $5::jsonb, NOW())
      `,
      quizId,
      questionId,
      sha256Hex(selectedAnswer),
      correct,
      JSON.stringify(citationIds),
    );
    return true;
  } catch {
    return false;
  }
}

function normalizeAnswer(answer: string): string {
  return answer.trim().toLowerCase().replace(/\s+/g, " ");
}
