export function TrustBanner() {
  return (
    <aside className="trust-banner" aria-label="CivicLens trust and safety guardrails">
      <div className="trust-banner-inner">
        <span>
          <strong>Student-safe mode:</strong> citations required for factual claims, no
          candidate or party recommendations, no raw address or claim logging by the UI.
        </span>
        <span className="status-pill good">Source-grounded demo</span>
      </div>
    </aside>
  );
}
