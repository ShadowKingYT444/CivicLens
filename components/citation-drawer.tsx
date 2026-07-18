"use client";

import { useEffect, useId, useRef, useState } from "react";
import type { Citation } from "./types";

function citationTitle(citation: Citation, index: number) {
  return citation.title || citation.sourceDocumentId || `Source ${index + 1}`;
}

export function CitationDrawer({
  citations,
  label = "Sources",
}: {
  citations?: Citation[];
  label?: string;
}) {
  const [open, setOpen] = useState(false);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const titleId = useId();
  const usableCitations = citations?.filter(Boolean) ?? [];

  useEffect(() => {
    if (!open) return;
    closeButtonRef.current?.focus();

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [open]);

  return (
    <>
      <button
        type="button"
        className="citation-button"
        onClick={() => setOpen(true)}
        disabled={usableCitations.length === 0}
      >
        {label} ({usableCitations.length})
      </button>

      {open ? (
        <div className="drawer-backdrop" role="presentation" onMouseDown={() => setOpen(false)}>
          <aside
            className="drawer"
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
            onMouseDown={(event) => event.stopPropagation()}
          >
            <div className="drawer-header">
              <h2 id={titleId} className="section-title">
                Sources
              </h2>
              <button
                type="button"
                ref={closeButtonRef}
                className="button secondary"
                onClick={() => setOpen(false)}
              >
                Close
              </button>
            </div>

            {usableCitations.length > 0 ? (
              <ol className="citation-list">
                {usableCitations.map((citation, index) => (
                  <li className="citation-item" key={citation.id ?? citation.url ?? index}>
                    {citation.url ? (
                      <a href={citation.url} target="_blank" rel="noreferrer">
                        {citationTitle(citation, index)}
                      </a>
                    ) : (
                      <strong>{citationTitle(citation, index)}</strong>
                    )}
                    <p className="subtle">
                      {[citation.sourceType, citation.sourceDate].filter(Boolean).join(" - ") ||
                        "Source context"}
                    </p>
                    {citation.excerpt ? <p>{citation.excerpt}</p> : null}
                  </li>
                ))}
              </ol>
            ) : (
              <p className="empty-state">No citations were returned for this item.</p>
            )}
          </aside>
        </div>
      ) : null}
    </>
  );
}
