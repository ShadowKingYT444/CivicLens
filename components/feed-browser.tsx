"use client";

import Image from "next/image";
import { learningPathAssets } from "../lib/learning-path-assets";

import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
  type MouseEvent,
  type RefObject,
  type PointerEvent,
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
import {
  buildLessonFlashcards,
  getLessonUnit,
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

type AssetKey = keyof typeof learningPathAssets;
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

  const lessonCards = cards;
  const activeUnit = getLessonUnit(lessonCards, activeIndex);
  const canContinue = !showingQuiz || canComplete;
  function chooseAnswer(index: number) {
    if (!quiz) return;
    setSelectedAnswer(index);
    setAnswerState(index === quiz.correctIndex ? "correct" : "wrong");
  }

  if (!activeCard) {
    return (
      <section className="learn-shell" aria-label="Civic lessons">
        <LearningHeader
          message={message}
          xp={progress.xp}
          completedCount={completedCount}
        />
        <p className="empty-state">Lessons are loading.</p>
      </section>
    );
  }

  return (
    <section
      className={`learn-shell ${mode === "lesson" ? "is-lesson-open" : ""}`}
      aria-label="Civic lessons"
    >
      {mode === "path" ? (
        <>
          <LearningHeader
            message={message}
            xp={progress.xp}
            completedCount={completedCount}
          />
          <h1 className="learn-route-title">Learn</h1>
          {isDemo ? <p className="status-pill">Demo curriculum</p> : null}
          {completion ? (
            <div
              className="lesson-complete-burst"
              role="status"
              aria-live="polite"
            >
              <div className="lesson-complete-card">
                <Image
                  src={learningPathAssets.starCoin}
                  alt=""
                  width={116}
                  height={116}
                />
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
                <button
                  className="button yellow"
                  type="button"
                  onClick={() => {
                    setCompletion(null);
                    pathRef.current?.focus();
                  }}
                >
                  Continue learning
                </button>
              </div>
            </div>
          ) : null}
          <article className="duo-unit-banner" aria-labelledby="duo-unit-title">
            <div>
              <p>
                Section {activeUnit.section}, Unit {activeUnit.unit}
              </p>
              <h1 id="duo-unit-title">{activeUnit.unitTitle}</h1>
              <p className="duo-unit-subtitle">
                Source-backed lessons with quick checks.
              </p>
            </div>
            <ListChecks aria-hidden="true" size={36} />
          </article>

          <div
            ref={pathRef}
            className="duo-path"
            role="listbox"
            aria-label="CivicLens lesson path"
            aria-activedescendant={`learn-node-${activeCard.slug}`}
            tabIndex={0}
            onKeyDown={handlePathKeyDown}
          >
            {lessonCards.map((card, index) => {
              const isDone = completed.has(card.slug);
              const isActive = index === activeIndex;
              const isLocked = index > maxUnlockedIndex;
              const nodeAsset = getNodeAsset(index, isDone, isActive);

              return (
                <div
                  className={`duo-node-row duo-node-row-${index % 4}`}
                  key={card.slug}
                  role="presentation"
                >
                  {isActive ? (
                    <span className="duo-start-bubble" aria-hidden="true">
                      Start
                    </span>
                  ) : null}
                  <button
                    id={`learn-node-${card.slug}`}
                    type="button"
                    role="option"
                    tabIndex={-1}
                    aria-selected={isActive}
                    disabled={isLocked}
                    className={`duo-node${isDone ? " complete" : ""}${isActive ? " active" : ""}${isLocked ? " locked" : ""}`}
                    onClick={() => openLesson(index)}
                  >
                    <span className="duo-node-ring">
                      {isLocked ? (
                        <Lock aria-hidden="true" size={30} />
                      ) : (
                        <Image src={nodeAsset} alt="" width={78} height={78} />
                      )}
                    </span>
                    <span className="sr-only">
                      Level {index + 1}: {card.title}
                    </span>
                  </button>
                  {index % 6 === 3 ? (
                    <Image
                      className="duo-path-side-art"
                      src={learningPathAssets.capitolPath}
                      alt=""
                      width={118}
                      height={118}
                    />
                  ) : null}
                  {index % 9 === 6 ? (
                    <button
                      className={`duo-chest${isLocked ? " locked" : ""}`}
                      type="button"
                      disabled={isLocked}
                      onClick={() => openLesson(index)}
                    >
                      <Image
                        src={learningPathAssets.treasureChest}
                        alt=""
                        width={104}
                        height={104}
                      />
                      <span>Bonus</span>
                    </button>
                  ) : null}
                </div>
              );
            })}
          </div>
        </>
      ) : (
        <LessonPlayer
          card={activeCard}
          cardIndex={activeIndex}
          totalCards={lessonCards.length}
          flashcards={flashcards}
          quiz={quiz}
          slideIndex={slideIndex}
          selectedAnswer={selectedAnswer}
          answerState={answerState}
          canContinue={canContinue}
          progressStep={progressStep}
          progressTotal={progressTotal}
          celebrating={false}
          headingRef={readerHeadingRef}
          quizRef={quizHeadingRef}
          onCardClick={handleCardClick}
          onBack={closeLesson}
          onNext={nextSlide}
          onPrevious={previousSlide}
          onAnswer={chooseAnswer}
          onCardPointerDown={handlePointerDown}
          onCardPointerUp={handlePointerUp}
        />
      )}
    </section>
  );
}

function LearningHeader({
  message,
  xp,
  completedCount,
}: {
  message: string;
  xp: number;
  completedCount: number;
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
      <div className="duo-stat" aria-label="Lessons completed">
        <Flame aria-hidden="true" size={24} />
        <strong>{completedCount}</strong>
      </div>
      <div className="duo-stat duo-stat-xp" aria-label="XP">
        <Gem aria-hidden="true" size={24} />
        <strong>{xp.toLocaleString()} XP</strong>
      </div>
      <p className="sr-only" aria-live="polite">
        {message}
      </p>
    </header>
  );
}

function LessonPlayer({
  card,
  cardIndex,
  totalCards,
  flashcards,
  quiz,
  slideIndex,
  selectedAnswer,
  answerState,
  canContinue,
  progressStep,
  progressTotal,
  celebrating,
  headingRef,
  quizRef,
  onCardClick,
  onBack,
  onNext,
  onPrevious,
  onAnswer,
  onCardPointerDown,
  onCardPointerUp,
}: {
  card: FeedCard;
  cardIndex: number;
  totalCards: number;
  flashcards: ReturnType<typeof buildLessonFlashcards>;
  quiz: ReturnType<typeof normalizeLessonQuiz>;
  slideIndex: number;
  selectedAnswer: number | null;
  answerState: AnswerState;
  canContinue: boolean;
  progressStep: number;
  progressTotal: number;
  celebrating: boolean;
  headingRef: RefObject<HTMLHeadingElement | null>;
  quizRef: RefObject<HTMLHeadingElement | null>;
  onCardClick: (event: MouseEvent<HTMLButtonElement>) => void;
  onBack: () => void;
  onNext: () => void;
  onPrevious: () => void;
  onAnswer: (index: number) => void;
  onCardPointerDown: (event: PointerEvent<HTMLButtonElement>) => void;
  onCardPointerUp: (event: PointerEvent<HTMLButtonElement>) => void;
}) {
  const showingQuiz = slideIndex >= flashcards.length;
  const slide = flashcards[Math.min(slideIndex, flashcards.length - 1)];
  const currentAsset = assetForSlide(slide?.imageKey);

  return (
    <article className="lesson-player" aria-label={`${card.title} lesson`}>
      <header className="lesson-player-top">
        <button
          className="lesson-back-button"
          type="button"
          onClick={onBack}
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
            Lesson {cardIndex + 1} of {totalCards}
          </strong>
          <span>{card.category}</span>
        </div>
      </header>

      <div
        className="lesson-progress-bar"
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={progressTotal}
        aria-valuenow={progressStep}
        aria-label={`Lesson step ${progressStep} of ${progressTotal}`}
      >
        {Array.from({ length: Math.max(progressTotal, 1) }).map((_, index) => (
          <span key={index} className={index < progressStep ? "filled" : ""} />
        ))}
      </div>

      <section className="lesson-hero-panel">
        <div>
          <p>{card.category}</p>
          <h1 ref={headingRef} tabIndex={-1}>
            {card.title}
          </h1>
        </div>
        <Image
          src={learningPathAssets.capitolPlatform}
          alt=""
          width={176}
          height={144}
          priority
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
              <h2 id="lesson-flashcard-heading">Learn the idea</h2>
              <p>Tap or swipe to explore</p>
            </div>
          </div>
          <button
            className="lesson-flashcard tap-card"
            type="button"
            onClick={onCardClick}
            onPointerDown={onCardPointerDown}
            onPointerUp={onCardPointerUp}
            aria-label="Advance flashcard"
          >
            <span className="flashcard-quote" aria-hidden="true">
              &ldquo;
            </span>
            <Image src={currentAsset} alt="" width={112} height={112} />
            <p className="eyebrow">
              {slide.eyebrow ?? `Card ${slideIndex + 1}`}
            </p>
            <h3>{slide.title}</h3>
            <p>{slide.body}</p>
            {slide.bullets?.length ? (
              <ul>
                {slide.bullets.map((bullet) => (
                  <li key={bullet}>{bullet}</li>
                ))}
              </ul>
            ) : null}
          </button>
          <Dots current={slideIndex} total={flashcards.length} />
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
              <h2 id="lesson-quiz-heading" ref={quizRef} tabIndex={-1}>
                Quick check
              </h2>
              <p>Test your understanding</p>
            </div>
          </div>
          {quiz ? (
            <>
              <h3>{quiz.question}</h3>
              <div className="lesson-answer-grid">
                {quiz.options.map((option, index) => {
                  const isSelected = selectedAnswer === index;
                  const isCorrect = quiz.correctIndex === index;
                  const reveal = selectedAnswer !== null;
                  return (
                    <button
                      key={option}
                      type="button"
                      className={`lesson-answer${isSelected ? " selected" : ""}${reveal && isCorrect ? " correct" : ""}${reveal && isSelected && !isCorrect ? " wrong" : ""}`}
                      onClick={() => onAnswer(index)}
                      aria-pressed={isSelected}
                    >
                      <span>
                        {reveal && isCorrect ? (
                          <Check aria-hidden="true" size={24} />
                        ) : null}
                        {reveal && isSelected && !isCorrect ? (
                          <X aria-hidden="true" size={24} />
                        ) : null}
                      </span>
                      {option}
                    </button>
                  );
                })}
              </div>
              <p
                className={`lesson-feedback ${answerState}`}
                aria-live="polite"
              >
                {selectedAnswer === null
                  ? "Pick the best source-backed answer."
                  : answerState === "correct"
                    ? `Correct! ${quiz.explanation ?? "Nice source check."}`
                    : `Not quite. ${quiz.explanation ?? "Try the source-backed choice."}`}
              </p>
            </>
          ) : (
            <p className="lesson-feedback correct">
              No quiz is attached to this concept yet. Continue to complete it.
            </p>
          )}
        </section>
      )}

      <div className="lesson-player-actions">
        <button
          className="button secondary"
          type="button"
          onClick={onPrevious}
          disabled={slideIndex === 0}
        >
          Back
        </button>
        <button
          className="button yellow lesson-continue"
          type="button"
          onClick={onNext}
          disabled={!canContinue}
        >
          {showingQuiz ? "Complete lesson" : "Continue lesson"}{" "}
          <ArrowRight aria-hidden="true" size={22} />
        </button>
      </div>

      {celebrating ? (
        <div className="lesson-complete-burst" role="status" aria-live="polite">
          <div className="lesson-complete-card">
            <Image
              src={learningPathAssets.starCoin}
              alt=""
              width={116}
              height={116}
            />
            <strong>Level complete</strong>
            <span>+25 XP</span>
          </div>
        </div>
      ) : null}
    </article>
  );
}

function Dots({ current, total }: { current: number; total: number }) {
  return (
    <div
      className="lesson-dots"
      aria-label={`Flashcard ${current + 1} of ${total}`}
    >
      {Array.from({ length: total }).map((_, index) => (
        <span key={index} className={index === current ? "active" : ""} />
      ))}
    </div>
  );
}

function getNodeAsset(index: number, isDone: boolean, isActive: boolean) {
  if (index % 9 === 6) return learningPathAssets.treasureChest;
  if (isDone) return learningPathAssets.checkCoin;
  if (isActive) return learningPathAssets.starCoin;
  return learningPathAssets.capitolPath;
}

function assetForSlide(key: string | undefined) {
  if (key && key in learningPathAssets) {
    return learningPathAssets[key as AssetKey];
  }
  return learningPathAssets.capitolPlatform;
}
