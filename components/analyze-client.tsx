"use client";

import { FormEvent, useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  CheckCircle2,
  Loader2,
  SendHorizontal,
  Sparkles,
  X,
} from "lucide-react";
import { billHref, getJson, normalizeAnalyzeResponse } from "./api";
import { takePendingClaim } from "../lib/client-claim-handoff";
import { CitationDrawer } from "./citation-drawer";
import { TopIdentity } from "./mobile/TopIdentity";
import type { AnalysisResult, AnalyzeResponse } from "./types";

const examples = [
  {
    label: "H.R. 82",
    claim: "What does H.R. 82 say about Social Security?",
  },
  {
    label: "Gas prices",
    claim: "Gas prices rose because of one president alone.",
  },
  {
    label: "School lunches",
    claim: "A school lunch bill would fund meals for students.",
  },
];

export function AnalyzeClient() {
  const [claim, setClaim] = useState(() =>
    takePendingClaim().trim().slice(0, 2000),
  );
  const [response, setResponse] = useState<AnalyzeResponse | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [lastSubmittedClaim, setLastSubmittedClaim] = useState("");
  const [requestStatus, setRequestStatus] = useState("");
  const activeRequest = useRef<AbortController | null>(null);
  const generation = useRef(0);
  const claimRef = useRef<HTMLTextAreaElement>(null);

  useEffect(
    () => () => {
      generation.current += 1;
      activeRequest.current?.abort();
    },
    [],
  );

  const result = response?.result;
  const trimmedClaim = claim.trim();
  const remaining = 2000 - claim.length;
  const canSubmit =
    trimmedClaim.length >= 10 &&
    claim.length <= 2000 &&
    !loading &&
    trimmedClaim !== lastSubmittedClaim;
  const analysisText =
    result?.verdictSummary ||
    result?.studentExplanation ||
    result?.oneSentenceAnswer ||
    result?.refusalReason ||
    "";
  const isLiveAi =
    response?.mode === "live" &&
    !response.warnings?.some((warning) => /fallback/i.test(warning));
  const truthAssessment = getTruthAssessment(result);

  function invalidateRequest() {
    generation.current += 1;
    activeRequest.current?.abort();
    activeRequest.current = null;
    setLoading(false);
  }

  function editClaim(nextClaim: string) {
    invalidateRequest();
    setClaim(nextClaim);
    setResponse(null);
    setError("");
    setLastSubmittedClaim("");
    setRequestStatus("");
  }

  function cancelAnalysis() {
    invalidateRequest();
    setRequestStatus("Analysis stopped. Your question is unchanged.");
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canSubmit || activeRequest.current) return;
    const controller = new AbortController();
    activeRequest.current = controller;
    const requestGeneration = ++generation.current;
    setLoading(true);
    setError("");
    setResponse(null);
    setRequestStatus("");

    try {
      const payload = await getJson<AnalyzeResponse>("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ claim: trimmedClaim }),
        signal: controller.signal,
      });
      // An aborted fetch may still resolve in a mock or intermediary. Only the
      // latest, unchanged question may publish an answer or clear pending state.
      if (generation.current !== requestGeneration || controller.signal.aborted)
        return;
      const normalized = normalizeAnalyzeResponse(payload);
      if (!normalized.result)
        throw new Error("No answer was returned. Try your question again.");
      setResponse(normalized);
      setLastSubmittedClaim(trimmedClaim);
      setRequestStatus(
        "Analysis ready. Review the answer and its sources below.",
      );
    } catch (reason) {
      if (generation.current !== requestGeneration || controller.signal.aborted)
        return;
      setError(
        reason instanceof Error
          ? reason.message
          : "Claim check is unavailable right now.",
      );
    } finally {
      if (generation.current === requestGeneration) {
        activeRequest.current = null;
        setLoading(false);
      }
    }
  }

  return (
    <section className="page-shell analyze-simple" aria-label="Analyze bills">
      <TopIdentity
        title="CivicLens"
        subtitle="Claim checks in plain English."
      />

      <form className="panel analyze-simple-card" onSubmit={handleSubmit}>
        <div className="analyze-simple-header">
          <div>
            <p className="eyebrow">Analyze</p>
            <h1>Ask about a bill or claim</h1>
          </div>
          <span className={`analyze-live-pill${isLiveAi ? " live" : ""}`}>
            {loading ? (
              <Loader2 aria-hidden="true" size={16} />
            ) : (
              <Sparkles aria-hidden="true" size={16} />
            )}
            {isLiveAi ? "Live AI" : loading ? "Checking" : "Ready to check"}
          </span>
        </div>

        <label className="field-label" htmlFor="claim">
          Claim or bill question
          <span>Example: What does H.R. 82 say about Social Security?</span>
        </label>
        <div className={`analyze-simple-input${loading ? " is-checking" : ""}`}>
          <textarea
            ref={claimRef}
            aria-label="Claim or bill question"
            id="claim"
            className="textarea"
            value={claim}
            minLength={10}
            maxLength={2000}
            onChange={(event) => {
              editClaim(event.target.value);
            }}
            placeholder="Type the claim or bill question here..."
            required
          />
          <div className="analyze-simple-actions">
            <span
              className={`status-pill ${remaining < 0 ? "danger" : ""}`}
              aria-live="polite"
            >
              {remaining} left
            </span>
            {claim ? (
              <button
                className="button ghost"
                type="button"
                onClick={() => {
                  editClaim("");
                  claimRef.current?.focus();
                }}
                aria-label="Clear text"
              >
                <X aria-hidden="true" size={18} />
                Clear
              </button>
            ) : null}
            <button
              className="button yellow analyze-simple-submit"
              type="submit"
              disabled={!canSubmit}
            >
              {loading ? "Analyzing" : "Analyze"}
              {loading ? (
                <Loader2 aria-hidden="true" size={19} />
              ) : (
                <SendHorizontal aria-hidden="true" size={19} />
              )}
            </button>
          </div>
        </div>

        <div className="analyze-simple-examples" aria-label="Examples">
          {examples.map((example) => (
            <button
              key={example.claim}
              type="button"
              className="example-chip"
              aria-pressed={claim === example.claim}
              onClick={() => {
                editClaim(example.claim);
                claimRef.current?.focus();
              }}
            >
              {example.label}
            </button>
          ))}
        </div>
      </form>

      {loading ? (
        <section
          className="panel analyze-simple-result"
          aria-live="polite"
          aria-busy="true"
        >
          <p className="eyebrow">AI analysis</p>
          <h2>Reading sources...</h2>
          <p>
            Checking the available source context. Demo answers are labeled.
            Changing your question stops this request.
          </p>
          <button
            className="button secondary"
            type="button"
            onClick={cancelAnalysis}
          >
            Cancel analysis
          </button>
        </section>
      ) : null}
      <p className="sr-only" role="status">
        {requestStatus}
      </p>

      {error ? (
        <p className="empty-state" role="alert">
          {error}
        </p>
      ) : null}

      {result ? (
        <section
          className="panel analyze-simple-result"
          aria-labelledby="plain-answer-heading"
        >
          <div className="analyze-simple-result-top">
            <div>
              <p className="eyebrow">AI analysis</p>
              <h2 id="plain-answer-heading">Plain-English answer</h2>
            </div>
            <span className={`analyze-live-pill${isLiveAi ? " live" : ""}`}>
              <CheckCircle2 aria-hidden="true" size={16} />
              {isLiveAi
                ? "Live AI"
                : response?.mode === "demo"
                  ? "Demo fallback"
                  : "Fallback answer"}
            </span>
          </div>
          {!isLiveAi ? (
            <p className="subtle">
              This fallback answer was prepared without live AI. Check the cited
              record.
            </p>
          ) : null}
          <p className="analyze-simple-answer">
            {analysisText || "The sources did not settle this claim."}
          </p>

          {truthAssessment.showScore && result.truthVerdict ? (
            <p className="analyze-simple-claim">
              <span>Truth verdict</span>
              {formatTruthVerdict(result.truthVerdict)}
            </p>
          ) : truthAssessment.label ? (
            <p className="analyze-simple-claim">
              <span>Assessment</span>
              {truthAssessment.label}
            </p>
          ) : null}

          {truthAssessment.showScore && result.claimChecks?.length ? (
            <div
              className="analyze-simple-checks"
              aria-label="Analysis breakdown"
            >
              {result.claimChecks.map((check, index) => (
                <p
                  className="analyze-simple-claim"
                  key={`${check.claim}-${index}`}
                >
                  <span>{formatTruthVerdict(check.verdict)}</span>
                  {check.explanation}
                </p>
              ))}
            </div>
          ) : null}

          {result.normalizedClaim ? (
            <p className="analyze-simple-claim">
              <span>Checked</span>
              {result.normalizedClaim}
            </p>
          ) : null}

          {response?.citations?.length ? (
            <div className="analyze-simple-sources" aria-label="Sources">
              <span>
                {response.citations.length} source
                {response.citations.length === 1 ? "" : "s"}
              </span>
              {response.citations.map((citation, index) =>
                citation.url ? (
                  <a
                    key={citation.id ?? citation.url ?? index}
                    href={citation.url}
                    target="_blank"
                    rel="noreferrer"
                  >
                    {citation.title || `Source ${index + 1}`}
                  </a>
                ) : (
                  <strong key={citation.id ?? index}>
                    {citation.title || `Source ${index + 1}`}
                  </strong>
                ),
              )}
            </div>
          ) : null}

          {response?.citations?.length ? (
            <CitationDrawer citations={response.citations} />
          ) : null}
          {response?.relatedBills?.length ? (
            <div className="analyze-simple-links">
              {response.relatedBills.map((bill) => (
                <Link
                  key={`${bill.congress}-${bill.type}-${bill.number}`}
                  className="button secondary"
                  href={billHref(bill)}
                >
                  View {bill.type?.toUpperCase()} {bill.number}
                </Link>
              ))}
            </div>
          ) : null}
        </section>
      ) : null}
    </section>
  );
}

function formatTruthVerdict(verdict: string) {
  return verdict
    .split("_")
    .map((word) => `${word.slice(0, 1).toUpperCase()}${word.slice(1)}`)
    .join(" ");
}

export function getTruthAssessment(result: AnalysisResult | undefined): {
  showScore: boolean;
  label?: string;
} {
  if (!result) {
    return { showScore: false };
  }

  const informationalQuestion = /^\s*(?:what|who|why|how|where|when)\b/i.test(
    result.normalizedClaim || "",
  );
  if (result.status === "refused") {
    return { showScore: false, label: "Request not scored" };
  }
  if (informationalQuestion) {
    return { showScore: false, label: "Information request" };
  }

  const insufficientEvidence = [
    "insufficient",
    "not_enough_info",
    "not_applicable",
  ].includes(result.evidenceStatus || "");
  if (insufficientEvidence || result.truthVerdict === "unverifiable") {
    return {
      showScore: false,
      label: "Official sources do not settle this claim",
    };
  }

  return {
    showScore:
      Boolean(result.truthVerdict) &&
      (!result.status || result.status === "answered") &&
      (!result.evidenceStatus ||
        result.evidenceStatus === "grounded" ||
        result.evidenceStatus === "partial"),
  };
}
