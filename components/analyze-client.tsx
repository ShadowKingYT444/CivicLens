"use client";

import { FormEvent, useEffect, useState } from "react";
import Link from "next/link";
import {
  CheckCircle2,
  Loader2,
  SendHorizontal,
  Sparkles,
  X,
} from "lucide-react";
import { billHref, getJson, normalizeAnalyzeResponse } from "./api";
import { peekPendingClaim, takePendingClaim } from "../lib/client-claim-handoff";
import { TopIdentity } from "./mobile/TopIdentity";
import { FramingFlags } from "./framing-flags";
import { QuizCard } from "./quiz-card";
import type { AnalysisResult, AnalyzeResponse } from "./types";

const examples = [
  {
    label: "H.R. 82",
    claim: "What does H.R. 82 in the 118th Congress say about Social Security?",
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
  const [claim, setClaim] = useState(() => peekPendingClaim().trim().slice(0, 2000));
  const [response, setResponse] = useState<AnalyzeResponse | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [lastSubmittedClaim, setLastSubmittedClaim] = useState("");
  const [llmConfigured, setLlmConfigured] = useState<boolean | null>(null);

  useEffect(() => {
    let active = true;
    takePendingClaim();
    getJson<{ llmConfigured?: boolean }>("/api/health")
      .then((health) => { if (active) setLlmConfigured(Boolean(health.llmConfigured)); })
      .catch(() => { if (active) setLlmConfigured(false); });
    return () => { active = false; };
  }, []);

  const result = response?.result;
  const trimmedClaim = claim.trim();
  const remaining = 2000 - claim.length;
  const canSubmit =
    trimmedClaim.length >= 10 &&
    claim.length <= 2000 &&
    !loading &&
    llmConfigured !== null &&
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

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canSubmit) return;

    setLoading(true);
    setError("");
    setResponse(null);

    try {
      const payload = await getJson<AnalyzeResponse>("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ claim: trimmedClaim }),
      });
      setResponse(normalizeAnalyzeResponse(payload));
      setLastSubmittedClaim(trimmedClaim);
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : "Claim check is unavailable right now.",
      );
    } finally {
      setLoading(false);
    }
  }

  function resetForEdit() {
    setResponse(null);
    setError("");
    setLastSubmittedClaim("");
  }

  function clearClaim() {
    setClaim("");
    setResponse(null);
    setError("");
    setLastSubmittedClaim("");
  }

  function applyExample(nextClaim: string) {
    setClaim(nextClaim);
    setResponse(null);
    setError("");
    setLastSubmittedClaim("");
  }

  return (
    <section className="page-shell analyze-simple" aria-label="Analyze bills">
      <TopIdentity title="CivicLens" subtitle="Check the evidence. Understand the context." />

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
            {loading ? "Checking" : isLiveAi ? "Live AI" : llmConfigured ? "AI connected" : llmConfigured === null ? "Checking mode" : "Guided mode"}
          </span>
        </div>

        <label className="field-label" htmlFor="claim">
          Claim or bill question
          <span>Include the Congress number: H.R. 82, 118th Congress.</span>
        </label>
        <div className={`analyze-simple-input${loading ? " is-checking" : ""}`}>
          <textarea
            id="claim"
            className="textarea"
            value={claim}
            minLength={10}
            maxLength={2000}
            onChange={(event) => {
              setClaim(event.target.value);
              if (response) resetForEdit();
            }}
            placeholder="Type the claim or bill question here..."
            required
            disabled={loading || llmConfigured === null}
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
                onClick={clearClaim}
                aria-label="Clear text"
                disabled={loading}
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
              disabled={loading || llmConfigured === null}
              onClick={() => applyExample(example.claim)}
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
          <p className="eyebrow">Source check</p>
          <h2>Reading sources...</h2>
          <p>
            Retrieving source context and checking what the evidence can support.
          </p>
        </section>
      ) : null}

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
              <p className="eyebrow">Source check</p>
              <h2 id="plain-answer-heading">Plain-English answer</h2>
            </div>
            <span className={`analyze-live-pill${isLiveAi ? " live" : ""}`}>
              <CheckCircle2 aria-hidden="true" size={16} />
              {isLiveAi ? "Live AI" : "Guided fallback"}
            </span>
          </div>
          <p className="analyze-simple-answer">
            {analysisText || "The sources did not settle this claim."}
          </p>
          <p className="analysis-provenance">
            {isLiveAi ? "Live AI response checked against source excerpts" : "Template-based explanation; no live AI response"}
            {" · "}{response?.sourceMode === "live" ? "Live source retrieval" : "Curated source context"}.
            {" "}A citation link is a starting point for checking the answer.
          </p>
          {response?.warnings?.length ? (
            <details className="analysis-detail">
              <summary>How this answer was produced</summary>
              <ul>{response.warnings.map((warning, index) => <li key={index}>{warning}</li>)}</ul>
            </details>
          ) : null}

          {result.studentExplanation && result.studentExplanation !== analysisText ? (
            <p className="analysis-explanation">{result.studentExplanation}</p>
          ) : null}

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
                  {check.citationIds.length ? <small>Sources: {check.citationIds.join(", ")}</small> : null}
                </p>
              ))}
            </div>
          ) : null}

          {result.whatOfficialSourcesSay?.length ? (
            <details className="analysis-detail" open>
              <summary>What the source context says</summary>
              <ul>{result.whatOfficialSourcesSay.map((point, index) => <li key={index}>{point}</li>)}</ul>
            </details>
          ) : null}
          {result.keyContext?.length ? (
            <details className="analysis-detail">
              <summary>Context to keep in mind</summary>
              <ul>{result.keyContext.map((point, index) => <li key={index}>{point}</li>)}</ul>
            </details>
          ) : null}
          {result.contextGaps?.length ? (
            <section className="analysis-context-gaps" aria-label="Evidence gaps">
              <h3>What remains uncertain</h3>
              <ul>{result.contextGaps.map((point, index) => <li key={index}>{point}</li>)}</ul>
            </section>
          ) : null}
          {result.framingFlags?.length ? (
            <details className="analysis-detail">
              <summary>Look closely at the wording</summary>
              <FramingFlags flags={result.framingFlags} />
            </details>
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
            <details className="analysis-detail">
              <summary>Read source excerpts</summary>
              {response.citations.map((citation, index) => (
                <article className="analysis-source-excerpt" key={citation.id ?? index}>
                  <h3>{citation.title}</h3>
                  <p className="subtle">{citation.id}{citation.sourceDate ? ` · ${citation.sourceDate}` : ""}</p>
                  <p>{citation.excerpt || "Open this source to inspect its context."}</p>
                </article>
              ))}
            </details>
          ) : null}

          {result.status === "answered" && result.quiz?.length ? (
            <section className="analysis-knowledge-checks" aria-label="Practice this explanation">
              <h3>Can you apply it?</h3>
              {result.quiz.map((quiz, index) => <QuizCard key={`${lastSubmittedClaim}-${quiz.id}-${index}`} quiz={quiz} sourceId={quiz.id} />)}
              <Link className="button secondary" href="/feed">Keep learning</Link>
            </section>
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
