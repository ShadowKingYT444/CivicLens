import Link from "next/link";
import { ArrowRight, Search } from "lucide-react";
import { AssetIcon } from "../AssetIcon";
import { assets } from "../../lib/asset-manifest";

export function QuickClaimCard() {
  return (
    <section className="quick-claim-card" aria-labelledby="quick-claim-heading">
      <AssetIcon asset={assets.ui.claimCheck} alt="" decorative size={112} />
      <div className="quick-claim-copy">
        <h2 id="quick-claim-heading">Check a claim</h2>
        <p>Get cited context fast.</p>
        <Link className="claim-input-link" href="/analyze" aria-label="Analyze a claim">
          <Search aria-hidden="true" size={22} />
          <span>Paste a civic claim</span>
          <ArrowRight aria-hidden="true" size={26} />
        </Link>
      </div>
    </section>
  );
}
