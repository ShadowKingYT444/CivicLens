"use client";

import { useEffect, useMemo, useState } from "react";
import { ArrowRight, CalendarDays, FileText, Users, Vote } from "lucide-react";
import { CitationDrawer } from "./citation-drawer";
import { getJson, normalizeBillResponse } from "./api";
import { AssetIcon } from "./AssetIcon";
import { getBillCategoryAsset } from "../lib/bill-category-assets";
import { BillProgressPath } from "./mobile/BillProgressPath";
import { Pill } from "./mobile/Pill";
import { SourcesCarousel } from "./mobile/SourcesCarousel";
import type { BillDetail } from "./types";

const stageIndex: Record<string, number> = {
  introduced: 0,
  committee: 1,
  house: 2,
  senate: 3,
  president: 3,
  law: 4,
};

export function BillDetailView({
  congress,
  type,
  number,
}: {
  congress: string;
  type: string;
  number: string;
}) {
  const [bill, setBill] = useState<(BillDetail & { mode?: string }) | null>(
    null,
  );
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError("");
    setBill(null);

    getJson<unknown>(`/api/bills/${congress}/${type}/${number}`)
      .then((payload) => {
        if (active) setBill(normalizeBillResponse(payload));
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

  const actions = useMemo(() => {
    return [...(bill?.actions ?? [])].sort((a, b) =>
      String(b.date ?? b.actionDate ?? "").localeCompare(
        String(a.date ?? a.actionDate ?? ""),
      ),
    );
  }, [bill?.actions]);

  const label = `${bill?.congress ?? congress}th Congress - ${String(bill?.type ?? type).toUpperCase()} ${
    bill?.number ?? number
  }`;
  const title =
    bill?.simpleTitle ?? bill?.shortTitle ?? bill?.title ?? "Bill detail";
  const officialTitle = bill?.title ?? bill?.shortTitle ?? title;
  const oneLineSummary =
    bill?.oneLineSummary ??
    bill?.summary ??
    "Summary unavailable from current sources.";
  const currentStep = stageIndex[String(bill?.stage ?? "").toLowerCase()] ?? 1;
  const categoryAsset = getBillCategoryAsset([
    title,
    ...(bill?.subjects ?? []),
  ]);

  if (loading) {
    return <p className="empty-state">Loading bill details...</p>;
  }

  if (error) {
    return (
      <p className="empty-state" role="alert">
        {error}
      </p>
    );
  }

  return (
    <section className="page-shell" aria-label="Bill detail">
      {bill?.mode === "demo" ? (
        <p className="status-pill warning">
          Sample record — not a live update.
        </p>
      ) : null}
      <article className="bill-hero-card">
        <div className="bill-hero-copy">
          <Pill tone="teal">Current step</Pill>
          <p className="eyebrow">{label}</p>
          <h1>{title}</h1>
          <p>{oneLineSummary}</p>
        </div>
        <AssetIcon
          asset={categoryAsset}
          alt=""
          decorative
          size={172}
          priority
        />
        <BillProgressPath currentStep={currentStep} />
        <div className="action-row">
          <CitationDrawer citations={bill?.citations} />
          <span className="status-pill good">
            {bill?.currentStatus ?? "Status unavailable"}
          </span>
          {bill?.subjects?.slice(0, 3).map((subject) => (
            <span className="tag" key={subject}>
              {subject}
            </span>
          ))}
        </div>
      </article>

      <section
        className="info-row-list bill-action-deck"
        aria-label="Bill details in simple words"
      >
        <details className="info-row bill-action-card" open>
          <summary className="bill-action-summary">
            <span className="info-icon" aria-hidden="true">
              <FileText />
            </span>
            <div>
              <h2 className="section-title">Why it matters</h2>
              <p>{bill?.inSimpleWords ?? oneLineSummary}</p>
            </div>
            <ArrowRight
              className="bill-action-chevron"
              aria-hidden="true"
              size={22}
            />
          </summary>
          <div className="bill-action-panel">
            <p>
              This section stays with what official sources can support. It does
              not tell students what position to take.
            </p>
            <div className="bill-quest-strip" aria-label="Reading checkpoints">
              <span>Plain words</span>
              <span>Source backed</span>
              <span>Neutral</span>
            </div>
          </div>
        </details>

        <details className="info-row bill-action-card">
          <summary className="bill-action-summary">
            <span className="info-icon" aria-hidden="true">
              <Users />
            </span>
            <div>
              <h2 className="section-title">Who is affected</h2>
              <p>
                {bill?.whoIsAffected ??
                  "The returned official summary does not identify a specific affected group."}
              </p>
            </div>
            <ArrowRight
              className="bill-action-chevron"
              aria-hidden="true"
              size={22}
            />
          </summary>
          <div className="bill-action-panel">
            <p>
              Treat this as a scope clue, not a prediction. If the official
              record does not name a group, CivicLens says so.
            </p>
          </div>
        </details>

        <details className="info-row bill-action-card">
          <summary className="bill-action-summary">
            <span className="info-icon" aria-hidden="true">
              <Vote />
            </span>
            <div>
              <h2 className="section-title">What changes</h2>
              <p>{bill?.whatChanges ?? oneLineSummary}</p>
            </div>
            <ArrowRight
              className="bill-action-chevron"
              aria-hidden="true"
              size={22}
            />
          </summary>
          <div className="bill-action-panel">
            <p>
              Check this against cited records and public-law text when
              available.
            </p>
            <div className="bill-quest-strip" aria-label="Evidence checkpoints">
              <span>Record</span>
              <span>Text</span>
              <span>Decision</span>
            </div>
          </div>
        </details>
      </section>

      <details className="official-summary panel">
        <summary>Official summary</summary>
        <p>{bill?.summary ?? "No official summary was returned."}</p>
        {officialTitle !== title ? (
          <p className="subtle">{officialTitle}</p>
        ) : null}
      </details>

      <details className="panel form-grid bill-sources-details" open>
        <summary className="bill-section-summary">
          <div className="section-row">
            <h2 className="section-title">Sources</h2>
            <Pill tone="blue">{bill?.citations?.length ?? 0}</Pill>
          </div>
          <ArrowRight
            className="bill-action-chevron"
            aria-hidden="true"
            size={22}
          />
        </summary>
        <SourcesCarousel citations={bill?.citations} />
        <CitationDrawer
          citations={bill?.citations}
          label="Open source drawer"
        />
      </details>

      <section className="panel form-grid">
        <div className="section-row">
          <div>
            <p className="eyebrow">Timeline</p>
            <h2 className="section-title">Official actions</h2>
          </div>
          <span className="status-pill">{actions.length} actions</span>
        </div>

        {actions.length ? (
          <ol className="timeline">
            {actions.slice(0, 6).map((action, index) => (
              <li
                className="timeline-item"
                key={`${action.date ?? action.actionDate}-${index}`}
              >
                <span className="timeline-marker" aria-hidden="true" />
                <div className="timeline-content">
                  <time>
                    <CalendarDays aria-hidden="true" size={14} />{" "}
                    {action.date ?? action.actionDate ?? "Date unavailable"}
                  </time>
                  <p>
                    {action.text ??
                      action.description ??
                      "Action text unavailable"}
                  </p>
                </div>
              </li>
            ))}
          </ol>
        ) : (
          <p className="empty-state">No action timeline returned.</p>
        )}
      </section>
    </section>
  );
}
