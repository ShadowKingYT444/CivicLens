"use client";

import { useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
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
  const [state, setState] = useState<"closed" | "open" | "closing">("closed");
  const dialogRef = useRef<HTMLDialogElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const titleId = useId();
  const descriptionId = useId();
  const usableCitations = citations?.filter(Boolean) ?? [];

  function closeDrawer() {
    if (state !== "open" || closeTimer.current) return;
    setState("closing");
    const reducedMotion = window.matchMedia?.(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    closeTimer.current = setTimeout(
      () => {
        dialogRef.current?.close();
        setState("closed");
        triggerRef.current?.focus();
        closeTimer.current = null;
      },
      reducedMotion ? 0 : 160,
    );
  }

  useEffect(() => {
    if (state !== "open") return;
    const dialog = dialogRef.current;
    if (!dialog) return;
    dialog.showModal();
    closeButtonRef.current?.focus();
    // Native showModal makes the background inert. Lock document scrolling as
    // well so a wheel/touch gesture cannot move the underlying reading position.
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [state]);

  useEffect(
    () => () => {
      if (closeTimer.current) clearTimeout(closeTimer.current);
      dialogRef.current?.close();
    },
    [],
  );

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        className="citation-button"
        aria-haspopup="dialog"
        onClick={() => setState("open")}
        disabled={usableCitations.length === 0}
      >
        {label} ({usableCitations.length})
      </button>
      {state !== "closed"
        ? createPortal(
            <dialog
              ref={dialogRef}
              className="drawer-backdrop"
              data-state={state}
              aria-labelledby={titleId}
              aria-describedby={descriptionId}
              onCancel={(event) => {
                event.preventDefault();
                closeDrawer();
              }}
              onClick={(event) => {
                if (event.target === event.currentTarget) closeDrawer();
              }}
              onKeyDown={(event) => {
                if (event.key !== "Tab") return;
                const items = dialogRef.current?.querySelectorAll<HTMLElement>(
                  'button:not([disabled]), a[href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex="0"]',
                );
                if (!items?.length) return;
                const first = items[0];
                const last = items[items.length - 1];
                if (event.shiftKey && document.activeElement === first) {
                  event.preventDefault();
                  last.focus();
                } else if (!event.shiftKey && document.activeElement === last) {
                  event.preventDefault();
                  first.focus();
                }
              }}
            >
              <section className="drawer" data-state={state}>
                <div className="drawer-header">
                  <div>
                    <p className="eyebrow">The official record</p>
                    <h2 id={titleId} className="section-title">
                      Sources
                    </h2>
                  </div>
                  <button
                    ref={closeButtonRef}
                    type="button"
                    className="button secondary drawer-close"
                    onClick={closeDrawer}
                  >
                    <X aria-hidden="true" size={16} /> Close
                  </button>
                </div>
                <p className="subtle" id={descriptionId}>
                  Read the underlying records. Source links open in a new tab.
                </p>
                <ol className="citation-list">
                  {usableCitations.map((citation, index) => (
                    <li
                      className="citation-item"
                      key={citation.id ?? citation.url ?? index}
                    >
                      <span className="citation-number" aria-hidden="true">
                        {String(index + 1).padStart(2, "0")}
                      </span>
                      <div>
                        {citation.url ? (
                          <a
                            href={citation.url}
                            target="_blank"
                            rel="noreferrer"
                          >
                            {citationTitle(citation, index)}
                          </a>
                        ) : (
                          <strong>{citationTitle(citation, index)}</strong>
                        )}
                        <p className="subtle">
                          {[citation.sourceType, citation.sourceDate]
                            .filter(Boolean)
                            .join(" · ") || "Source context"}
                        </p>
                        {citation.excerpt ? <p>{citation.excerpt}</p> : null}
                      </div>
                    </li>
                  ))}
                </ol>
              </section>
            </dialog>,
            document.body,
          )
        : null}
    </>
  );
}
