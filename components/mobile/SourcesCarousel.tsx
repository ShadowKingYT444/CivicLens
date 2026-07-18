import type { Citation } from "../types";

function titleFor(citation: Citation, index: number) {
  return citation.title || citation.sourceDocumentId || `Source ${index + 1}`;
}

export function SourcesCarousel({ citations = [] }: { citations?: Citation[] }) {
  if (!citations.length) {
    return <p className="empty-state">Sources will appear here when available.</p>;
  }

  return (
    <div className="sources-carousel" aria-label="Source cards">
      {citations.map((citation, index) => (
        <article className="source-card" key={citation.id ?? citation.url ?? index}>
          <span className="source-mark" aria-hidden="true">
            {index + 1}
          </span>
          <div>
            {citation.url ? (
              <a href={citation.url} target="_blank" rel="noreferrer">
                {titleFor(citation, index)}
              </a>
            ) : (
              <strong>{titleFor(citation, index)}</strong>
            )}
            <p>{[citation.sourceType, citation.sourceDate].filter(Boolean).join(" - ") || "Source context"}</p>
          </div>
        </article>
      ))}
    </div>
  );
}
