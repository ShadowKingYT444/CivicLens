export function TopIdentity({
  title = "CivicLens",
  subtitle = "A civic field guide.",
}: {
  title?: string;
  subtitle?: string;
}) {
  return (
    <header className="top-identity editorial-page-heading">
      <div className="wordmark-wrap">
        <div>
          <p className="editorial-small-label">CivicLens / Field guide</p>
          <p className="wordmark">{title}</p>
          <p className="wordmark-subtitle">{subtitle}</p>
        </div>
      </div>
    </header>
  );
}
