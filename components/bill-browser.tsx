"use client";

import Link from "next/link";
import { FormEvent, useEffect, useRef, useState } from "react";
import { ArrowUpRight, Search } from "lucide-react";
import { billHref, getJson, normalizeSearchResponse } from "./api";
import { CitationDrawer } from "./citation-drawer";
import type { Citation, SearchResult } from "./types";

type BillResult = SearchResult & {
  id?: string;
  congress?: number | string;
  billType?: string;
  number?: number | string;
  summary?: string;
  excerpt?: string;
  hook?: string;
  mode?: string;
  issueArea?: string;
  citation?: Citation;
  citations?: Citation[];
  currentStep?: string | { label?: string; text?: string; date?: string };
};

type BillRow = {
  id: string;
  title: string;
  href: string;
  reference: string;
  summary: string;
  issueArea?: string;
  action?: string;
  date?: string;
  mode?: string;
  citations: Citation[];
};

function text(value: unknown) {
  return typeof value === "string" || typeof value === "number"
    ? String(value).replace(/\s+/g, " ").trim()
    : "";
}

function rowsFrom(payload: unknown): BillRow[] {
  const parentMode =
    payload && typeof payload === "object" && "mode" in payload
      ? text(payload.mode)
      : "";
  const seen = new Set<string>();
  return (normalizeSearchResponse(payload) as BillResult[]).flatMap(
    (result, index) => {
      const bill = result.bill;
      const congress = bill?.congress ?? result.congress;
      const type = bill?.type ?? result.billType;
      const number = bill?.number ?? result.number;
      const href =
        result.href ??
        (congress && type && number
          ? billHref({ congress, type, number })
          : result.url);
      if (!href || seen.has(href)) return [];
      seen.add(href);
      const step = result.currentStep;
      return [
        {
          id: result.id ?? `${href}-${index}`,
          href,
          title:
            text(result.title ?? result.label ?? bill?.title) || "Bill record",
          reference:
            congress && type && number
              ? `${String(type).toUpperCase()} ${number} · ${congress}th Congress`
              : text(result.type) || "Official record",
          summary: text(
            result.hook ?? result.snippet ?? result.summary ?? result.excerpt,
          ),
          issueArea: result.issueArea,
          action:
            typeof step === "object"
              ? text(step.label ?? step.text)
              : text(step ?? bill?.latestAction),
          date: typeof step === "object" ? step.date : undefined,
          mode: result.mode ?? parentMode,
          citations:
            result.citations ?? (result.citation ? [result.citation] : []),
        },
      ];
    },
  );
}

export function BillBrowser() {
  const [rows, setRows] = useState<BillRow[]>([]);
  const [query, setQuery] = useState("");
  const [searchedQuery, setSearchedQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const requestId = useRef(0);

  useEffect(() => {
    const id = ++requestId.current;
    getJson<unknown>("/api/bills/recent")
      .then((payload) => {
        if (id === requestId.current) setRows(rowsFrom(payload));
      })
      .catch((reason) => {
        if (id === requestId.current)
          setError(
            reason instanceof Error
              ? reason.message
              : "Bill records unavailable. Try a search.",
          );
      })
      .finally(() => {
        if (id === requestId.current) setLoading(false);
      });
    return () => {
      requestId.current += 1;
    };
  }, []);

  async function loadBills(search: string) {
    const id = ++requestId.current;
    setLoading(true);
    setError("");
    try {
      const payload = await getJson<unknown>(
        search
          ? `/api/search?q=${encodeURIComponent(search)}`
          : "/api/bills/recent",
      );
      if (id !== requestId.current) return;
      setRows(rowsFrom(payload));
      setSearchedQuery(search);
    } catch (reason) {
      if (id === requestId.current)
        setError(
          reason instanceof Error
            ? reason.message
            : "Bill search is unavailable. Try again.",
        );
    } finally {
      if (id === requestId.current) setLoading(false);
    }
  }

  function handleSearchSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!loading && query.trim()) void loadBills(query.trim());
  }

  const demoCount = rows.filter((row) => row.mode !== "live").length;

  return (
    <section
      className="editorial-page editorial-bills"
      aria-label="Bills made simple"
    >
      <header className="editorial-page-heading">
        <p className="editorial-kicker">The legislative record</p>
        <h1>Bills, in plain language.</h1>
        <p className="editorial-lead">
          Read what changes, follow the latest action, and check the original
          sources.
        </p>
      </header>

      <form
        className="editorial-search-form"
        onSubmit={handleSearchSubmit}
        role="search"
      >
        <label className="sr-only" htmlFor="bill-deck-search">
          Search bills
        </label>
        <Search aria-hidden="true" size={20} />
        <input
          id="bill-deck-search"
          className="input"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Bill number or topic, e.g. H.R. 82"
          autoComplete="off"
        />
        <button
          className="button"
          type="submit"
          disabled={loading || !query.trim()}
        >
          {loading ? "Searching…" : "Search"}
        </button>
      </form>

      <div className="editorial-list-toolbar" aria-live="polite">
        <h2>
          {searchedQuery
            ? `Results for “${searchedQuery}”`
            : "Explore the record"}
        </h2>
        <span>
          {loading
            ? "Loading records…"
            : `${rows.length} ${rows.length === 1 ? "record" : "records"}`}
        </span>
        {searchedQuery ? (
          <button
            className="button secondary"
            type="button"
            disabled={loading}
            onClick={() => {
              setQuery("");
              void loadBills("");
            }}
          >
            Show recent bills
          </button>
        ) : null}
      </div>
      {error ? (
        <p className="editorial-notice" role="alert">
          {error}
        </p>
      ) : null}
      {!loading && demoCount > 0 ? (
        <p className="editorial-notice">
          {demoCount === rows.length
            ? "Sample records"
            : "Includes sample records"}{" "}
          · Curated examples are labeled below. They are not a live update from
          Congress.
        </p>
      ) : null}
      {!loading && rows.length === 0 && !error ? (
        <div className="editorial-empty">
          <h3>No matching records</h3>
          <p>Try a bill number such as H.R. 82, or use a broader topic.</p>
        </div>
      ) : null}

      <div className="editorial-bill-list" aria-busy={loading}>
        {rows.map((row) => (
          <article className="editorial-bill-row" key={row.id}>
            <div className="editorial-bill-meta">
              <span>{row.reference}</span>
              <span>
                {row.mode === "live" ? "Retrieved record" : "Sample record"}
              </span>
              {row.issueArea ? <span>{row.issueArea}</span> : null}
            </div>
            <div className="editorial-bill-copy">
              <h3>
                <Link href={row.href}>{row.title}</Link>
              </h3>
              {row.summary ? <p>{row.summary}</p> : null}
              {row.action ? (
                <p className="subtle">
                  {row.action}
                  {row.date ? ` · ${row.date}` : ""}
                </p>
              ) : null}
              <div className="action-row">
                <Link className="editorial-row-link" href={row.href}>
                  Read bill <ArrowUpRight size={16} aria-hidden="true" />
                </Link>
                {row.citations.length ? (
                  <CitationDrawer citations={row.citations} />
                ) : null}
              </div>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
