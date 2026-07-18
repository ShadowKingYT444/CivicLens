"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowRight, Search } from "lucide-react";
import { AssetIcon } from "./AssetIcon";
import { assets } from "../lib/asset-manifest";
import { setPendingClaim } from "../lib/client-claim-handoff";
import { ActionTile } from "./mobile/ActionTile";
import { TopIdentity } from "./mobile/TopIdentity";
import { Pill } from "./mobile/Pill";

export function HomeDashboard() {
  const [claim, setClaim] = useState("");
  const router = useRouter();

  function handleQuickClaimSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const nextClaim = claim.trim();
    if (nextClaim) {
      setPendingClaim(nextClaim);
    }
    router.push("/analyze");
  }

  return (
    <section className="page-shell" aria-label="CivicLens home">
      <TopIdentity />

      <article className="hero-bite-card" aria-labelledby="daily-bite-heading">
        <div>
          <Pill tone="yellow">Source check</Pill>
          <h1 id="daily-bite-heading">
            Is one president responsible for inflation?
          </h1>
          <p>Start with evidence, then context.</p>
          <Link className="button yellow hero-cta" href="/analyze">
            Analyze <ArrowRight aria-hidden="true" size={22} />
          </Link>
        </div>
        <AssetIcon
          asset={assets.government.congress}
          alt=""
          decorative
          size={220}
          priority
        />
      </article>

      <section
        className="quick-claim-card home-quick-claim"
        aria-labelledby="quick-claim-heading"
      >
        <AssetIcon asset={assets.ui.claimCheck} alt="" decorative size={112} />
        <form className="quick-claim-copy" onSubmit={handleQuickClaimSubmit}>
          <h2 id="quick-claim-heading">Check a claim</h2>
          <p>Get cited context fast.</p>
          <label className="sr-only" htmlFor="home-claim">
            Claim text
          </label>
          <div className="claim-input-link home-claim-form-field">
            <Search aria-hidden="true" size={22} />
            <input
              id="home-claim"
              className="input"
              type="search"
              value={claim}
              onChange={(event) => setClaim(event.target.value)}
              maxLength={2000}
              placeholder="Paste a civic claim"
            />
            <button
              className="button"
              type="submit"
              aria-label="Analyze typed claim"
            >
              <ArrowRight aria-hidden="true" size={24} />
            </button>
          </div>
        </form>
      </section>

      <div className="section-row">
        <h2>Explore CivicLens</h2>
      </div>

      <div className="explore-grid">
        <ActionTile
          href="/bills"
          title="Bills"
          body="Track decisions"
          asset={assets.billTypes.schoolMeals}
          tone="teal"
        />
        <ActionTile
          href="/district"
          title="District"
          body="Find reps"
          asset={assets.government.house}
          tone="blue"
        />
        <ActionTile
          href="/feed"
          title="Learn"
          body="Short lessons"
          asset={assets.ui.quiz}
          tone="purple"
        />
        <ActionTile
          href="/analyze"
          title="Analyze"
          body="Check claims"
          asset={assets.truthScale.mixed}
          tone="yellow"
        />
      </div>
    </section>
  );
}
