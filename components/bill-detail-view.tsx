"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, ArrowUpRight } from "lucide-react";
import { CitationDrawer } from "./citation-drawer";
import { getJson, normalizeBillResponse } from "./api";
import type { BillDetail } from "./types";

type BillRecord = BillDetail & { mode?: string };

export function BillDetailView({
  congress,
  type,
  number,
}: {
  congress: string;
  type: string;
  number: string;
}) {
  const [bill, setBill] = useState<BillRecord | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError("");
    setBill(null);
    getJson<unknown>(`/api/bills/${congress}/${type}/${number}`)
      .then((payload) => {
        if (active) setBill(normalizeBillResponse(payload) as BillRecord);
      })
      .catch((reason) => {
        if (active)
          setError(
            reason instanceof Error
              ? reason.message
              : "Bill detail unavailable.",
          );
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [congress, number, type]);

  const actions = useMemo(
    () =>
      [...(bill?.actions ?? [])].sort((a, b) =>
        String(b.date ?? b.actionDate ?? "").localeCompare(
          String(a.date ?? a.actionDate ?? ""),
        ),
      ),
    [bill?.actions],
  );
  const title =
    bill?.simpleTitle ?? bill?.shortTitle ?? bill?.title ?? "Bill detail";
  const summary =
    bill?.oneLineSummary ??
    bill?.summary ??
    "A summary is not available from the returned records.";

  return (
    <section
      className="editorial-page editorial-bill-detail"
      aria-label="Bill detail"
      aria-busy={loading}
    >
      <Link href="/bills" className="editorial-row-link">
        <ArrowLeft size={16} aria-hidden="true" /> All bills
      </Link>
      {loading ? (
        <p className="editorial-empty" role="status">
          Loading bill details…
        </p>
      ) : error ? (
        <p className="editorial-notice" role="alert">
          {error}
        </p>
      ) : (
        <>
          <header className="editorial-detail-header">
            <p className="editorial-kicker">
              {String(bill?.type ?? type).toUpperCase()}{" "}
              {bill?.number ?? number} · {bill?.congress ?? congress}th Congress
            </p>
            <h1>{title}</h1>
            <p className="editorial-lead">{summary}</p>
            <div className="editorial-bill-meta">
              <span>{bill?.currentStatus ?? "Status unavailable"}</span>
              {bill?.subjects?.slice(0, 3).map((subject) => (
                <span key={subject}>{subject}</span>
              ))}
            </div>
            <div className="action-row">
              <CitationDrawer citations={bill?.citations} />
            </div>
          </header>
          {bill?.mode === "demo" ? (
            <p className="editorial-notice">
              Sample record · This curated example is not a live update. Check
              the dated source records before relying on its status.
            </p>
          ) : null}

          <div className="editorial-detail-grid">
            <div>
              <section className="editorial-section">
                <p className="editorial-kicker">01 / Context</p>
                <h2>Why it matters</h2>
                <p>{bill?.inSimpleWords ?? summary}</p>
              </section>
              <section className="editorial-section">
                <p className="editorial-kicker">02 / Scope</p>
                <h2>Who is affected</h2>
                <p>
                  {bill?.whoIsAffected ??
                    "The returned official record does not identify specific affected groups."}
                </p>
              </section>
              <section className="editorial-section">
                <p className="editorial-kicker">03 / Change</p>
                <h2>What changes</h2>
                <p>{bill?.whatChanges ?? summary}</p>
              </section>
              <details className="editorial-section editorial-disclosure">
                <summary>Official summary</summary>
                <p>{bill?.summary ?? "No official summary was returned."}</p>
                {bill?.title && bill.title !== title ? (
                  <p className="subtle">Official title: {bill.title}</p>
                ) : null}
              </details>
            </div>
            <aside className="editorial-section" aria-label="Official actions">
              <p className="editorial-kicker">The timeline</p>
              <h2>Official actions</h2>
              {actions.length ? (
                <ol className="editorial-timeline">
                  {actions.map((action, index) => (
                    <li key={`${action.date ?? action.actionDate}-${index}`}>
                      <time>
                        {action.date ?? action.actionDate ?? "Date unavailable"}
                      </time>
                      <p>
                        {action.text ??
                          action.description ??
                          "Action text unavailable"}
                      </p>
                    </li>
                  ))}
                </ol>
              ) : (
                <p className="subtle">No action timeline was returned.</p>
              )}
            </aside>
          </div>
          <section
            className="editorial-section"
            aria-labelledby="bill-sources-heading"
          >
            <p className="editorial-kicker">Read the record</p>
            <h2 id="bill-sources-heading">Sources</h2>
            {bill?.citations?.length ? (
              <ol className="editorial-sources">
                {bill.citations.map((citation, index) => (
                  <li key={citation.id ?? citation.url ?? index}>
                    <div>
                      {citation.url ? (
                        <a href={citation.url} target="_blank" rel="noreferrer">
                          {citation.title ?? `Source ${index + 1}`}{" "}
                          <ArrowUpRight aria-hidden="true" size={16} />
                        </a>
                      ) : (
                        <strong>
                          {citation.title ?? `Source ${index + 1}`}
                        </strong>
                      )}
                      <p className="subtle">
                        {[citation.sourceType, citation.sourceDate]
                          .filter(Boolean)
                          .join(" · ")}
                      </p>
                      {citation.excerpt ? <p>{citation.excerpt}</p> : null}
                    </div>
                  </li>
                ))}
              </ol>
            ) : (
              <p className="subtle">
                No citations were returned for this record.
              </p>
            )}
          </section>
        </>
      )}
    </section>
  );
}
