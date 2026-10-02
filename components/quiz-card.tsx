"use client";

import { useId, useState } from "react";
import type { QuizQuestion } from "./types";

type ValidQuiz = {
  id?: string;
  question: string;
  options: string[];
  correctIndex: number;
  explanation?: string;
  feedback?: QuizQuestion["feedback"];
  citationIds: string[];
};

export function QuizCard({
  quiz,
  sourceId,
}: {
  quiz: QuizQuestion | QuizQuestion[] | null | undefined;
  sourceId?: string;
}) {
  const questions = (Array.isArray(quiz) ? quiz : [quiz])
    .map(normalizeQuizInput)
    .filter((question): question is ValidQuiz => Boolean(question));
  return (
    <>
      {questions.map((question, index) => (
        <PracticeQuestion
          key={`${sourceId}-${question.id ?? question.question}`}
          quiz={question}
          sourceId={sourceId}
          position={index + 1}
          total={questions.length}
        />
      ))}
    </>
  );
}

function PracticeQuestion({
  quiz,
  sourceId,
  position,
  total,
}: {
  quiz: ValidQuiz;
  sourceId?: string;
  position: number;
  total: number;
}) {
  const questionInstanceId = useId();
  const [selected, setSelected] = useState<number | null>(null);
  const [serverMessage, setServerMessage] = useState("");
  const correct = selected === quiz.correctIndex;

  async function submitAttempt(index: number) {
    if (selected !== null) return;
    setSelected(index);
    setServerMessage("");
    try {
      const response = await fetch("/api/quiz/attempt", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify({
          quizId: (sourceId || "civic-practice").slice(0, 120),
          questionId: (quiz.id || `${questionInstanceId}-${position}`).slice(
            0,
            120,
          ),
          selectedAnswer: quiz.options[index],
          correctAnswer: quiz.options[quiz.correctIndex],
          citationIds: quiz.citationIds.slice(0, 5),
        }),
      });
      if (!response.ok)
        setServerMessage(
          "Your answer is checked here; the practice log is unavailable.",
        );
    } catch {
      setServerMessage(
        "Your answer is checked here; the practice log is unavailable.",
      );
    }
  }

  return (
    <section
      className="quiz"
      aria-label={`Knowledge check ${position} of ${total}`}
    >
      <div>
        <p className="eyebrow">
          Quick Check {total > 1 ? `${position} of ${total}` : ""}
        </p>
        <h3 className="section-title">{quiz.question}</h3>
      </div>
      <div className="option-grid">
        {quiz.options.map((option, index) => (
          <button
            key={`${index}-${option}`}
            type="button"
            className={`option-button${selected === index ? ` selected ${correct ? "correct" : "incorrect"}` : ""}`}
            onClick={() => void submitAttempt(index)}
            disabled={selected !== null}
            aria-pressed={selected === index}
          >
            {option}
          </button>
        ))}
      </div>
      <p aria-live="polite" className="subtle">
        {selected === null
          ? "Choose the answer supported by the evidence."
          : correct
            ? `Correct. ${quiz.feedback?.correct ?? quiz.explanation ?? "The source supports this answer."}`
            : `Not quite. ${quiz.feedback?.incorrect ?? "Revisit the source and try again."}`}{" "}
        {serverMessage}
      </p>
      {selected !== null && !correct ? (
        <button
          className="button secondary"
          type="button"
          onClick={() => {
            setSelected(null);
            setServerMessage("");
          }}
        >
          Try again
        </button>
      ) : null}
    </section>
  );
}

function normalizeQuizInput(
  quiz: QuizQuestion | null | undefined,
): ValidQuiz | null {
  if (!quiz?.question) return null;
  const options = quiz.options ?? quiz.choices;
  if (
    !Array.isArray(options) ||
    options.length < 2 ||
    options.some((option) => typeof option !== "string" || !option.trim())
  )
    return null;
  const correctIndex =
    quiz.correctIndex ??
    quiz.answerIndex ??
    options.findIndex((option) => option === quiz.correctAnswer);
  if (
    !Number.isInteger(correctIndex) ||
    correctIndex < 0 ||
    correctIndex >= options.length
  )
    return null;
  return {
    id: quiz.id,
    question: quiz.question,
    options,
    correctIndex,
    explanation: quiz.explanation,
    feedback: quiz.feedback,
    citationIds: quiz.citationIds ?? [],
  };
}
