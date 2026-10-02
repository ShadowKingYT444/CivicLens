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
  const dialogRef = useRef<HTMLDialogElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const titleId = useId();
  const usableCitations = citations?.filter(Boolean) ?? [];

  useEffect(() => {
    if (!open) return;
    dialogRef.current?.showModal();
    closeButtonRef.current?.focus();
    const previousOverflow = document.body.style.overflow;
    const trigger = triggerRef.current;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previousOverflow;
      trigger?.focus();
    };
  }, [open]);

  return (
    <>
      <button
        type="button"
        className="citation-button"
        ref={triggerRef}
        aria-haspopup="dialog"
        onClick={() => setOpen(true)}
        disabled={usableCitations.length === 0}
      >
        {label} ({usableCitations.length})
      </button>

      {open ? (
        <dialog ref={dialogRef} className="drawer-backdrop" aria-labelledby={titleId}
          onCancel={() => setOpen(false)} onClose={() => setOpen(false)}
          onMouseDown={(event) => { if (event.target === event.currentTarget) setOpen(false); }}>
          <aside
            className="drawer"
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
        </dialog>
      ) : null}
    </>
  );
}
