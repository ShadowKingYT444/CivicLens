"use client";

import { FormEvent, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ArrowRight, Loader2, X } from "lucide-react";
import { billHref, getJson, normalizeAnalyzeResponse } from "./api";
import { takePendingClaim } from "../lib/client-claim-handoff";
import { CitationDrawer } from "./citation-drawer";
import type { AnalysisResult, AnalyzeResponse } from "./types";

const examples = [
  { label: "H.R. 82", claim: "What does H.R. 82 say about Social Security?" },
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
      <header className="analyze-intro">
        <p className="eyebrow">Understand the evidence</p>
        <h1>Ask about a bill or claim</h1>
        <p>A clear explanation, with the sources behind it.</p>
      </header>

      <div className="analyze-workspace">
        <form className="panel analyze-simple-card" onSubmit={handleSubmit}>
          <label className="field-label" htmlFor="claim">
            Claim or bill question
          </label>
          <p className="subtle" id="claim-help">
            Ask one specific question. Use at least 10 characters.
          </p>
          <div
            className={`analyze-simple-input${loading ? " is-checking" : ""}`}
          >
            <textarea
              ref={claimRef}
              id="claim"
              className="textarea"
              value={claim}
              minLength={10}
              maxLength={2000}
              onChange={(event) => editClaim(event.target.value)}
              placeholder="What does H.R. 82 say about Social Security?"
              aria-describedby="claim-help claim-count"
              required
            />
            <div className="analyze-simple-actions">
              <span className="analyze-character-count" id="claim-count">
                {claim.length.toLocaleString()} / 2,000
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
                  <X aria-hidden="true" size={16} /> Clear
                </button>
              ) : null}
              <button
                className="button yellow analyze-simple-submit"
                type="submit"
                disabled={!canSubmit}
              >
                {loading ? "Analyzing" : "Analyze"}
                {loading ? (
                  <Loader2 aria-hidden="true" size={18} />
                ) : (
                  <ArrowRight aria-hidden="true" size={18} />
                )}
              </button>
            </div>
          </div>
          <div className="analyze-example-group">
            <p className="eyebrow">Try a question</p>
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
                  <ArrowRight aria-hidden="true" size={14} />
                </button>
              ))}
            </div>
          </div>
          <p className="analysis-mode-note">
            Demo answers are labeled. Read the source records before relying on
            an answer.
          </p>
        </form>

        <div className="analysis-answer-region">
          <p className="sr-only" role="status">
            {requestStatus}
          </p>
          {loading ? (
            <section
              className="panel analyze-simple-result analysis-stage"
              aria-live="polite"
              aria-busy="true"
            >
              <Loader2
                aria-hidden="true"
                size={22}
                className="analysis-loading-icon"
              />
              <p className="eyebrow">Checking your question</p>
              <h2>Looking for source context</h2>
              <p>
                Your question stays editable. Changing it will stop this
                request.
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
          {error ? (
            <section
              className="panel analyze-simple-result analysis-error"
              role="alert"
            >
              <p className="eyebrow">Analysis unavailable</p>
              <h2>Your question is still here</h2>
              <p>{error}</p>
              <p className="subtle">
                Select Analyze to retry, or edit your question.
              </p>
            </section>
          ) : null}
          {!loading && !result && !error ? (
            <section className="analyze-empty">
              <p className="eyebrow">Read beyond the headline</p>
              <h2>Start with a question.</h2>
              <p>
                The answer will appear here, alongside the official records it
                refers to.
              </p>
              {requestStatus ? (
                <p className="analysis-request-status">{requestStatus}</p>
              ) : null}
            </section>
          ) : null}
          {result ? (
            <section
              className="panel analyze-simple-result"
              aria-labelledby="plain-answer-heading"
            >
              <div className="analyze-simple-result-top">
                <div>
                  <p className="eyebrow">The explanation</p>
                  <h2 id="plain-answer-heading">Plain-English answer</h2>
                </div>
                <span className={`analyze-live-pill${isLiveAi ? " live" : ""}`}>
                  {isLiveAi
                    ? "Live AI"
                    : response?.mode === "demo"
                      ? "Demo fallback"
                      : "Fallback answer"}
                </span>
              </div>
              {!isLiveAi ? (
                <p className="analysis-mode-note">
                  This fallback answer was prepared without live AI. Check the
                  cited record.
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
              <div className="analysis-evidence">
                <div className="analysis-evidence-heading">
                  <p className="eyebrow">Check the record</p>
                  <CitationDrawer citations={response?.citations} />
                </div>
                {response?.citations?.length ? (
                  <ol
                    className="analyze-simple-sources"
                    aria-label="Cited records"
                  >
                    {response.citations.map((citation, index) => (
                      <li key={citation.id ?? citation.url ?? index}>
                        {citation.url ? (
                          <a
                            href={citation.url}
                            target="_blank"
                            rel="noreferrer"
                          >
                            {citation.title || `Source ${index + 1}`}
                          </a>
                        ) : (
                          <strong>
                            {citation.title || `Source ${index + 1}`}
                          </strong>
                        )}
                      </li>
                    ))}
                  </ol>
                ) : (
                  <p className="subtle">
                    No sources were returned for this answer.
                  </p>
                )}
              </div>
              {response?.warnings?.length ? (
                <details className="analysis-provider-details">
                  <summary>Answer limitations</summary>
                  <ul>
                    {response.warnings.map((warning, index) => (
                      <li key={index}>{warning}</li>
                    ))}
                  </ul>
                </details>
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
                      <ArrowRight aria-hidden="true" size={16} />
                    </Link>
                  ))}
                </div>
              ) : null}
            </section>
          ) : null}
        </div>
      </div>
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
