export function TopIdentity({
  title = "CivicLens",
  subtitle = "Evidence-first civic learning.",
}: {
  title?: string;
  subtitle?: string;
}) {
  return (
    <header className="top-identity">
      <div className="wordmark-wrap">
        <span className="wordmark-mark" aria-hidden="true">
          CL
        </span>
        <div>
          <p className={`wordmark${title.length > 15 ? " wordmark-compact" : ""}`}>{title}</p>
          <p className="wordmark-subtitle">{subtitle}</p>
        </div>
      </div>
    </header>
  );
}
