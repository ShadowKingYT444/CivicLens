"use client";

import { useState } from "react";
import type { QuizQuestion } from "./types";

export function QuizCard({
  quiz,
  sourceId,
}: {
  quiz: QuizQuestion | QuizQuestion[] | null | undefined;
  sourceId?: string;
}) {
  const [selected, setSelected] = useState<number | null>(null);
  const [serverMessage, setServerMessage] = useState<string>("");
  const normalizedQuiz = normalizeQuizInput(quiz);
  const correctIndex = normalizedQuiz?.correctIndex;

  const status =
    selected === null || correctIndex === undefined
      ? ""
      : selected === correctIndex
        ? "Correct"
        : "Try another source-backed answer";

  if (!normalizedQuiz || !normalizedQuiz.question || normalizedQuiz.options.length === 0) {
    return null;
  }

  async function submitAttempt(index: number) {
    setSelected(index);
    setServerMessage("");

    try {
      await fetch("/api/quiz/attempt", {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({
          sourceId,
          answerIndex: index,
          isCorrect: correctIndex === undefined ? undefined : index === correctIndex,
        }),
      });
    } catch {
      setServerMessage("Answer noted for this session.");
    }
  }

  return (
    <section className="quiz" aria-label="Knowledge check">
      <div>
        <p className="eyebrow">Quick Check</p>
        <h3 className="section-title">{normalizedQuiz.question}</h3>
      </div>
      <div className="option-grid">
        {normalizedQuiz.options.map((option, index) => {
          const selectedClass = selected === index ? " selected" : "";
          const resultClass =
            selected !== null && correctIndex === index
              ? " correct"
              : selected === index && correctIndex !== undefined
                ? " incorrect"
                : "";

          return (
            <button
              key={option}
              type="button"
              className={`option-button${selectedClass}${resultClass}`}
              onClick={() => void submitAttempt(index)}
              aria-pressed={selected === index}
            >
              {option}
            </button>
          );
        })}
      </div>
      <p aria-live="polite" className="subtle">
        {[status, selected !== null ? normalizedQuiz.explanation : "", serverMessage].filter(Boolean).join(" ")}
      </p>
    </section>
  );
}

function normalizeQuizInput(quiz: QuizQuestion | QuizQuestion[] | null | undefined): {
  question: string;
  options: string[];
  correctIndex?: number;
  explanation?: string;
} | null {
  const first = Array.isArray(quiz) ? quiz[0] : quiz;
  if (!first?.question) {
    return null;
  }

  const options = first.options ?? first.choices ?? [];
  if (!Array.isArray(options) || options.length === 0) {
    return null;
  }

  const answerIndex =
    first.correctIndex ??
    first.answerIndex ??
    (first.correctAnswer ? options.findIndex((option) => option === first.correctAnswer) : -1);

  return {
    question: first.question,
    options,
    ...(answerIndex >= 0 ? { correctIndex: answerIndex } : {}),
    explanation: first.explanation,
  };
}
