"use client";

import Image from "next/image";
import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
} from "react";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  Flame,
  Gem,
  ListChecks,
  Lock,
  Sparkles,
  X,
} from "lucide-react";
import { demoFeedCards, getJson, normalizeFeedResponse } from "./api";
import { learningPathAssets } from "../lib/learning-path-assets";
import {
  buildLessonFlashcards,
  getLessonUnit,
  normalizeLessonQuiz,
} from "../lib/learn-curriculum";
import {
  emptyLearningProgress,
  finishLearningLesson,
  LEARNING_PROGRESS_KEY,
  LESSON_XP,
  learningStreak,
  localLearningDay,
  markLessonForReview,
  nextLearningIndex,
  parseLearningProgress,
} from "../lib/learning-progress";
import type { Citation, FeedCard } from "./types";

type LessonMode = "path" | "lesson" | "complete";
type AnswerState = "idle" | "correct" | "wrong";
type AssetKey = keyof typeof learningPathAssets;

export function FeedBrowser() {
  const [cards, setCards] = useState<FeedCard[]>([]);
  const [message, setMessage] = useState("Loading lessons…");
  const [mode, setMode] = useState<LessonMode>("path");
  const [activeIndex, setActiveIndex] = useState(0);
  const [progress, setProgress] = useState(emptyLearningProgress);
  const [hydrated, setHydrated] = useState(false);
  const [storageMessage, setStorageMessage] = useState("");
  const [slideIndex, setSlideIndex] = useState(0);
  const [selectedAnswer, setSelectedAnswer] = useState<number | null>(null);
  const [answerState, setAnswerState] = useState<AnswerState>("idle");
  const [sessionMissed, setSessionMissed] = useState(false);
  const [earnedXp, setEarnedXp] = useState(0);
  const pathRef = useRef<HTMLDivElement>(null);
  const stepHeadingRef = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    let active = true;
    getJson<unknown>("/api/feed")
      .then((payload) => {
        if (!active) return;
        setCards(normalizeFeedResponse(payload));
        setMessage("Lessons are ready.");
      })
      .catch(() => {
        if (!active) return;
        setCards(demoFeedCards);
        setMessage(
          "The lesson service is unavailable. Three sample lessons are available for practice.",
        );
      });
    try {
      setProgress(
        parseLearningProgress(
          window.localStorage.getItem(LEARNING_PROGRESS_KEY),
        ),
      );
    } catch {
      setStorageMessage(
        "Progress is available for this session. Browser storage is unavailable.",
      );
    }
    setHydrated(true);
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    try {
      window.localStorage.setItem(
        LEARNING_PROGRESS_KEY,
        JSON.stringify(progress),
      );
    } catch {
      setStorageMessage(
        "Progress is available for this session. Browser storage is unavailable.",
      );
    }
  }, [progress, hydrated]);

  const slugs = useMemo(() => cards.map((card) => card.slug), [cards]);
  const nextIndex = nextLearningIndex(slugs, progress);
  const activeCard =
    cards[Math.min(activeIndex, Math.max(cards.length - 1, 0))];
  const activeUnit = getLessonUnit(cards, activeIndex);
  const flashcards = useMemo(
    () => (activeCard ? buildLessonFlashcards(activeCard) : []),
    [activeCard],
  );
  const quizzes = useMemo(() => {
    if (!activeCard) return [];
    const candidates = activeCard.quizQuestions?.length
      ? activeCard.quizQuestions
      : [activeCard.quiz ?? activeCard.quizJson];
    return candidates
      .map(normalizeLessonQuiz)
      .filter((quiz): quiz is NonNullable<typeof quiz> => Boolean(quiz));
  }, [activeCard]);
  const quizIndex = Math.max(0, slideIndex - flashcards.length);
  const quiz = quizzes[quizIndex];
  const showingQuiz = slideIndex >= flashcards.length;
  const slide = flashcards[slideIndex];
  const totalSteps = flashcards.length + quizzes.length;
  const completedCount = slugs.filter(
    (slug) => progress.completed[slug],
  ).length;
  const reviewCards = cards.filter((card) =>
    progress.reviewSlugs.includes(card.slug),
  );
  const canContinue = !showingQuiz || answerState === "correct";
  const sources = (activeCard?.citations ?? []).filter((citation) => {
    const ids = showingQuiz ? quiz?.citationIds : slide?.citationIds;
    return !ids?.length || !citation.id || ids.includes(citation.id);
  });

  useEffect(() => {
    if (mode === "path") setActiveIndex(nextIndex);
    // A completion chooses the next available lesson; browsing stays within the current path.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cards, hydrated]);

  useEffect(() => {
    if (mode !== "path") stepHeadingRef.current?.focus();
  }, [mode, slideIndex]);

  function resetStep() {
    setSelectedAnswer(null);
    setAnswerState("idle");
  }

  function openLesson(index: number) {
    if (index > nextIndex || !cards[index]) return;
    setActiveIndex(index);
    setSlideIndex(0);
    setSessionMissed(false);
    resetStep();
    setMode("lesson");
  }

  function closeLesson() {
    setMode("path");
    setActiveIndex(nextIndex);
    setSlideIndex(0);
    resetStep();
    window.requestAnimationFrame(() => pathRef.current?.focus());
  }

  function handlePathKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (!cards.length || event.target !== event.currentTarget) return;
    if (
      [
        "ArrowRight",
        "ArrowDown",
        "ArrowLeft",
        "ArrowUp",
        "Home",
        "End",
        "Enter",
        " ",
      ].includes(event.key)
    )
      event.preventDefault();
    if (event.key === "ArrowRight" || event.key === "ArrowDown")
      setActiveIndex((index) => Math.min(index + 1, nextIndex));
    if (event.key === "ArrowLeft" || event.key === "ArrowUp")
      setActiveIndex((index) => Math.max(index - 1, 0));
    if (event.key === "Home") setActiveIndex(0);
    if (event.key === "End") setActiveIndex(nextIndex);
    if (event.key === "Enter" || event.key === " ") openLesson(activeIndex);
  }

  function chooseAnswer(index: number) {
    if (!quiz || selectedAnswer !== null) return;
    const correct = index === quiz.correctIndex;
    setSelectedAnswer(index);
    setAnswerState(correct ? "correct" : "wrong");
    if (!correct && activeCard) {
      setSessionMissed(true);
      setProgress((current) => markLessonForReview(current, activeCard.slug));
    }
  }

  function nextSlide() {
    if (mode !== "lesson" || !canContinue) return;
    if (
      !showingQuiz &&
      !quizzes.length &&
      slideIndex === flashcards.length - 1
    ) {
      setSlideIndex(flashcards.length);
      resetStep();
      return;
    }
    if (slideIndex < totalSteps - 1) {
      setSlideIndex((index) => index + 1);
      resetStep();
      return;
    }
    if (!activeCard || !quizzes.length || answerState !== "correct") return;
    setEarnedXp(progress.completed[activeCard.slug] ? 0 : LESSON_XP);
    setProgress((current) =>
      finishLearningLesson(
        current,
        activeCard.slug,
        localLearningDay(),
        !sessionMissed,
      ),
    );
    setMode("complete");
  }

  function previousSlide() {
    setSlideIndex((index) => Math.max(0, index - 1));
    resetStep();
  }

  return (
    <section
      className={`learn-shell ${mode !== "path" ? "is-lesson-open" : ""}`}
      aria-label="Civic lessons"
    >
      {mode === "path" ? (
        <>
          <LearningHeader
            message={message}
            xp={completedCount * LESSON_XP}
            streak={learningStreak(progress)}
          />
          <h1 className="learn-route-title">Learn</h1>
          <div className="learning-progress-summary">
            <strong>
              {completedCount} of {cards.length} lessons completed
            </strong>
            <p>Learn the idea. Check the evidence. Put it into practice.</p>
            {activeCard ? (
              <button
                className="button yellow"
                type="button"
                onClick={() => openLesson(nextIndex)}
              >
                {completedCount === cards.length
                  ? "Practice again"
                  : "Start next lesson"}{" "}
                <ArrowRight aria-hidden="true" size={20} />
              </button>
            ) : null}
            {reviewCards.length ? (
              <button
                className="button secondary"
                type="button"
                onClick={() => openLesson(cards.indexOf(reviewCards[0]))}
              >
                Review missed concepts ({reviewCards.length})
              </button>
            ) : null}
            <small>
              {storageMessage ||
                "Progress stays in this browser. No account needed."}
            </small>
          </div>
          {message !== "Lessons are ready." ? (
            <p className="subtle" role="status">
              {message}
            </p>
          ) : null}
          {activeCard ? (
            <>
              <article
                className="duo-unit-banner"
                aria-labelledby="duo-unit-title"
              >
                <div>
                  <p>
                    Section {activeUnit.section}, Lesson {activeUnit.unit}
                  </p>
                  <h2 id="duo-unit-title">{activeCard.title}</h2>
                  <p className="duo-unit-subtitle">
                    Source-backed lessons with quick checks.
                  </p>
                </div>
                <ListChecks aria-hidden="true" size={36} />
              </article>
              <div
                className="duo-path"
                role="listbox"
                aria-label="CivicLens lesson path"
                aria-activedescendant={`learn-node-${activeCard.slug}`}
                tabIndex={0}
                onKeyDown={handlePathKeyDown}
                ref={pathRef}
              >
                {cards.map((card, index) => {
                  const done = Boolean(progress.completed[card.slug]);
                  const active = index === activeIndex;
                  const locked = index > nextIndex;
                  return (
                    <div
                      className={`duo-node-row duo-node-row-${index % 4}`}
                      key={card.slug}
                      role="presentation"
                    >
                      {active ? (
                        <span className="duo-start-bubble" aria-hidden="true">
                          {done ? "Practice" : "Start"}
                        </span>
                      ) : null}
                      <button
                        id={`learn-node-${card.slug}`}
                        type="button"
                        role="option"
                        aria-selected={active}
                        disabled={locked}
                        className={`duo-node${done ? " complete" : ""}${active ? " active" : ""}${locked ? " locked" : ""}`}
                        onClick={() => openLesson(index)}
                      >
                        <span className="duo-node-ring">
                          {locked ? (
                            <Lock aria-hidden="true" size={30} />
                          ) : (
                            <Image
                              src={
                                done
                                  ? learningPathAssets.checkCoin
                                  : learningPathAssets.starCoin
                              }
                              alt=""
                              width={78}
                              height={78}
                            />
                          )}
                        </span>
                        <span className="sr-only">
                          Level {index + 1}: {card.title}.{" "}
                          {locked
                            ? "Complete earlier lessons to unlock"
                            : done
                              ? "Completed, practice available"
                              : "Ready to start"}
                        </span>
                      </button>
                      <div className="duo-node-caption" aria-hidden="true">
                        <strong>
                          {index + 1}. {card.title}
                        </strong>
                        <small>
                          {locked ? "Locked" : done ? "Completed" : "Ready"}
                          {progress.reviewSlugs.includes(card.slug)
                            ? " · Review"
                            : ""}
                        </small>
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          ) : (
            <p className="empty-state">Preparing your civic learning path.</p>
          )}
        </>
      ) : mode === "complete" && activeCard ? (
        <article className="lesson-complete-screen" aria-label="Lesson result">
          <div className="lesson-complete-card">
            <Image
              src={learningPathAssets.starCoin}
              alt=""
              width={116}
              height={116}
            />
            <h1 ref={stepHeadingRef} tabIndex={-1}>
              Lesson complete
            </h1>
            <p>{activeCard.title}</p>
            <span>
              {earnedXp
                ? `+${earnedXp} XP`
                : "Practice complete · XP already earned"}
            </span>
            <p>
              {sessionMissed
                ? "You corrected your answers. This concept is in your review queue; a clean practice pass clears it."
                : "Every check answered correctly. Keep building your civic understanding."}
            </p>
            <div className="lesson-complete-actions">
              <button
                className="button secondary"
                type="button"
                onClick={closeLesson}
              >
                Back to path
              </button>
              {completedCount < cards.length ? (
                <button
                  className="button yellow"
                  type="button"
                  onClick={() => openLesson(nextIndex)}
                >
                  Next lesson <ArrowRight size={18} aria-hidden="true" />
                </button>
              ) : null}
            </div>
          </div>
        </article>
      ) : activeCard ? (
        <article
          className="lesson-player"
          aria-label={`${activeCard.title} lesson`}
          onKeyDown={(event) => {
            if (event.key === "Escape") closeLesson();
          }}
        >
          <header className="lesson-player-top">
            <button
              className="lesson-back-button"
              type="button"
              onClick={closeLesson}
              aria-label="Back to learning path"
            >
              <ArrowLeft aria-hidden="true" size={28} />
            </button>
            <Image
              className="learn-logo lesson-logo"
              src={learningPathAssets.logo}
              alt="CivicLens"
              width={150}
              height={40}
            />
            <div className="lesson-progress-copy">
              <strong>
                Lesson {activeIndex + 1} of {cards.length}
              </strong>
              <span>{activeCard.category}</span>
            </div>
          </header>
          <div
            className="lesson-progress-bar"
            role="progressbar"
            aria-label="Lesson progress"
            aria-valuemin={0}
            aria-valuemax={totalSteps}
            aria-valuenow={slideIndex + (answerState === "correct" ? 1 : 0)}
          >
            {Array.from({ length: totalSteps }).map((_, index) => (
              <span
                key={index}
                className={
                  index < slideIndex + (answerState === "correct" ? 1 : 0)
                    ? "filled"
                    : ""
                }
              />
            ))}
          </div>
          <section className="lesson-hero-panel">
            <div>
              <p>{activeCard.category}</p>
              <h1>{activeCard.title}</h1>
            </div>
            <Image
              src={learningPathAssets.capitolPlatform}
              alt=""
              width={176}
              height={144}
            />
          </section>
          {!showingQuiz && slide ? (
            <section
              className="lesson-card-stage"
              aria-labelledby="lesson-flashcard-heading"
            >
              <div className="lesson-stage-title">
                <Sparkles aria-hidden="true" size={22} />
                <div>
                  <h2
                    id="lesson-flashcard-heading"
                    ref={stepHeadingRef}
                    tabIndex={-1}
                  >
                    Learn the idea
                  </h2>
                  <p>
                    Card {slideIndex + 1} of {flashcards.length}
                  </p>
                </div>
              </div>
              <button
                className="lesson-flashcard tap-card"
                type="button"
                onClick={nextSlide}
                aria-label="Advance flashcard"
                aria-describedby={`lesson-card-title lesson-card-body${slide.bullets?.length ? " lesson-card-bullets" : ""}`}
              >
                <span className="flashcard-quote" aria-hidden="true">
                  &ldquo;
                </span>
                <Image
                  src={assetForSlide(slide.imageKey)}
                  alt=""
                  width={112}
                  height={112}
                />
                <p className="eyebrow">{slide.eyebrow}</p>
                <h3 id="lesson-card-title">{slide.title}</h3>
                <p id="lesson-card-body">{slide.body}</p>
                {slide.bullets?.length ? (
                  <ul id="lesson-card-bullets">
                    {slide.bullets.map((bullet) => (
                      <li key={bullet}>{bullet}</li>
                    ))}
                  </ul>
                ) : null}
              </button>
              <div
                className="lesson-dots"
                aria-label={`Flashcard ${slideIndex + 1} of ${flashcards.length}`}
              >
                {flashcards.map((card, index) => (
                  <span
                    key={card.id}
                    className={index === slideIndex ? "active" : ""}
                  />
                ))}
              </div>
            </section>
          ) : (
            <section
              className={`lesson-quiz-panel ${answerState}`}
              aria-labelledby="lesson-quiz-heading"
            >
              <div className="lesson-stage-title">
                <Image
                  src={learningPathAssets.checkCoin}
                  alt=""
                  width={54}
                  height={54}
                />
                <div>
                  <h2
                    id="lesson-quiz-heading"
                    ref={stepHeadingRef}
                    tabIndex={-1}
                  >
                    Quick check
                  </h2>
                  <p>
                    Question {quizIndex + 1} of {quizzes.length}
                  </p>
                </div>
              </div>
              {quiz ? (
                <>
                  <h3>{quiz.question}</h3>
                  <div className="lesson-answer-grid">
                    {quiz.options.map((option, index) => (
                      <button
                        key={`${index}-${option}`}
                        type="button"
                        className={`lesson-answer${selectedAnswer === index ? ` selected ${answerState}` : ""}`}
                        onClick={() => chooseAnswer(index)}
                        disabled={selectedAnswer !== null}
                        aria-pressed={selectedAnswer === index}
                      >
                        <span>
                          {selectedAnswer === index &&
                          answerState === "correct" ? (
                            <Check aria-hidden="true" size={24} />
                          ) : null}
                          {selectedAnswer === index &&
                          answerState === "wrong" ? (
                            <X aria-hidden="true" size={24} />
                          ) : null}
                        </span>
                        {option}
                      </button>
                    ))}
                  </div>
                  <p
                    className={`lesson-feedback ${answerState}`}
                    aria-live="polite"
                  >
                    {answerState === "idle"
                      ? "Pick the best source-backed answer."
                      : answerState === "correct"
                        ? `Correct! ${quiz.feedback.correct || quiz.explanation}`
                        : `Not quite. ${quiz.feedback.incorrect}${quiz.feedback.retry ? ` ${quiz.feedback.retry}` : ""}`}
                  </p>
                  {answerState === "wrong" ? (
                    <div className="lesson-retry-actions">
                      <button
                        className="button secondary"
                        type="button"
                        onClick={() => {
                          setSlideIndex(0);
                          resetStep();
                        }}
                      >
                        Review lesson cards
                      </button>
                      <button
                        className="button yellow"
                        type="button"
                        onClick={() => {
                          resetStep();
                          window.requestAnimationFrame(() =>
                            stepHeadingRef.current?.focus(),
                          );
                        }}
                      >
                        Try again
                      </button>
                    </div>
                  ) : null}
                </>
              ) : (
                <p className="lesson-feedback">
                  This lesson has no valid check yet. Return to the path and
                  choose another lesson.
                </p>
              )}
            </section>
          )}
          <LessonSources citations={sources} />
          {storageMessage ? (
            <p className="subtle" role="status">
              {storageMessage}
            </p>
          ) : null}
          <div className="lesson-player-actions">
            <button
              className="button secondary"
              type="button"
              onClick={previousSlide}
              disabled={slideIndex === 0}
            >
              Back
            </button>
            <button
              className="button yellow lesson-continue"
              type="button"
              onClick={nextSlide}
              disabled={!canContinue || (showingQuiz && !quiz)}
            >
              {showingQuiz
                ? quizIndex === quizzes.length - 1
                  ? "Complete lesson"
                  : "Next question"
                : "Continue lesson"}{" "}
              <ArrowRight aria-hidden="true" size={22} />
            </button>
          </div>
        </article>
      ) : null}
    </section>
  );
}

function LearningHeader({
  message,
  xp,
  streak,
}: {
  message: string;
  xp: number;
  streak: number;
}) {
  return (
    <header className="duo-learn-topbar">
      <Image
        className="learn-logo"
        src={learningPathAssets.logo}
        alt="CivicLens"
        width={160}
        height={42}
        priority
      />
      <div className="duo-stat" aria-label={`${streak} day learning streak`}>
        <Flame aria-hidden="true" size={24} />
        <strong>{streak}</strong>
      </div>
      <div
        className="duo-stat duo-stat-xp"
        aria-label={`${xp} experience points`}
      >
        <Gem aria-hidden="true" size={24} />
        <strong>{xp.toLocaleString()} XP</strong>
      </div>
      <p className="sr-only" aria-live="polite">
        {message}
      </p>
    </header>
  );
}

function LessonSources({ citations }: { citations: Citation[] }) {
  return (
    <details className="lesson-source-panel">
      <summary>Check the official sources ({citations.length})</summary>
      {citations.length ? (
        <ul>
          {citations.map((citation, index) => (
            <li key={citation.id ?? index}>
              <a href={citation.url} target="_blank" rel="noreferrer">
                {citation.title ?? "Official source"}
              </a>
              {citation.excerpt ? (
                <p>
                  <small>Source overview</small>
                  <br />
                  {citation.excerpt}
                </p>
              ) : null}
            </li>
          ))}
        </ul>
      ) : (
        <p>
          No source links were returned for this lesson. The learning service
          may be unavailable.
        </p>
      )}
    </details>
  );
}

function assetForSlide(key: string | undefined) {
  return key && key in learningPathAssets
    ? learningPathAssets[key as AssetKey]
    : learningPathAssets.capitolPlatform;
}
