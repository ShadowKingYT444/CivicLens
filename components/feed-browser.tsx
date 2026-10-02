"use client";

import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
  type MouseEvent,
  type PointerEvent,
} from "react";
import { ArrowLeft, ArrowRight, Check, Lock, X } from "lucide-react";
import { demoFeedCards, getJson, normalizeFeedResponse } from "./api";
import {
  buildLessonFlashcards,
  normalizeLessonQuiz,
} from "../lib/learn-curriculum";
import {
  completeLearningLesson,
  LEARNING_PROGRESS_EVENT,
  LEARNING_PROGRESS_KEY,
  LESSON_XP,
  readLearningProgress,
  type LearningProgress,
} from "../lib/client-learning-progress";
import type { FeedCard } from "./types";

type AnswerState = "idle" | "correct" | "wrong";
type Completion = { awarded: boolean; persisted: boolean };

export function FeedBrowser() {
  const [cards, setCards] = useState<FeedCard[]>([]);
  const [message, setMessage] = useState("Loading lessons…");
  const [isDemo, setIsDemo] = useState(false);
  const [mode, setMode] = useState<"path" | "lesson">("path");
  const [activeIndex, setActiveIndex] = useState(0);
  const [slideIndex, setSlideIndex] = useState(0);
  const [selectedAnswer, setSelectedAnswer] = useState<number | null>(null);
  const [answerState, setAnswerState] = useState<AnswerState>("idle");
  const [progress, setProgress] = useState<LearningProgress>({
    completedSlugs: [],
    xp: 0,
  });
  const [completion, setCompletion] = useState<Completion | null>(null);
  const pathRef = useRef<HTMLDivElement>(null);
  const readerHeadingRef = useRef<HTMLHeadingElement>(null);
  const quizHeadingRef = useRef<HTMLHeadingElement>(null);
  const returnFocus = useRef(false);
  const completionGuard = useRef(false);
  const pointerStart = useRef<{ x: number; y: number; id: number } | null>(
    null,
  );
  const suppressClickUntil = useRef(0);

  useEffect(() => {
    let active = true;
    const restored = readLearningProgress();
    setProgress(restored);
    function showLessons(lessons: FeedCard[], status: string) {
      if (!active) return;
      setCards(lessons);
      const firstIncomplete = lessons.findIndex(
        (card) => !restored.completedSlugs.includes(card.slug),
      );
      setActiveIndex(
        firstIncomplete < 0 ? Math.max(lessons.length - 1, 0) : firstIncomplete,
      );
      setMessage(status);
    }
    getJson<unknown>("/api/feed")
      .then((payload) => {
        const demo = Boolean(
          payload &&
          typeof payload === "object" &&
          "mode" in payload &&
          payload.mode === "demo",
        );
        if (active) setIsDemo(demo);
        const lessons = normalizeFeedResponse(payload).slice(0, 24);
        showLessons(
          lessons.length ? lessons : demoFeedCards,
          demo ? "Showing the built-in demo curriculum." : "Lessons are ready.",
        );
      })
      .catch(() => {
        if (active) setIsDemo(true);
        showLessons(demoFeedCards, "Showing offline sample lessons.");
      });
    const updateProgress = (event: Event) => {
      if (
        event instanceof StorageEvent &&
        event.key !== LEARNING_PROGRESS_KEY &&
        event.key !== null
      )
        return;
      if (event instanceof CustomEvent && event.detail)
        setProgress(event.detail as LearningProgress);
      else setProgress(readLearningProgress());
    };
    window.addEventListener(LEARNING_PROGRESS_EVENT, updateProgress);
    window.addEventListener("storage", updateProgress);
    return () => {
      active = false;
      window.removeEventListener(LEARNING_PROGRESS_EVENT, updateProgress);
      window.removeEventListener("storage", updateProgress);
    };
  }, []);

  useEffect(() => {
    if (mode === "lesson") readerHeadingRef.current?.focus();
    else if (returnFocus.current) {
      pathRef.current?.focus();
      returnFocus.current = false;
    }
  }, [mode]);

  const completed = useMemo(
    () => new Set(progress.completedSlugs),
    [progress.completedSlugs],
  );
  const firstIncomplete = cards.findIndex((card) => !completed.has(card.slug));
  const maxUnlockedIndex =
    firstIncomplete < 0 ? Math.max(cards.length - 1, 0) : firstIncomplete;
  const activeCard = cards[activeIndex];
  const flashcards = useMemo(
    () => (activeCard ? buildLessonFlashcards(activeCard) : []),
    [activeCard],
  );
  const quiz = useMemo(
    () => normalizeLessonQuiz(activeCard?.quiz ?? activeCard?.quizJson),
    [activeCard],
  );
  const showingQuiz = slideIndex >= flashcards.length;
  const progressTotal = flashcards.length + 1;
  const progressStep = Math.min(slideIndex + 1, progressTotal);
  const completedCount = cards.filter((card) =>
    completed.has(card.slug),
  ).length;
  const canComplete = Boolean(quiz && answerState === "correct");

  useEffect(() => {
    if (mode === "lesson" && showingQuiz) quizHeadingRef.current?.focus();
  }, [mode, showingQuiz]);

  function resetReader() {
    setSlideIndex(0);
    setSelectedAnswer(null);
    setAnswerState("idle");
    pointerStart.current = null;
    suppressClickUntil.current = 0;
    completionGuard.current = false;
  }

  function openLesson(index: number) {
    if (index > maxUnlockedIndex || !cards[index]) return;
    resetReader();
    setActiveIndex(index);
    setCompletion(null);
    setMode("lesson");
  }

  function closeLesson() {
    resetReader();
    returnFocus.current = true;
    setMode("path");
  }

  function handlePathKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (!cards.length) return;
    const offsets: Record<string, number> = {
      ArrowRight: 1,
      ArrowDown: 1,
      ArrowLeft: -1,
      ArrowUp: -1,
    };
    if (event.key in offsets) {
      event.preventDefault();
      setActiveIndex((index) =>
        Math.max(0, Math.min(index + offsets[event.key], maxUnlockedIndex)),
      );
    } else if (event.key === "Home" || event.key === "End") {
      event.preventDefault();
      setActiveIndex(event.key === "Home" ? 0 : maxUnlockedIndex);
    } else if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      openLesson(activeIndex);
    }
  }

  function completeLesson() {
    if (!activeCard || !canComplete || completionGuard.current) return;
    completionGuard.current = true;
    const latest = readLearningProgress();
    const merged = {
      completedSlugs: [
        ...new Set([...progress.completedSlugs, ...latest.completedSlugs]),
      ],
      xp: 0,
    };
    const result = completeLearningLesson(activeCard.slug, merged);
    setProgress(result.progress);
    setCompletion({ awarded: result.awarded, persisted: result.persisted });
    const nextIncomplete = cards.findIndex(
      (card) => !result.progress.completedSlugs.includes(card.slug),
    );
    setActiveIndex(nextIncomplete < 0 ? activeIndex : nextIncomplete);
    returnFocus.current = true;
    setMode("path");
    // No delayed timer can navigate after a lesson is interrupted.
  }

  function nextSlide() {
    if (completionGuard.current) return;
    if (!showingQuiz)
      setSlideIndex((index) => Math.min(index + 1, flashcards.length));
    else completeLesson();
  }

  function previousSlide() {
    setSlideIndex((index) => Math.max(index - 1, 0));
    setSelectedAnswer(null);
    setAnswerState("idle");
  }

  function handlePointerDown(event: PointerEvent<HTMLButtonElement>) {
    if (!event.isPrimary || event.button !== 0) return;
    pointerStart.current = {
      x: event.clientX,
      y: event.clientY,
      id: event.pointerId,
    };
    event.currentTarget.setPointerCapture(event.pointerId);
  }

  function handlePointerUp(event: PointerEvent<HTMLButtonElement>) {
    const start = pointerStart.current;
    pointerStart.current = null;
    if (!start || start.id !== event.pointerId) return;
    const dx = event.clientX - start.x;
    const dy = event.clientY - start.y;
    if (Math.max(Math.abs(dx), Math.abs(dy)) < 40) return;
    suppressClickUntil.current = performance.now() + 400;
    if (Math.abs(dx) < 48 || Math.abs(dx) <= Math.abs(dy) * 1.25) return;
    if (dx < 0) nextSlide();
    else previousSlide();
  }

  function handleCardClick(event: MouseEvent<HTMLButtonElement>) {
    // Consume a swipe's synthesized pointer click, preserving keyboard clicks.
    if (event.detail > 0 && performance.now() < suppressClickUntil.current) {
      suppressClickUntil.current = 0;
      return;
    }
    nextSlide();
  }

  return (
    <section
      className={`editorial-learn learn-shell${mode === "lesson" ? " is-lesson-open" : ""}`}
      aria-label="Civic lessons"
    >
      {mode === "path" ? (
        <>
          <header className="editorial-learn-header">
            <div>
              <p className="eyebrow">The learning path</p>
              <h1>Understand how government works.</h1>
              <p>
                Short lessons. Official sources. A check before you move on.
              </p>
            </div>
            <div className="editorial-learning-stats">
              <span>
                <strong>{completedCount}</strong> / {cards.length || "—"}{" "}
                lessons complete
              </span>
              <span aria-label="XP">
                <strong>{progress.xp}</strong> XP earned
              </span>
            </div>
          </header>
          <div
            className="editorial-learning-progress"
            role="progressbar"
            aria-label="Learning path progress"
            aria-valuemin={0}
            aria-valuemax={cards.length || 24}
            aria-valuenow={completedCount}
          >
            <span
              style={{
                width: `${cards.length ? (completedCount / cards.length) * 100 : 0}%`,
              }}
            />
          </div>
          <p className="editorial-progress-note">
            {completion?.persisted === false
              ? "Progress cannot be saved in this browser."
              : "Progress is saved on this device. No account needed."}
          </p>
          {completion ? (
            <div className="editorial-completion" role="status">
              <Check aria-hidden="true" size={20} />
              <div>
                <strong>Level complete</strong>
                <span>
                  {completion.awarded
                    ? `+${LESSON_XP} XP`
                    : "Lesson reviewed — already completed."}
                </span>
                {!completion.persisted ? (
                  <p>
                    Browser storage is unavailable. Keep this page open to
                    retain your progress.
                  </p>
                ) : null}
              </div>
            </div>
          ) : null}
          <p
            className={
              message.startsWith("Showing") ? "editorial-feedback" : "sr-only"
            }
            aria-live="polite"
          >
            {message}
          </p>
          {!cards.length ? (
            <p className="empty-state" role="status">
              Loading your lessons…
            </p>
          ) : (
            <div
              ref={pathRef}
              className="editorial-path"
              role="listbox"
              aria-label="CivicLens lesson path"
              aria-activedescendant={`learn-node-${activeCard?.slug}`}
              tabIndex={0}
              onKeyDown={handlePathKeyDown}
            >
              {cards.map((card, index) => {
                const isDone = completed.has(card.slug);
                const isActive = index === activeIndex;
                const isLocked = index > maxUnlockedIndex;
                return (
                  <button
                    id={`learn-node-${card.slug}`}
                    key={card.slug}
                    type="button"
                    role="option"
                    aria-label={`Level ${index + 1}: ${card.title}`}
                    aria-selected={isActive}
                    disabled={isLocked}
                    tabIndex={-1}
                    className={`editorial-lesson-row${isDone ? " complete" : ""}${isActive ? " active" : ""}${isLocked ? " locked" : ""}`}
                    onClick={() => openLesson(index)}
                  >
                    <span
                      className="editorial-lesson-number"
                      aria-hidden="true"
                    >
                      {String(index + 1).padStart(2, "0")}
                    </span>
                    <span className="editorial-lesson-copy">
                      <span>{card.category || "Civics"}</span>
                      <strong>{card.title}</strong>
                      <span>
                        {card.hook ||
                          "Read the idea, then check your understanding."}
                      </span>
                    </span>
                    <span className="editorial-lesson-state">
                      {isDone ? (
                        <>
                          <Check aria-hidden="true" size={18} />
                          <span>Completed</span>
                        </>
                      ) : isLocked ? (
                        <>
                          <Lock aria-hidden="true" size={16} />
                          <span>Locked</span>
                        </>
                      ) : (
                        <>
                          <span>Start lesson</span>
                          <ArrowRight aria-hidden="true" size={18} />
                        </>
                      )}
                    </span>
                  </button>
                );
              })}
            </div>
          )}
        </>
      ) : activeCard ? (
        <article
          className="editorial-reader lesson-player"
          aria-label={`${activeCard.title} lesson`}
        >
          <header className="editorial-reader-header">
            <button
              className="editorial-back-button"
              type="button"
              onClick={closeLesson}
              aria-label="Back to learning path"
            >
              <ArrowLeft aria-hidden="true" size={18} />
              <span>Learning path</span>
            </button>
            <span>
              Lesson {activeIndex + 1} of {cards.length}
              {isDemo ? " · Demo curriculum" : ""}
            </span>
          </header>
          <div
            className="editorial-reader-progress lesson-progress-bar"
            role="progressbar"
            aria-label={`Lesson step ${progressStep} of ${progressTotal}`}
            aria-valuemin={0}
            aria-valuemax={progressTotal}
            aria-valuenow={progressStep}
          >
            {Array.from({ length: progressTotal }, (_, index) => (
              <span
                key={index}
                className={index < progressStep ? "filled" : ""}
              />
            ))}
          </div>
          <div className="editorial-reader-heading">
            <p className="eyebrow">{activeCard.category || "Civics"}</p>
            <h1 ref={readerHeadingRef} tabIndex={-1}>
              {activeCard.title}
            </h1>
          </div>
          {!showingQuiz && flashcards[slideIndex] ? (
            <section
              className="editorial-lesson-content lesson-card-stage"
              aria-labelledby="lesson-flashcard-heading"
            >
              <div className="editorial-step-label">
                <h2 id="lesson-flashcard-heading">Learn the idea</h2>
                <span>
                  Card {slideIndex + 1} of {flashcards.length}
                </span>
              </div>
              <button
                className="editorial-flashcard lesson-flashcard"
                type="button"
                aria-label="Advance flashcard"
                onClick={handleCardClick}
                onPointerDown={handlePointerDown}
                onPointerUp={handlePointerUp}
                onPointerCancel={() => {
                  pointerStart.current = null;
                }}
              >
                <div
                  key={flashcards[slideIndex].id}
                  className="editorial-flashcard-content"
                >
                  <span className="eyebrow">
                    {flashcards[slideIndex].eyebrow || "Key idea"}
                  </span>
                  <h3>{flashcards[slideIndex].title}</h3>
                  <p>{flashcards[slideIndex].body}</p>
                  {flashcards[slideIndex].bullets?.length ? (
                    <ul>
                      {flashcards[slideIndex].bullets!.map((bullet) => (
                        <li key={bullet}>{bullet}</li>
                      ))}
                    </ul>
                  ) : null}
                </div>
                <span className="editorial-flashcard-hint">
                  Next idea <ArrowRight aria-hidden="true" size={16} />
                </span>
              </button>
              <p className="editorial-reader-hint">
                Tap the card, swipe left, or use Continue lesson.
              </p>
            </section>
          ) : (
            <section
              className={`editorial-quiz lesson-quiz-panel ${answerState}`}
              aria-labelledby="lesson-quiz-heading"
            >
              <div className="editorial-step-label">
                <h2 id="lesson-quiz-heading" ref={quizHeadingRef} tabIndex={-1}>
                  Quick check
                </h2>
                <span>Put the idea to work</span>
              </div>
              {quiz ? (
                <>
                  <h3>{quiz.question}</h3>
                  <div className="editorial-answer-list lesson-answer-grid">
                    {quiz.options.map((option, index) => {
                      const selected = selectedAnswer === index;
                      const correct = selected && answerState === "correct";
                      const wrong = selected && answerState === "wrong";
                      return (
                        <button
                          key={`${index}-${option}`}
                          type="button"
                          aria-pressed={selected}
                          className={`editorial-answer lesson-answer${selected ? " selected" : ""}${correct ? " correct" : ""}${wrong ? " wrong" : ""}`}
                          onClick={() => {
                            setSelectedAnswer(index);
                            setAnswerState(
                              index === quiz.correctIndex ? "correct" : "wrong",
                            );
                          }}
                        >
                          <span
                            className="editorial-answer-letter"
                            aria-hidden="true"
                          >
                            {correct ? (
                              <Check size={18} />
                            ) : wrong ? (
                              <X size={18} />
                            ) : (
                              String.fromCharCode(65 + index)
                            )}
                          </span>
                          <span>{option}</span>
                        </button>
                      );
                    })}
                  </div>
                  <p
                    className={`editorial-feedback lesson-feedback ${answerState}`}
                    aria-live="polite"
                  >
                    {answerState === "idle"
                      ? "Choose the best answer to complete this lesson."
                      : answerState === "correct"
                        ? `Correct! ${quiz.feedback.correct || quiz.explanation || "The source supports this answer."}`
                        : `Not quite. ${quiz.feedback.incorrect || "Review the idea and try again."}`}
                  </p>
                </>
              ) : (
                <p className="editorial-feedback">
                  This lesson has no knowledge check yet. You can read it, but
                  completion and XP are unavailable.
                </p>
              )}
            </section>
          )}
          <footer className="editorial-reader-footer lesson-player-actions">
            <button
              className="button secondary"
              type="button"
              onClick={previousSlide}
              disabled={slideIndex === 0}
            >
              Back
            </button>
            <button
              className="button lesson-continue"
              type="button"
              onClick={nextSlide}
              disabled={showingQuiz && !canComplete}
            >
              {showingQuiz ? "Complete lesson" : "Continue lesson"}
              <ArrowRight aria-hidden="true" size={18} />
            </button>
          </footer>
        </article>
      ) : null}
    </section>
  );
}
