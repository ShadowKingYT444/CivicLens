import { CheckCircle2, HelpCircle, Info, Loader2, XCircle } from "lucide-react";
import { AssetIcon } from "../AssetIcon";
import { assets } from "../../lib/asset-manifest";

type ResultTone = "success" | "danger" | "insufficient" | "mixed" | "idle";

export function ResultCard({
  status,
  answer,
  bullets = [],
  loading = false,
  tone,
  variant = "default",
  visualAsset,
  visualAlt,
}: {
  status?: string;
  answer?: string;
  bullets?: string[];
  loading?: boolean;
  tone?: ResultTone;
  variant?: "default" | "scale";
  visualAsset?: string;
  visualAlt?: string;
}) {
  const normalized = `${status ?? ""} ${answer ?? ""}`.toLowerCase();
  const inferredState: ResultTone = normalized.includes("not supported") || normalized.includes("false")
    ? "danger"
    : normalized.includes("insufficient") || normalized.includes("not enough")
      ? "insufficient"
      : normalized.includes("mostly supported") || normalized.includes("supported")
        ? "success"
        : "mixed";
  const state = tone ?? inferredState;
  const Icon = loading
    ? Loader2
    : state === "danger"
      ? XCircle
      : state === "success"
        ? CheckCircle2
        : state === "insufficient"
          ? HelpCircle
          : Info;
  const asset =
    state === "danger"
      ? assets.truthScale.mostlyFalse
      : state === "success"
        ? assets.truthScale.mostlyTrue
        : state === "insufficient"
          ? assets.truthScale.insufficient
          : assets.truthScale.mixed;
  const showEmptyScale =
    !visualAsset && variant === "scale" && (state === "idle" || loading);

  return (
    <section
      className={`result-card result-card-${state} result-card-${variant}${loading ? " result-card-checking" : ""}`}
      aria-label="Analysis result"
      aria-busy={loading || undefined}
      aria-live={loading ? "polite" : undefined}
    >
      <div className="result-visual">
        {showEmptyScale ? (
          <span className="truth-scale-empty" aria-hidden="true">
            <span className="truth-scale-beam" />
            <span className="truth-scale-pan truth-scale-pan-left" />
            <span className="truth-scale-pan truth-scale-pan-right" />
          </span>
        ) : (
          <AssetIcon
            asset={visualAsset ?? asset}
            alt={visualAlt ?? ""}
            decorative={!visualAlt}
            size={variant === "scale" ? 178 : 132}
            priority
          />
        )}
      </div>
      <div className="result-copy">
        <span className="result-status">
          <Icon aria-hidden="true" className={loading ? "result-spinner" : undefined} size={20} />
          {status || "Needs more context"}
        </span>
        <h2 id="result-card-heading">{answer || "Here's what sources say."}</h2>
        {bullets.length ? (
          <ul className="friendly-list">
            {bullets.slice(0, 3).map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        ) : null}
      </div>
    </section>
  );
}
