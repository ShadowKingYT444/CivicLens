"use client";

import { FormEvent, useEffect, useState } from "react";
import Link from "next/link";
import { ArrowRight, FileText, Filter, Search, Star } from "lucide-react";
import { billHref, demoCitations, getJson, normalizeSearchResponse } from "./api";
import { AssetIcon } from "./AssetIcon";
import { assets } from "../lib/asset-manifest";
import { getBillCategoryAsset } from "../lib/bill-category-assets";
import { CitationDrawer } from "./citation-drawer";
import { BillHeroCard } from "./mobile/BillHeroCard";
import { Pill } from "./mobile/Pill";
import { SourcesCarousel } from "./mobile/SourcesCarousel";
import { TopIdentity } from "./mobile/TopIdentity";
import type { Citation, SearchResult } from "./types";

const examples = [
  { label: "H.R. 82", href: "/bills/118/hr/82" },
  { label: "Social Security", href: "/bills/118/hr/82" },
  { label: "Public Law 118-273", href: "/bills/118/hr/82" },
];

type BillCardResult = SearchResult & {
  citation?: Citation;
  congress?: number | string;
  billType?: string;
  number?: number | string;
  summary?: string;
  excerpt?: string;
  mode?: string;
  quest?: string;
};

const billStarterCitations: Citation[] = [
  {
    id: "hr82-congress-card",
    sourceType: "congress",
    title: "H.R.82 - Social Security Fairness Act of 2023",
    url: "https://www.congress.gov/bill/118th-congress/house-bill/82",
    sourceDate: "2025-01-05",
    excerpt:
      "Congress.gov identifies H.R. 82 as the Social Security Fairness Act of 2023 and lists its official actions.",
  },
  {
    id: "congress-about-bills-card",
    sourceType: "congress",
    title: "Congress.gov: About Bills",
    url: "https://www.congress.gov/help/learn-about-the-legislative-process/bills",
    excerpt:
      "Congress.gov explains bill records, actions, sponsors, summaries, and related legislative information.",
  },
  ...demoCitations,
];

const defaultBillCards: BillCardResult[] = [
  {
    title: "Social Security Fairness Act of 2023",
    href: "/bills/118/hr/82",
    type: "bill",
    snippet: "Follow one bill from introduction to public law with official citations attached.",
    quest: "Quest 1",
    citation: billStarterCitations[0],
    bill: { congress: 118, type: "hr", number: 82, title: "Social Security Fairness Act of 2023" },
  },
  {
    title: "Action timeline challenge",
    href: "/bills/118/hr/82",
    type: "timeline",
    snippet: "Spot the difference between introduced, passed, and became law.",
    quest: "Status streak",
    citation: billStarterCitations[1],
    bill: { congress: 118, type: "hr", number: 82, title: "Social Security Fairness Act of 2023" },
  },
  {
    title: "Source detective round",
    href: "/bills/118/hr/82",
    type: "source",
    snippet: "Open the bill and match each plain-language claim to a source card.",
    quest: "Source +10",
    citation: billStarterCitations[0],
    bill: { congress: 118, type: "hr", number: 82, title: "Social Security Fairness Act of 2023" },
  },
];

function cardTitle(result: BillCardResult) {
  return result.title ?? result.label ?? result.bill?.title ?? "Bill result";
}

function cardSnippet(result: BillCardResult) {
  return result.snippet ?? result.summary ?? result.excerpt ?? result.bill?.latestAction ?? "";
}

function cardHref(result: BillCardResult) {
  if (result.href) return result.href;
  if (result.bill) return billHref(result.bill);
  if (result.congress && result.billType && result.number) {
    return `/bills/${result.congress}/${result.billType}/${result.number}`;
  }
  return result.url ?? "";
}

function uniqueCards(cards: BillCardResult[]) {
  const seen = new Set<string>();
  return cards.filter((card) => {
    const key = cardHref(card) || card.url || cardTitle(card);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export function BillsSearch() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<BillCardResult[]>(defaultBillCards);
  const [loading, setLoading] = useState(false);
  const [usingDefaults, setUsingDefaults] = useState(true);
  const [message, setMessage] = useState("Bill quests to try");

  useEffect(() => {
    let active = true;

    async function loadDefaultBills() {
      try {
        const payload = await getJson<unknown>("/api/bills/recent");
        const liveCards = uniqueCards(normalizeSearchResponse(payload) as BillCardResult[]).filter(
          (result) => result.mode === "live",
        );
        if (active && liveCards.length > 0) {
          setResults(liveCards.slice(0, 5));
          setUsingDefaults(false);
          setMessage("Recent bill cards from Congress.gov");
        }
      } catch {
        if (active) {
          setResults(defaultBillCards);
          setUsingDefaults(true);
        }
      }
    }

    loadDefaultBills();

    return () => {
      active = false;
    };
  }, []);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!query.trim()) return;

    setLoading(true);
    setMessage("");

    try {
      const payload = await getJson<unknown>(`/api/search?q=${encodeURIComponent(query.trim())}`);
      const normalized = normalizeSearchResponse(payload) as BillCardResult[];
      const nextResults = normalized.length ? normalized : defaultBillCards;
      setResults(nextResults);
      setUsingDefaults(normalized.length === 0);
      setMessage(normalized.length ? "Here are simple bill matches." : "No exact match yet. Try a quest below.");
    } catch (reason) {
      setResults(defaultBillCards);
      setUsingDefaults(true);
      setMessage(reason instanceof Error ? reason.message : "Bill search is unavailable right now.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="page-shell" aria-label="Bills made simple">
      <TopIdentity title="Bills" subtitle="Search bills and read cited summaries." />

      <form className="bill-search-row" onSubmit={handleSubmit}>
        <label className="sr-only" htmlFor="bill-search">
          Search bills
        </label>
        <div className="claim-input-link">
          <Search aria-hidden="true" size={24} />
          <input
            id="bill-search"
            className="input"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search H.R. 1234 or school lunch"
          />
        </div>
        <button className="button secondary" type="submit" disabled={loading} aria-label="Search bills">
          {loading ? <Search aria-hidden="true" size={22} /> : <Filter aria-hidden="true" size={22} />}
        </button>
      </form>

      <div className="analyze-examples" aria-label="Example bill links">
        {examples.map((example) => (
          <Link key={example.label} className="example-chip" href={example.href}>
            {example.label}
          </Link>
        ))}
      </div>

      <BillHeroCard />

      <section className="info-row-list bill-action-deck" aria-label="Bill summary actions">
        <details className="info-row bill-action-card">
          <summary className="bill-action-summary">
            <span className="info-icon" aria-hidden="true">
              <FileText />
            </span>
            <div>
              <h3>Why it matters</h3>
              <p>Turn a long title into one grounded idea.</p>
            </div>
            <ArrowRight className="bill-action-chevron" aria-hidden="true" size={22} />
          </summary>
          <div className="bill-action-panel">
            <p>
              Bills can affect programs, money, rules, or rights. CivicLens keeps the first pass neutral: what the
              source says, who may be affected, and what is still unknown.
            </p>
            <div className="bill-quest-strip" aria-label="Reading rewards">
              <span>Plain words</span>
              <span>Evidence check</span>
              <span>No advice</span>
            </div>
          </div>
        </details>

        <details className="info-row bill-action-card">
          <summary className="bill-action-summary">
            <span className="info-icon" aria-hidden="true">
              <AssetIcon asset={assets.billTypes.schoolMeals} alt="" decorative size={44} />
            </span>
            <div>
              <h3>What changes</h3>
              <p>Compare the summary with the bill path.</p>
            </div>
            <ArrowRight className="bill-action-chevron" aria-hidden="true" size={22} />
          </summary>
          <div className="bill-action-panel">
            <p>
              The most useful clue is usually an official action, summary, or public-law text. A claim is stronger
              when it points to one of those records instead of a slogan.
            </p>
            <div className="bill-quest-strip" aria-label="Bill path checkpoints">
              <span>Introduced</span>
              <span>Voted</span>
              <span>Law?</span>
            </div>
          </div>
        </details>

        <details className="info-row bill-action-card">
          <summary className="bill-action-summary">
            <span className="info-icon" aria-hidden="true">
              <Search size={24} />
            </span>
            <div>
              <h3>Sources</h3>
              <p>Citations stay attached.</p>
            </div>
            <Pill tone="blue">{billStarterCitations.length}</Pill>
          </summary>
          <div className="bill-action-panel">
            <SourcesCarousel citations={billStarterCitations} />
            <CitationDrawer citations={billStarterCitations} label="Open sources" />
          </div>
        </details>
      </section>

      <section className="panel form-grid" aria-live="polite">
        <div className="section-row">
          <h2 className="section-title">{message}</h2>
          <span className="status-pill">{usingDefaults ? "Demo deck" : `${results.length} items`}</span>
        </div>

        {results.length ? (
          <div className="trending-list">
            {results.map((result, index) => {
              const href = cardHref(result);
              const title = cardTitle(result);
              const snippet = cardSnippet(result);
              const asset = getBillCategoryAsset(`${title} ${snippet}`);
              return (
                <article className="trending-bill" key={`${href}-${index}`}>
                  <AssetIcon asset={asset} alt="" decorative size={62} />
                  <div>
                    {result.quest ? <span className="bill-quest-badge">{result.quest}</span> : null}
                    <h3>{title}</h3>
                    {snippet ? <p>{snippet}</p> : null}
                  </div>
                  {href ? (
                    <Link className="inline-cta" href={href} aria-label={`Open ${title}`}>
                      <ArrowRight aria-hidden="true" size={22} />
                    </Link>
                  ) : (
                    <Star aria-hidden="true" size={22} />
                  )}
                </article>
              );
            })}
          </div>
        ) : (
          <p className="empty-state">Search results will appear here.</p>
        )}
      </section>
    </section>
  );
}
