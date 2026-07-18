"use client";

import Image from "next/image";
import { useEffect, useMemo, useState, type KeyboardEvent, type PointerEvent } from "react";
import { ArrowLeft, ArrowRight, Check, Flame, Gem, ListChecks, Lock, Sparkles, X } from "lucide-react";
import { demoFeedCards, getJson, normalizeFeedResponse } from "./api";
import { learningPathAssets } from "../lib/learning-path-assets";
import { buildLessonFlashcards, getLessonUnit, normalizeLessonQuiz } from "../lib/learn-curriculum";
import type { FeedCard } from "./types";

const maxCards = 30;
const visibleMapCards = 24;
const starterProgressIndex = 2;

type LessonMode = "path" | "lesson";
type AnswerState = "idle" | "correct" | "wrong";
type AssetKey = keyof typeof learningPathAssets;

export function FeedBrowser() {
  const [cards, setCards] = useState<FeedCard[]>(demoFeedCards);
  const [message, setMessage] = useState("Loading lessons...");
  const [mode, setMode] = useState<LessonMode>("path");
  const [activeIndex, setActiveIndex] = useState(starterProgressIndex);
  const [progressIndex, setProgressIndex] = useState(starterProgressIndex);
  const [slideIndex, setSlideIndex] = useState(0);
  const [selectedAnswer, setSelectedAnswer] = useState<number | null>(null);
  const [answerState, setAnswerState] = useState<AnswerState>("idle");
  const [completedLessons, setCompletedLessons] = useState<Set<string>>(() => new Set());
  const [touchStartX, setTouchStartX] = useState<number | null>(null);
  const [celebrating, setCelebrating] = useState(false);

  useEffect(() => {
    let active = true;

    getJson<unknown>("/api/feed")
      .then((payload) => {
        if (!active) return;
        const normalized = normalizeFeedResponse(payload).slice(0, maxCards);
        setCards(normalized.length > 0 ? normalized : demoFeedCards);
        setMessage("Lessons are ready.");
      })
      .catch(() => {
        if (active) setMessage("Lessons are ready.");
      });

    return () => {
      active = false;
    };
  }, []);

  const lessonCards = useMemo(() => cards.slice(0, visibleMapCards), [cards]);

  useEffect(() => {
    const maxIndex = Math.max(lessonCards.length - 1, 0);
    setActiveIndex((index) => Math.min(index, maxIndex));
    setProgressIndex((index) => Math.min(index, maxIndex));
  }, [lessonCards.length]);

  const activeCard = lessonCards[Math.min(activeIndex, Math.max(lessonCards.length - 1, 0))];
  const activeUnit = getLessonUnit(lessonCards, activeIndex);
  const maxUnlockedIndex = Math.min(progressIndex + 1, Math.max(lessonCards.length - 1, 0));
  const flashcards = useMemo(() => (activeCard ? buildLessonFlashcards(activeCard) : []), [activeCard]);
  const quiz = useMemo(
    () => normalizeLessonQuiz(activeCard?.quiz ?? activeCard?.quizJson),
    [activeCard?.quiz, activeCard?.quizJson],
  );
  const lessonProgressTotal = flashcards.length + (quiz ? 1 : 0);
  const lessonProgressStep = Math.min(slideIndex + 1, Math.max(lessonProgressTotal, 1));
  const canContinue = slideIndex < flashcards.length ? true : !quiz || selectedAnswer !== null;

  function openLesson(index: number) {
    if (index > maxUnlockedIndex) return;

    setActiveIndex(index);
    setSlideIndex(0);
    setSelectedAnswer(null);
    setAnswerState("idle");
    setCelebrating(false);
    setMode("lesson");
  }

  function closeLesson() {
    setMode("path");
    setSlideIndex(0);
    setSelectedAnswer(null);
    setAnswerState("idle");
  }

  function handlePathKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (!lessonCards.length) return;
    if (event.key === "ArrowRight" || event.key === "ArrowDown") {
      event.preventDefault();
      setActiveIndex((index) => Math.min(index + 1, maxUnlockedIndex));
    }
    if (event.key === "ArrowLeft" || event.key === "ArrowUp") {
      event.preventDefault();
      setActiveIndex((index) => Math.max(index - 1, 0));
    }
    if (event.key === "Home") {
      event.preventDefault();
      setActiveIndex(0);
    }
    if (event.key === "End") {
      event.preventDefault();
      setActiveIndex(maxUnlockedIndex);
    }
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      openLesson(activeIndex);
    }
  }

  function nextSlide() {
    if (slideIndex < flashcards.length) {
      setSlideIndex((index) => Math.min(index + 1, flashcards.length));
      return;
    }

    completeLesson();
  }

  function previousSlide() {
    setSlideIndex((index) => Math.max(index - 1, 0));
    setSelectedAnswer(null);
    setAnswerState("idle");
  }

  function chooseAnswer(index: number) {
    if (!quiz) return;
    setSelectedAnswer(index);
    setAnswerState(index === quiz.correctIndex ? "correct" : "wrong");
  }

  function completeLesson() {
    if (!activeCard) return;
    setCompletedLessons((current) => new Set([...current, activeCard.slug]));
    setCelebrating(true);
    window.setTimeout(() => {
      setCelebrating(false);
      setMode("path");
      setSlideIndex(0);
      setSelectedAnswer(null);
      setAnswerState("idle");
      const nextIndex = Math.min(activeIndex + 1, lessonCards.length - 1);
      setProgressIndex((index) => Math.max(index, nextIndex));
      setActiveIndex(nextIndex);
    }, 900);
  }

  function handleCardPointerDown(event: PointerEvent<HTMLButtonElement>) {
    setTouchStartX(event.clientX);
  }

  function handleCardPointerUp(event: PointerEvent<HTMLButtonElement>) {
    if (touchStartX === null) return;
    const delta = event.clientX - touchStartX;
    setTouchStartX(null);
    if (delta < -36) nextSlide();
    if (delta > 36) previousSlide();
  }

  if (!activeCard) {
    return (
      <section className="learn-shell" aria-label="Civic lessons">
        <LearningHeader message={message} />
        <p className="empty-state">Lessons are loading.</p>
      </section>
    );
  }

  return (
    <section className={`learn-shell ${mode === "lesson" ? "is-lesson-open" : ""}`} aria-label="Civic lessons">
      {mode === "path" ? (
        <>
          <LearningHeader message={message} />
          <h1 className="learn-route-title">Learn</h1>
          <article className="duo-unit-banner" aria-labelledby="duo-unit-title">
            <div>
              <p>Section {activeUnit.section}, Unit {activeUnit.unit}</p>
              <h1 id="duo-unit-title">{activeUnit.unitTitle}</h1>
              <p className="duo-unit-subtitle">Source-backed lessons with quick checks.</p>
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
          >
            {lessonCards.map((card, index) => {
              const isDone = completedLessons.has(card.slug) || index < progressIndex;
              const isActive = index === activeIndex;
              const isLocked = index > maxUnlockedIndex;
              const nodeAsset = getNodeAsset(index, isDone, isActive);

              return (
                <div className={`duo-node-row duo-node-row-${index % 4}`} key={card.slug} role="presentation">
                  {isActive ? (
                    <span className="duo-start-bubble" aria-hidden="true">
                      Start
                    </span>
                  ) : null}
                  <button
                    id={`learn-node-${card.slug}`}
                    type="button"
                    role="option"
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
                      <Image src={learningPathAssets.treasureChest} alt="" width={104} height={104} />
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
          progressStep={lessonProgressStep}
          progressTotal={lessonProgressTotal}
          celebrating={celebrating}
          onBack={closeLesson}
          onNext={nextSlide}
          onPrevious={previousSlide}
          onAnswer={chooseAnswer}
          onCardPointerDown={handleCardPointerDown}
          onCardPointerUp={handleCardPointerUp}
        />
      )}
    </section>
  );
}

function LearningHeader({ message }: { message: string }) {
  return (
    <header className="duo-learn-topbar">
      <Image className="learn-logo" src={learningPathAssets.logo} alt="CivicLens" width={160} height={42} priority />
      <div className="duo-stat" aria-label="Day streak">
        <Flame aria-hidden="true" size={24} />
        <strong>12</strong>
      </div>
      <div className="duo-stat duo-stat-xp" aria-label="XP">
        <Gem aria-hidden="true" size={24} />
        <strong>2,450 XP</strong>
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
        <button className="lesson-back-button" type="button" onClick={onBack} aria-label="Back to learning path">
          <ArrowLeft aria-hidden="true" size={28} />
        </button>
        <Image className="learn-logo lesson-logo" src={learningPathAssets.logo} alt="CivicLens" width={150} height={40} />
        <div className="lesson-progress-copy">
          <strong>Lesson {cardIndex + 1} of {totalCards}</strong>
          <span>{card.category}</span>
        </div>
      </header>

      <div className="lesson-progress-bar" aria-label={`Lesson step ${progressStep} of ${progressTotal}`}>
        {Array.from({ length: Math.max(progressTotal, 1) }).map((_, index) => (
          <span key={index} className={index < progressStep ? "filled" : ""} />
        ))}
      </div>

      <section className="lesson-hero-panel">
        <div>
          <p>{card.category}</p>
          <h1>{card.title}</h1>
        </div>
        <Image src={learningPathAssets.capitolPlatform} alt="" width={176} height={144} priority />
      </section>

      {!showingQuiz && slide ? (
        <section className="lesson-card-stage" aria-labelledby="lesson-flashcard-heading">
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
            onClick={onNext}
            onPointerDown={onCardPointerDown}
            onPointerUp={onCardPointerUp}
            aria-label="Advance flashcard"
          >
            <span className="flashcard-quote" aria-hidden="true">
              &ldquo;
            </span>
            <Image src={currentAsset} alt="" width={112} height={112} />
            <p className="eyebrow">{slide.eyebrow ?? `Card ${slideIndex + 1}`}</p>
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
        <section className={`lesson-quiz-panel ${answerState}`} aria-labelledby="lesson-quiz-heading">
          <div className="lesson-stage-title">
            <Image src={learningPathAssets.checkCoin} alt="" width={54} height={54} />
            <div>
              <h2 id="lesson-quiz-heading">Quick check</h2>
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
                        {reveal && isCorrect ? <Check aria-hidden="true" size={24} /> : null}
                        {reveal && isSelected && !isCorrect ? <X aria-hidden="true" size={24} /> : null}
                      </span>
                      {option}
                    </button>
                  );
                })}
              </div>
              <p className={`lesson-feedback ${answerState}`} aria-live="polite">
                {selectedAnswer === null
                  ? "Pick the best source-backed answer."
                  : answerState === "correct"
                    ? `Correct! ${quiz.explanation ?? "Nice source check."}`
                    : `Not quite. ${quiz.explanation ?? "Try the source-backed choice."}`}
              </p>
            </>
          ) : (
            <p className="lesson-feedback correct">No quiz is attached to this concept yet. Continue to complete it.</p>
          )}
        </section>
      )}

      <div className="lesson-player-actions">
        <button className="button secondary" type="button" onClick={onPrevious} disabled={slideIndex === 0}>
          Back
        </button>
        <button className="button yellow lesson-continue" type="button" onClick={onNext} disabled={!canContinue}>
          {showingQuiz ? "Complete lesson" : "Continue lesson"} <ArrowRight aria-hidden="true" size={22} />
        </button>
      </div>

      {celebrating ? (
        <div className="lesson-complete-burst" role="status" aria-live="polite">
          <div className="lesson-complete-card">
            <Image src={learningPathAssets.starCoin} alt="" width={116} height={116} />
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
    <div className="lesson-dots" aria-label={`Flashcard ${current + 1} of ${total}`}>
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
