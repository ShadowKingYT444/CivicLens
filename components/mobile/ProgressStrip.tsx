import { BookOpen, FileText, ShieldCheck } from "lucide-react";

export function ProgressStrip() {
  return (
    <section className="progress-strip" aria-label="CivicLens workflow">
      <div className="progress-stat progress-learn">
        <BookOpen aria-hidden="true" size={24} />
        <div>
          <strong>Learn</strong>
          <span>Short lessons</span>
        </div>
      </div>
      <div className="progress-stat progress-xp">
        <FileText aria-hidden="true" size={24} />
        <div>
          <strong>Analyze</strong>
          <span>Claims and bills</span>
        </div>
      </div>
      <div className="progress-stat progress-level">
        <ShieldCheck aria-hidden="true" size={24} />
        <div>
          <strong>Verify</strong>
          <span>Sources attached</span>
        </div>
      </div>
    </section>
  );
}
