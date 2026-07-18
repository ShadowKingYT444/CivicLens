import type { FramingFlag } from "./types";

function flagLabel(flag: FramingFlag) {
  if (typeof flag === "string") return "Framing note";
  return flag.label || flag.name || flag.type || "Framing note";
}

function severityClass(severity?: string) {
  if (severity === "high") return " high";
  if (severity === "medium") return " warn";
  return "";
}

export function FramingFlags({ flags }: { flags?: FramingFlag[] }) {
  if (!flags || flags.length === 0) {
    return (
      <div className="empty-state">
        No framing flags were returned. Keep checking citations before treating this as settled.
      </div>
    );
  }

  return (
    <ul className="flag-list" aria-label="Framing flags">
      {flags.map((flag, index) => (
        <li
          className={`flag${typeof flag === "string" ? "" : severityClass(flag.severity)}`}
          key={`${flagLabel(flag)}-${index}`}
        >
          <strong>{flagLabel(flag)}</strong>
          <span>
            {typeof flag === "string"
              ? flag
              : flag.explanation || flag.evidence || "Review the wording and missing context."}
          </span>
        </li>
      ))}
    </ul>
  );
}
