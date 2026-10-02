"use client";

import { FormEvent, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowRight,
  ArrowUpRight,
  BookOpen,
  FileText,
  MapPin,
  Search,
} from "lucide-react";
import { setPendingClaim } from "../lib/client-claim-handoff";
import {
  readLearningProgress,
  LEARNING_PROGRESS_EVENT,
} from "../lib/client-learning-progress";

const topics = [
  {
    number: "01",
    title: "Who has the power?",
    body: "Understand the branches of government.",
    href: "/feed",
  },
  {
    number: "02",
    title: "From a bill to a law",
    body: "Follow the decisions behind the headline.",
    href: "/bills/118/hr/82",
  },
  {
    number: "03",
    title: "Find your representatives",
    body: "Connect a public decision to an office.",
    href: "/district",
  },
];

export function HomeDashboard() {
  const router = useRouter();
  const [claim, setClaim] = useState("");
  const [completed, setCompleted] = useState(0);
  useEffect(() => {
    const sync = () =>
      setCompleted(readLearningProgress().completedSlugs.length);
    sync();
    window.addEventListener(LEARNING_PROGRESS_EVENT, sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener(LEARNING_PROGRESS_EVENT, sync);
      window.removeEventListener("storage", sync);
    };
  }, []);
  function handleQuickClaimSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!claim.trim()) return;
    setPendingClaim(claim.trim());
    router.push("/analyze");
  }
  return (
    <section className="editorial-home" aria-label="CivicLens home">
      <header className="editorial-home-heading">
        <p className="editorial-small-label">Your civic field guide</p>
        <h1>
          A clearer view
          <br />
          of public life.
        </h1>
        <p>
          Understand how government works.
          <br className="editorial-desktop-break" /> Check the evidence behind
          what you hear.
        </p>
      </header>
      <div className="editorial-home-primary">
        <Link
          className="editorial-feature"
          href="/feed"
          aria-label={completed ? "Continue learning" : "Start learning"}
        >
          <div className="editorial-feature-top">
            <span className="editorial-small-label">The learning path</span>
            <BookOpen size={24} aria-hidden="true" />
          </div>
          <h2>
            {completed
              ? "Keep building your civic toolkit."
              : "Start with the fundamentals."}
          </h2>
          <p>
            Short lessons. Clear examples.
            <br />A quick check to make it stick.
          </p>
          <div className="editorial-feature-footer">
            <span>
              {completed
                ? `${completed} lesson${completed === 1 ? "" : "s"} completed on this device`
                : "Begin with separation of powers"}
            </span>
            <span className="editorial-feature-arrow">
              <ArrowRight size={22} aria-hidden="true" />
            </span>
          </div>
        </Link>
        <section
          className="editorial-quick-check"
          aria-labelledby="quick-claim-heading"
        >
          <span className="editorial-small-label">Question the headline</span>
          <h2 id="quick-claim-heading">What’s the claim?</h2>
          <p>
            Bring a civic claim or a bill question. Get context with sources you
            can inspect.
          </p>
          <form
            onSubmit={handleQuickClaimSubmit}
            className="editorial-home-form"
          >
            <label htmlFor="home-claim">Claim text</label>
            <textarea
              id="home-claim"
              value={claim}
              onChange={(event) => setClaim(event.target.value)}
              maxLength={2000}
              placeholder="What does H.R. 82 say about Social Security?"
              rows={3}
              required
            />
            <button
              className="button"
              type="submit"
              aria-label="Analyze typed claim"
              disabled={!claim.trim()}
            >
              Check this claim <ArrowRight size={18} aria-hidden="true" />
            </button>
          </form>
          <Link href="/analyze" className="editorial-text-link">
            Try an example <ArrowUpRight size={15} aria-hidden="true" />
          </Link>
        </section>
      </div>
      <section className="editorial-reading" aria-labelledby="reading-heading">
        <div className="editorial-section-heading">
          <div>
            <p className="editorial-small-label">Good places to begin</p>
            <h2 id="reading-heading">Follow your curiosity.</h2>
          </div>
          <span>Three ways in</span>
        </div>
        <div className="editorial-reading-list">
          {topics.map((topic) => (
            <Link
              href={topic.href}
              key={topic.number}
              className="editorial-reading-row"
            >
              <span className="editorial-reading-number">{topic.number}</span>
              <div>
                <h3>{topic.title}</h3>
                <p>{topic.body}</p>
              </div>
              <ArrowUpRight size={20} aria-hidden="true" />
            </Link>
          ))}
        </div>
      </section>
      <div className="editorial-home-tools" aria-label="Explore CivicLens">
        <Link href="/bills">
          <FileText size={18} aria-hidden="true" />
          Browse bills
          <ArrowRight size={16} aria-hidden="true" />
        </Link>
        <Link href="/district">
          <MapPin size={18} aria-hidden="true" />
          Find your district
          <ArrowRight size={16} aria-hidden="true" />
        </Link>
        <Link href="/analyze">
          <Search size={18} aria-hidden="true" />
          Analyze a claim
          <ArrowRight size={16} aria-hidden="true" />
        </Link>
      </div>
    </section>
  );
}
