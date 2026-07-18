"use client";

import { useEffect, useRef, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  CalendarDays,
  CheckCircle2,
  FileText,
  Landmark,
  Search,
  ShieldCheck,
  Sparkles,
  Star,
  Users,
} from "lucide-react";
import { AssetIcon } from "../AssetIcon";
import { CitationDrawer } from "../citation-drawer";
import { assets } from "../../lib/asset-manifest";
import { BillProgressPath } from "./BillProgressPath";
import { Pill } from "./Pill";
import type { Citation } from "../types";

export type BillHeroCardProps = {
  title?: string;
  summary?: string;
  href?: string;
  asset?: string;
  eyebrow?: string;
  reward?: string;
  refLabel?: string;
  keyPoints?: string[];
  whyItMatters?: string;
  whatChanges?: string;
  officialSummary?: string;
  issueArea?: string;
  whoItAffects?: string[];
  latestAction?: string;
  latestActionDate?: string;
  currentStepLabel?: string;
  sourceLabel?: string;
  sourceCount?: number;
  citations?: Citation[];
  currentStep?: number;
  priority?: boolean;
  index?: number;
  total?: number;
};

const slideLabels = [
  "Cover",
  "Why it matters",
  "What changes",
  "Who it affects",
  "Official summary",
  "Source and status",
  "Timeline",
  "Key takeaways",
] as const;

const stepNames = ["Introduced", "Committee", "House", "Senate", "Law"];

function compactText(value: string, maxLength: number) {
  const text = value.replace(/\s+/g, " ").trim();
  if (text.length <= maxLength) return text;
  return `${text.slice(0, maxLength - 1).trim()}...`;
}

function stepName(index: number) {
  return stepNames[Math.min(Math.max(Math.round(index), 0), stepNames.length - 1)] ?? "Current step";
}

function firstCitation(citations?: Citation[]) {
  return citations?.find(Boolean);
}

export function BillHeroCard({
  title = "Social Security Fairness Act of 2023",
  summary = "Pick a bill, unlock its path, and keep every claim tied to an official source.",
  asset = assets.ui.source,
  eyebrow = "Featured bill",
  reward = "Source check +10",
  refLabel = "H.R. 82",
  keyPoints,
  whyItMatters,
  whatChanges,
  officialSummary,
  whoItAffects,
  latestAction,
  latestActionDate,
  currentStepLabel,
  sourceLabel = "Official sources attached",
  sourceCount = 2,
  citations,
  currentStep = 1,
  priority = false,
  index,
  total,
}: BillHeroCardProps) {
  const [activeSlide, setActiveSlide] = useState(0);
  const trackRef = useRef<HTMLDivElement | null>(null);
  const slideRefs = useRef<Array<HTMLElement | null>>([]);
  const points =
    keyPoints?.filter(Boolean).slice(0, 3) ??
    [
      "Read the latest official action first.",
      "Check the source before repeating a claim.",
      "Open details for citations and gaps.",
    ];
  const affected = whoItAffects?.filter(Boolean).slice(0, 4) ?? [
    "Students",
    "Families",
    "Federal programs",
    "Communities",
  ];
  const citation = firstCitation(citations);
  const stage = currentStepLabel || stepName(currentStep);
  const shortSummary = compactText(summary, 168);
  const shortWhy = compactText(whyItMatters || summary, 170);
  const shortChanges = compactText(whatChanges || points[0] || summary, 170);
  const shortOfficial = compactText(officialSummary || summary, 220);
  const slideCount = slideLabels.length;

  useEffect(() => {
    setActiveSlide(0);
    trackRef.current?.scrollTo({ left: 0 });
  }, [title]);

  function goToSlide(nextSlide: number) {
    const bounded = Math.min(Math.max(nextSlide, 0), slideCount - 1);
    setActiveSlide(bounded);
    slideRefs.current[bounded]?.scrollIntoView({
      block: "nearest",
      inline: "start",
      behavior: "auto",
    });
  }

  function handleSlideScroll() {
    const track = trackRef.current;
    if (!track) return;

    const nextSlide = Math.round(track.scrollLeft / Math.max(track.clientWidth, 1));
    if (nextSlide !== activeSlide) {
      setActiveSlide(Math.min(Math.max(nextSlide, 0), slideCount - 1));
    }
  }

  return (
    <article
      className="bill-hero-card bill-reel-card"
      aria-label={`${title} information slides`}
      aria-roledescription="carousel"
    >
      <div className="bill-slide-track" ref={trackRef} onScroll={handleSlideScroll}>
        <section
          className="bill-info-slide bill-slide-cover"
          ref={(node) => {
            slideRefs.current[0] = node;
          }}
          aria-label="Cover"
        >
          <div className="bill-slide-topline">
            <Pill tone="teal">{refLabel}</Pill>
            <Pill tone="yellow">{reward}</Pill>
            <span>{activeSlide + 1}/{slideCount}</span>
          </div>

          <div className="bill-cover-layout">
            <div className="bill-hero-copy">
              <p className="bill-ref-label">{eyebrow}</p>
              <h2>{title}</h2>
              <p>{shortSummary}</p>
            </div>
            <AssetIcon asset={asset} alt="" decorative size={160} priority={priority} />
          </div>

          <p className="bill-slide-nudge">
            Swipe for details <ArrowRight aria-hidden="true" size={18} />
          </p>
        </section>

        <section
          className="bill-info-slide"
          ref={(node) => {
            slideRefs.current[1] = node;
          }}
          aria-label="Why it matters"
        >
          <div className="bill-slide-icon teal">
            <ShieldCheck aria-hidden="true" />
          </div>
          <h3>Why it matters</h3>
          <p>{shortWhy}</p>
          <div className="bill-mini-callout">
            <strong>The goal:</strong>
            <span>Understand the real-world issue without political spin.</span>
          </div>
        </section>

        <section
          className="bill-info-slide"
          ref={(node) => {
            slideRefs.current[2] = node;
          }}
          aria-label="What changes"
        >
          <div className="bill-slide-icon yellow">
            <FileText aria-hidden="true" />
          </div>
          <h3>What changes</h3>
          <p>{shortChanges}</p>
          <div className="bill-mini-callout yellow">
            <CheckCircle2 aria-hidden="true" size={22} />
            <span>In short: match the claim to the official bill record.</span>
          </div>
        </section>

        <section
          className="bill-info-slide"
          ref={(node) => {
            slideRefs.current[3] = node;
          }}
          aria-label="Who it affects"
        >
          <div className="bill-slide-icon teal">
            <Users aria-hidden="true" />
          </div>
          <h3>Who it affects</h3>
          <p>Groups to watch in the official record.</p>
          <ul className="bill-audience-list" aria-label="Affected groups to watch">
            {affected.map((group) => (
              <li key={group}>
                <Users aria-hidden="true" size={18} />
                <span>{group}</span>
              </li>
            ))}
          </ul>
        </section>

        <section
          className="bill-info-slide bill-summary-slide"
          ref={(node) => {
            slideRefs.current[4] = node;
          }}
          aria-label="Official summary"
        >
          <div className="bill-slide-icon teal">
            <FileText aria-hidden="true" />
          </div>
          <h3>Official summary</h3>
          <p>{shortOfficial}</p>
          <span className="bill-slide-landscape" aria-hidden="true">
            <Landmark />
          </span>
        </section>

        <section
          className="bill-info-slide"
          ref={(node) => {
            slideRefs.current[5] = node;
          }}
          aria-label="Source and status"
        >
          <div className="bill-slide-icon blue">
            <Search aria-hidden="true" />
          </div>
          <h3>Source & status</h3>
          <div className="bill-source-card">
            <strong>{sourceLabel}</strong>
            <span>
              {sourceCount} {sourceCount === 1 ? "source" : "sources"} attached
            </span>
            <span>{stage}</span>
            {citation?.title ? <small>{compactText(citation.title, 78)}</small> : null}
          </div>
          <CitationDrawer citations={citations} label="Source details" />
        </section>

        <section
          className="bill-info-slide"
          ref={(node) => {
            slideRefs.current[6] = node;
          }}
          aria-label="Timeline"
        >
          <div className="bill-slide-icon purple">
            <CalendarDays aria-hidden="true" />
          </div>
          <h3>Timeline</h3>
          <BillProgressPath currentStep={currentStep} />
          <ol className="bill-timeline-list" aria-label="Bill timeline summary">
            <li>
              <CheckCircle2 aria-hidden="true" size={18} />
              <span>{stage}</span>
            </li>
            <li>
              <CalendarDays aria-hidden="true" size={18} />
              <span>{latestActionDate || "Date unavailable"}</span>
            </li>
            {latestAction ? (
              <li>
                <Sparkles aria-hidden="true" size={18} />
                <span>{compactText(latestAction, 96)}</span>
              </li>
            ) : null}
          </ol>
        </section>

        <section
          className="bill-info-slide"
          ref={(node) => {
            slideRefs.current[7] = node;
          }}
          aria-label="Key takeaways"
        >
          <div className="bill-slide-icon yellow">
            <Star aria-hidden="true" />
          </div>
          <h3>Key takeaways</h3>
          <ul className="bill-key-points" aria-label="Key points">
            {points.map((point) => (
              <li key={point}>
                <CheckCircle2 aria-hidden="true" size={19} />
                <span>{compactText(point, 112)}</span>
              </li>
            ))}
          </ul>
          <p className="bill-slide-finish">Stay informed. Civic knowledge helps everyone.</p>
        </section>
      </div>

      <button
        className="bill-slide-arrow previous"
        type="button"
        onClick={() => goToSlide(activeSlide - 1)}
        disabled={activeSlide === 0}
        aria-label="Previous bill info slide"
      >
        <ArrowLeft aria-hidden="true" size={22} />
      </button>
      <button
        className="bill-slide-arrow next"
        type="button"
        onClick={() => goToSlide(activeSlide + 1)}
        disabled={activeSlide === slideCount - 1}
        aria-label="Next bill info slide"
      >
        <ArrowRight aria-hidden="true" size={22} />
      </button>

      <div className="lesson-dots bill-slide-dots" aria-label={`${slideLabels[activeSlide]} slide`}>
        {slideLabels.map((label, slideIndex) => (
          <button
            key={label}
            type="button"
            className={slideIndex === activeSlide ? "active" : ""}
            onClick={() => goToSlide(slideIndex)}
            aria-label={`Show ${label}`}
            aria-current={slideIndex === activeSlide ? "step" : undefined}
          />
        ))}
      </div>

      {typeof index === "number" && typeof total === "number" ? (
        <span className="sr-only">{`Bill ${index + 1} of ${total}`}</span>
      ) : null}
    </article>
  );
}
