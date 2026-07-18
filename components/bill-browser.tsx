"use client";

import Image from "next/image";
import { FormEvent, useEffect, useRef, useState } from "react";
import {
  ChevronLeft,
  ChevronRight,
  Search,
  Sparkles,
  X,
} from "lucide-react";
import { billHref, getJson, normalizeSearchResponse } from "./api";
import { BillHeroCard } from "./mobile/BillHeroCard";
import { Pill } from "./mobile/Pill";
import { getBillCategoryAsset } from "../lib/bill-category-assets";
import { learningPathAssets } from "../lib/learning-path-assets";
import type { Citation, SearchResult } from "./types";

type RawBillResult = SearchResult & {
  citation?: Citation;
  citations?: Citation[];
  congress?: number | string;
  billType?: string;
  number?: number | string;
  summary?: string;
  excerpt?: string;
  mode?: string;
  quest?: string;
  impactLabel?: string;
  issueArea?: string;
  hook?: string;
  keyPoints?: Array<string | { text?: string }>;
  currentStep?:
    | string
    | {
        label?: string;
        date?: string;
        text?: string;
      };
  whyItMatters?: string | { text?: string };
  whatChanges?: string | { text?: string };
  sourceCount?: number;
};

type BillDeckCard = {
  id: string;
  title: string;
  href: string;
  refLabel: string;
  eyebrow: string;
  reward: string;
  summary: string;
  whyItMatters: string;
  whatChanges: string;
  officialSummary: string;
  issueArea: string;
  whoItAffects: string[];
  latestAction: string;
  latestActionDate?: string;
  currentStepLabel: string;
  keyPoints: string[];
  sourceLabel: string;
  sourceCount: number;
  asset: string;
  currentStep: number;
  mode?: string;
  citations: Citation[];
};

const officialBillsCitation: Citation = {
  id: "congress-about-bills-card",
  sourceType: "official",
  title: "Congress.gov: About Bills",
  url: "https://www.congress.gov/help/learn-about-the-legislative-process/bills",
  excerpt:
    "Congress.gov explains bill and resolution records, including text, actions, sponsors, committees, summaries, and related activity.",
};

const reconciliationCitation: Citation = {
  id: "hr1-reconciliation-card",
  sourceType: "congress",
  title: "H.R.1 - Reconciliation Act",
  url: "https://www.congress.gov/bill/119th-congress/house-bill/1",
  sourceDate: "2025-07-04",
  excerpt:
    "Congress.gov lists H.R. 1 as Public Law No. 119-21 with tax, spending, and debt-limit changes summarized by CRS.",
};

const immigrationCitation: Citation = {
  id: "s5-laken-riley-card",
  sourceType: "congress",
  title: "S.5 - Laken Riley Act",
  url: "https://www.congress.gov/bill/119th-congress/senate-bill/5",
  sourceDate: "2025-01-29",
  excerpt:
    "Congress.gov lists S. 5 as Public Law No. 119-1 with detention and immigration-enforcement provisions summarized by CRS.",
};

const fundingCitation: Citation = {
  id: "hr1968-appropriations-card",
  sourceType: "congress",
  title: "H.R.1968 - Full-Year Continuing Appropriations and Extensions Act, 2025",
  url: "https://www.congress.gov/bill/119th-congress/house-bill/1968",
  sourceDate: "2025-03-15",
  excerpt:
    "Congress.gov lists H.R. 1968 as Public Law No. 119-4 providing continuing FY2025 appropriations and extensions.",
};

const starterCitations = [reconciliationCitation, immigrationCitation, fundingCitation, officialBillsCitation];

const defaultBillDeck: BillDeckCard[] = [
  {
    id: "hr1-reconciliation",
    title: "Reconciliation Act, Public Law 119-21",
    href: "/bills/119/hr/1",
    refLabel: "H.R. 1",
    eyebrow: "High impact: budget and taxes",
    reward: "Source +10",
    summary:
      "A budget-and-tax card for tracking how reconciliation bundles tax, spending, and debt-limit changes.",
    whyItMatters: "This bill shows how Congress can package tax, spending, and debt-limit changes in one law.",
    whatChanges: "It changes tax rules, federal spending provisions, and debt-limit rules across programs.",
    officialSummary:
      "Congress.gov and CRS describe tax, spending, debt-limit, agency, and program changes across the federal government.",
    issueArea: "Budget and taxes",
    whoItAffects: ["Taxpayers", "Federal programs", "Future budgets", "The economy"],
    latestAction: "Became Public Law No. 119-21.",
    latestActionDate: "Jul 4, 2025",
    currentStepLabel: "Became law",
    keyPoints: [
      "Changes tax and spending rules across federal programs.",
      "Raises the statutory debt limit according to the CRS summary.",
      "Use the official action record before repeating viral claims.",
    ],
    sourceLabel: "Congress.gov budget and tax sources",
    sourceCount: 2,
    asset: getBillCategoryAsset("reconciliation budget tax spending debt"),
    currentStep: 4,
    citations: [reconciliationCitation],
  },
  {
    id: "s5-laken-riley",
    title: "Laken Riley Act",
    href: "/bills/119/s/5",
    refLabel: "S. 5",
    eyebrow: "High impact: immigration enforcement",
    reward: "Source +10",
    summary:
      "A law card for detention rules and state lawsuit authority in immigration enforcement.",
    whyItMatters:
      "This bill is a concrete example of Congress changing immigration-enforcement duties and lawsuit authority.",
    whatChanges:
      "It adds detention rules for specified cases and lets states sue over certain enforcement decisions.",
    officialSummary:
      "Congress.gov and CRS summarize detention requirements and state lawsuit authority in immigration enforcement.",
    issueArea: "Immigration",
    whoItAffects: ["Non-U.S. nationals", "States", "DHS", "Courts"],
    latestAction: "Became Public Law No. 119-1.",
    latestActionDate: "Jan 29, 2025",
    currentStepLabel: "Became law",
    keyPoints: [
      "Requires DHS detention for specified non-U.S. nationals.",
      "Lets states sue over certain enforcement decisions.",
      "Keeps the explanation neutral: source, status, and gaps.",
    ],
    sourceLabel: "Congress.gov immigration source context",
    sourceCount: 2,
    asset: getBillCategoryAsset("immigration detention enforcement state lawsuit"),
    currentStep: 4,
    citations: [immigrationCitation],
  },
  {
    id: "hr1968-appropriations",
    title: "Full-Year Continuing Appropriations and Extensions Act, 2025",
    href: "/bills/119/hr/1968",
    refLabel: "H.R. 1968",
    eyebrow: "High impact: government funding",
    reward: "Source +10",
    summary:
      "A funding-law card for how Congress keeps agencies operating and extends programs.",
    whyItMatters:
      "Funding bills can affect whether agencies keep operating and whether time-limited programs continue.",
    whatChanges:
      "It continues FY2025 federal funding and extends selected health, flood insurance, cybersecurity, and TANF items.",
    officialSummary:
      "Congress.gov and CRS describe continuing appropriations for agencies and extensions for selected programs.",
    issueArea: "Appropriations",
    whoItAffects: ["Federal agencies", "Program users", "Communities", "Public services"],
    latestAction: "Became Public Law No. 119-4.",
    latestActionDate: "Mar 15, 2025",
    currentStepLabel: "Became law",
    keyPoints: [
      "Provides continuing FY2025 appropriations.",
      "Prevented a shutdown after the prior continuing resolution expired.",
      "Extends selected programs in health, flood insurance, cybersecurity, and TANF.",
    ],
    sourceLabel: "Congress.gov appropriations source context",
    sourceCount: 2,
    asset: getBillCategoryAsset("appropriations government funding public health medicare cybersecurity"),
    currentStep: 4,
    citations: [fundingCitation],
  },
];

function cleanText(value: unknown, fallback = "") {
  if (typeof value !== "string" && typeof value !== "number") return fallback;
  return String(value).replace(/\s+/g, " ").trim() || fallback;
}

function richText(value: unknown, fallback = "") {
  if (typeof value === "string" || typeof value === "number") return cleanText(value, fallback);
  if (value && typeof value === "object" && "text" in value) {
    return cleanText((value as { text?: unknown }).text, fallback);
  }
  return fallback;
}

function clampText(value: string, maxLength: number) {
  if (value.length <= maxLength) return value;
  return `${value.slice(0, maxLength - 1).trim()}...`;
}

function cardTitle(result: RawBillResult) {
  return cleanText(result.title ?? result.label ?? result.bill?.title, "Bill result");
}

function cardSnippet(result: RawBillResult) {
  return cleanText(result.hook ?? result.snippet ?? result.summary ?? result.excerpt ?? result.bill?.latestAction);
}

function cardHref(result: RawBillResult) {
  if (result.href) return result.href;
  if (result.bill) return billHref(result.bill);
  if (result.congress && result.billType && result.number) {
    return `/bills/${result.congress}/${result.billType}/${result.number}`;
  }
  return result.url ?? "/bills";
}

function billLabel(result: RawBillResult) {
  const bill = result.bill;
  const congress = bill?.congress ?? result.congress;
  const type = bill?.type ?? result.billType;
  const number = bill?.number ?? result.number;
  if (congress && type && number) return `${String(type).toUpperCase()} ${number} - ${congress}th`;
  return cleanText(result.type, "Bill card");
}

function inferStep(text: string) {
  if (/\b(public law|became law|signed by the president|enacted)\b/i.test(text)) return 4;
  if (/\b(senate|presented to president|cleared for president)\b/i.test(text)) return 3;
  if (/\b(house passed|passed house|passed\/agreed|passed)\b/i.test(text)) return 2;
  if (/\b(committee|referred|reported)\b/i.test(text)) return 1;
  return 0;
}

function keyPointsFor(result: RawBillResult, snippet: string) {
  const richPoints = result.keyPoints?.map((point) => richText(point)).filter(Boolean).slice(0, 4) ?? [];
  if (richPoints.length > 0) return richPoints;

  const points = [
    snippet ? `Latest source clue: ${clampText(snippet, 108)}` : "Start with the latest official action.",
    "Open the detail page before treating the status as settled.",
    "CivicLens keeps this neutral: source, status, and gaps.",
  ];

  return points;
}

function currentStepText(result: RawBillResult, fallback: string) {
  return richText(result.currentStep, fallback);
}

function currentStepLabel(result: RawBillResult, fallback: string) {
  if (result.currentStep && typeof result.currentStep === "object" && "label" in result.currentStep) {
    return cleanText(result.currentStep.label, fallback);
  }
  return fallback;
}

function currentStepDate(result: RawBillResult) {
  if (result.currentStep && typeof result.currentStep === "object" && "date" in result.currentStep) {
    return formatShortDate(result.currentStep.date);
  }
  return "";
}

function formatShortDate(value: unknown) {
  const text = cleanText(value);
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(text);
  if (!match) return text;

  const date = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(date);
}

function affectedGroupsFor(text: string) {
  const haystack = text.toLowerCase();

  if (/\b(budget|tax|spending|appropriation|debt|reconciliation)\b/.test(haystack)) {
    return ["Taxpayers", "Federal programs", "Future budgets", "The economy"];
  }
  if (/\b(immigration|border|detain|non-u\.?s\.?)\b/.test(haystack)) {
    return ["Immigrants", "States", "Federal agencies", "Communities"];
  }
  if (/\b(health|medicare|medicaid|substance|patients|988)\b/.test(haystack)) {
    return ["Patients", "Health programs", "Providers", "Families"];
  }
  if (/\b(technology|online|cyber|stablecoin|digital|payment)\b/.test(haystack)) {
    return ["Online users", "Companies", "Regulators", "Consumers"];
  }
  if (/\b(education|school|student|lunch)\b/.test(haystack)) {
    return ["Students", "Schools", "Families", "Local programs"];
  }
  if (/\b(defense|armed forces|national security)\b/.test(haystack)) {
    return ["Service members", "Agencies", "Contractors", "Communities"];
  }

  return ["Students", "Families", "Local communities", "Federal programs"];
}

function normalizeDeckCard(result: RawBillResult, index: number): BillDeckCard | null {
  const title = cardTitle(result);
  const href = cardHref(result);
  if (!href) return null;

  const snippet = cardSnippet(result);
  const label = billLabel(result);
  const latestAction = currentStepText(result, snippet || "Latest official action unavailable from this card.");
  const searchText = `${title} ${snippet} ${label} ${result.issueArea ?? ""} ${result.impactLabel ?? ""}`;
  const citations = result.citations?.length ? result.citations : result.citation ? [result.citation] : [];
  const currentStepFallback = inferStep(latestAction) >= 4 ? "Became law" : "Current step";
  const stepLabel = currentStepLabel(result, currentStepFallback);
  const issueArea = cleanText(result.issueArea, "Civic impact");
  const firstSourcePoint = result.keyPoints?.map((point) => richText(point)).find(Boolean);
  const whyItMatters = richText(
    result.whyItMatters,
    snippet ? clampText(snippet, 145) : "Use the official record to understand why this bill matters.",
  );
  const whatChanges = richText(
    result.whatChanges,
    firstSourcePoint ?? "Compare the official summary with the latest action before sharing claims.",
  );

  return {
    id: `${href}-${title}-${index}`,
    title,
    href,
    refLabel: label,
    eyebrow: cleanText(result.impactLabel ?? result.quest, index === 0 ? "Trending bill" : `Trending ${index + 1}`),
    reward: result.mode === "live" ? "Live source" : "High impact",
    summary: snippet
      ? clampText(snippet, 170)
      : "Recent bill card. Open details to inspect available official records and source gaps.",
    whyItMatters,
    whatChanges,
    officialSummary: snippet
      ? clampText(snippet, 210)
      : "The current card does not include a longer official summary. Check attached sources before drawing conclusions.",
    issueArea,
    whoItAffects: affectedGroupsFor(`${searchText} ${whyItMatters} ${whatChanges}`),
    latestAction,
    latestActionDate: currentStepDate(result),
    currentStepLabel: stepLabel,
    keyPoints: keyPointsFor(result, snippet),
    sourceLabel: result.issueArea
      ? `${result.issueArea} source context`
      : result.mode === "live"
        ? "Congress.gov live record"
        : "CivicLens bill source",
    sourceCount: result.sourceCount ?? (citations.length || starterCitations.length),
    asset: getBillCategoryAsset(searchText),
    currentStep: inferStep(`${stepLabel} ${latestAction}`),
    mode: result.mode,
    citations: citations.length ? citations : starterCitations,
  };
}

function uniqueCards(cards: BillDeckCard[]) {
  const seen = new Set<string>();
  return cards.filter((card) => {
    const key = card.href || card.title;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export function BillBrowser() {
  const [cards, setCards] = useState<BillDeckCard[]>(defaultBillDeck);
  const [message, setMessage] = useState("High-impact demo bill deck");
  const [activeIndex, setActiveIndex] = useState(0);
  const [searchOpen, setSearchOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const cardRefs = useRef<Array<HTMLElement | null>>([]);

  useEffect(() => {
    let active = true;

    getJson<unknown>("/api/bills/recent")
      .then((payload) => {
        if (!active) return;
        const normalized = uniqueCards(
          (normalizeSearchResponse(payload) as RawBillResult[])
            .map((result, index) => normalizeDeckCard(result, index))
            .filter((card): card is BillDeckCard => Boolean(card)),
        );
        if (normalized.length > 0) {
          setCards(normalized.slice(0, 8));
          setMessage(
            normalized.some((card) => card.mode === "live")
              ? "Recent high-impact bills from Congress.gov"
              : "High-impact trending bill deck",
          );
        }
      })
      .catch(() => {
        if (active) setMessage("High-impact demo bill deck");
      });

    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    const nodes = cardRefs.current.filter((node): node is HTMLElement => Boolean(node));
    if (!nodes.length) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((entry) => entry.isIntersecting)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
        const index = visible?.target.getAttribute("data-card-index");
        if (index) setActiveIndex(Number(index));
      },
      { threshold: [0.56, 0.72] },
    );

    nodes.forEach((node) => observer.observe(node));

    return () => observer.disconnect();
  }, [cards.length]);

  async function handleSearchSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmed = query.trim();
    if (!trimmed) return;

    setLoading(true);

    try {
      const payload = await getJson<unknown>(`/api/search?q=${encodeURIComponent(trimmed)}`);
      const normalized = uniqueCards(
        (normalizeSearchResponse(payload) as RawBillResult[])
          .map((result, index) => normalizeDeckCard(result, index))
          .filter((card): card is BillDeckCard => Boolean(card)),
      );

      if (normalized.length > 0) {
        setCards(normalized.slice(0, 8));
        setMessage(`Search deck for "${trimmed}"`);
        setActiveIndex(0);
        setSearchOpen(false);
        window.setTimeout(() => cardRefs.current[0]?.scrollIntoView({ block: "start", behavior: "smooth" }), 0);
      } else {
        setMessage("No exact bill match yet. Demo cards are still available.");
      }
    } catch (reason) {
      setMessage(reason instanceof Error ? reason.message : "Bill search is unavailable right now.");
    } finally {
      setLoading(false);
    }
  }

  function scrollToCard(index: number) {
    const nextIndex = Math.min(Math.max(index, 0), cards.length - 1);
    cardRefs.current[nextIndex]?.scrollIntoView({ block: "start", behavior: "smooth" });
    setActiveIndex(nextIndex);
  }

  const activeCard = cards[Math.min(activeIndex, cards.length - 1)] ?? defaultBillDeck[0];

  return (
    <section className="bill-deck-shell learn-shell" aria-label="Bills made simple">
      <header className="duo-learn-topbar bill-deck-topbar">
        <Image className="learn-logo" src={learningPathAssets.logo} alt="CivicLens" width={160} height={42} priority />
        <div className="duo-stat" aria-label="Current bill card">
          <Sparkles aria-hidden="true" size={23} />
          <strong>
            {activeIndex + 1}/{cards.length}
          </strong>
        </div>
        <button
          className="bill-search-toggle"
          type="button"
          aria-label="Search bills"
          aria-expanded={searchOpen}
          onClick={() => setSearchOpen((open) => !open)}
        >
          {searchOpen ? <X aria-hidden="true" size={24} /> : <Search aria-hidden="true" size={24} />}
        </button>
      </header>

      {searchOpen ? (
        <form className="bill-deck-search-panel" onSubmit={handleSearchSubmit}>
          <label className="sr-only" htmlFor="bill-deck-search">
            Search bills
          </label>
          <Search aria-hidden="true" size={22} />
          <input
            id="bill-deck-search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Try H.R. 82 or school lunch"
          />
          <button className="button yellow" type="submit" disabled={loading}>
            {loading ? "Searching" : "Search"}
          </button>
        </form>
      ) : null}

      <div className="bill-feed-heading">
        <h1>Bill feed</h1>
        <p>Learn. Understand. Check sources.</p>
        <div className="lesson-dots bill-feed-dots" aria-label={`Bill ${activeIndex + 1} of ${cards.length}`}>
          {cards.map((card, index) => (
            <button
              key={card.id}
              type="button"
              className={index === activeIndex ? "active" : ""}
              onClick={() => scrollToCard(index)}
              aria-label={`Go to bill ${index + 1}`}
              aria-current={index === activeIndex ? "step" : undefined}
            />
          ))}
        </div>
      </div>

      <div className="bill-deck-status-row" aria-live="polite">
        <Pill tone={activeCard.mode === "live" ? "teal" : "yellow"}>
          {activeCard.mode === "live" ? "Live Congress.gov" : "Demo deck"}
        </Pill>
        <span>{message}</span>
        <span>{activeCard.refLabel}</span>
      </div>

      <div className="bill-snap-deck" aria-label="Trending bill flashcards">
        {cards.map((card, index) => (
          <section
            className={`bill-snap-screen${index === activeIndex ? " active" : ""}`}
            key={card.id}
            data-card-index={index}
            ref={(node) => {
              cardRefs.current[index] = node;
            }}
            aria-label={`Bill ${index + 1} of ${cards.length}: ${card.title}`}
          >
            <BillHeroCard
              title={card.title}
              summary={card.summary}
              asset={card.asset}
              eyebrow={card.eyebrow}
              reward={card.reward}
              refLabel={card.refLabel}
              keyPoints={card.keyPoints}
              whyItMatters={card.whyItMatters}
              whatChanges={card.whatChanges}
              officialSummary={card.officialSummary}
              issueArea={card.issueArea}
              whoItAffects={card.whoItAffects}
              latestAction={card.latestAction}
              latestActionDate={card.latestActionDate}
              currentStepLabel={card.currentStepLabel}
              sourceLabel={card.sourceLabel}
              sourceCount={card.sourceCount}
              citations={card.citations}
              currentStep={card.currentStep}
              priority={index === 0}
              index={index}
              total={cards.length}
            />
          </section>
        ))}
      </div>

      <nav className="bill-deck-controls" aria-label="Bill deck controls">
        <button type="button" onClick={() => scrollToCard(activeIndex - 1)} disabled={activeIndex === 0}>
          <ChevronLeft aria-hidden="true" size={24} />
          <span className="sr-only">Previous bill</span>
        </button>
        <p className="bill-feed-instructions">
          <span>Swipe sideways for details</span>
          <span>Scroll down for next bill</span>
        </p>
        <button type="button" onClick={() => scrollToCard(activeIndex + 1)} disabled={activeIndex >= cards.length - 1}>
          <ChevronRight aria-hidden="true" size={24} />
          <span className="sr-only">Next bill</span>
        </button>
      </nav>
    </section>
  );
}
