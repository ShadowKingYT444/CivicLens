import type { Metadata } from "next";
import Link from "next/link";
import { ExternalLink, Play, Smartphone, Terminal } from "lucide-react";
import { HomeDashboard } from "../../components/home-dashboard";

export const metadata: Metadata = {
  title: "Split Preview",
};

export default function PreviewPage() {
  return (
    <section className="preview-workbench" aria-label="CivicLens split-screen preview">
      <h1 className="sr-only">CivicLens split-screen preview</h1>

      <div className="preview-setup-panel">
        <p className="eyebrow">Live test bench</p>
        <h2>Code left. Phone right.</h2>
        <p>Use this route while rebuilding. The phone is a fixed 390x844 frame, pointed at Analyze.</p>

        <div className="preview-command-list" aria-label="Split preview steps">
          <div className="preview-command-row">
            <Terminal aria-hidden="true" size={22} />
            <div>
              <strong>Backend smoke</strong>
              <code>PROVIDER_SMOKE_BASE_URL=http://localhost:3000 node scripts/smoke-real-providers.mjs</code>
            </div>
          </div>
          <div className="preview-command-row">
            <Play aria-hidden="true" size={22} />
            <div>
              <strong>Analyze endpoint</strong>
              <code>POST /api/analyze {"{ claim: \"What does H.R. 82 say?\" }"}</code>
            </div>
          </div>
          <div className="preview-command-row">
            <Smartphone aria-hidden="true" size={22} />
            <div>
              <strong>Phone route</strong>
              <code>/analyze</code>
            </div>
          </div>
        </div>

        <div className="preview-actions" aria-label="Preview shortcuts">
          <Link className="button yellow" href="/analyze">
            Open Analyze <ExternalLink aria-hidden="true" size={20} />
          </Link>
          <Link className="button secondary" href="/">
            Home <Smartphone aria-hidden="true" size={20} />
          </Link>
        </div>
      </div>

      <div className="preview-phone-frame" aria-label="Live CivicLens phone frame">
        <span className="preview-phone-side preview-phone-side-left" aria-hidden="true" />
        <span className="preview-phone-side preview-phone-side-right" aria-hidden="true" />
        <div className="preview-phone-bezel">
          <span className="preview-phone-speaker" aria-hidden="true" />
          <iframe className="preview-phone-iframe" src="/analyze" title="CivicLens analyze preview" />
        </div>
      </div>

      <div className="preview-mobile-live">
        <HomeDashboard />
      </div>
    </section>
  );
}
