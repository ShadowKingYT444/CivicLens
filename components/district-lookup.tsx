"use client";

import { FormEvent, useState } from "react";
import { ArrowRight, LocateFixed, Lock, MapPin, ShieldCheck } from "lucide-react";
import { getJson } from "./api";
import { assets } from "../lib/asset-manifest";
import { ActionTile } from "./mobile/ActionTile";
import { DistrictHeroCard } from "./mobile/DistrictHeroCard";
import { RepresentativeMiniCard } from "./mobile/RepresentativeMiniCard";
import { TopIdentity } from "./mobile/TopIdentity";
import type { DistrictLookupResult } from "./types";

type MemberSummary = NonNullable<DistrictLookupResult["houseMembers"]>[number];

function memberName(member: MemberSummary) {
  if (typeof member === "string") return member;
  return member.fullName ?? member.name ?? "Representative";
}

function memberRole(member: MemberSummary, fallback: string) {
  if (typeof member === "string") return fallback;
  const party = member.party === "D" ? "Democratic" : member.party === "R" ? "Republican" : member.party;
  return [fallback, party, member.state].filter(Boolean).join(" - ");
}

function memberPhoto(member: MemberSummary) {
  return typeof member === "string" ? undefined : member.photoUrl;
}

export function DistrictLookup() {
  const [address, setAddress] = useState("");
  const [result, setResult] = useState<DistrictLookupResult | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!address.trim()) return;

    await lookupDistrict({ address: address.trim() });
  }

  async function lookupDistrict(requestBody: { address?: string; latitude?: number; longitude?: number }) {
    setLoading(true);
    setError("");
    setResult(null);

    try {
      const responsePayload = await getJson<DistrictLookupResult>("/api/district/lookup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(requestBody),
      });
      setResult(responsePayload);
      setAddress("");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "District lookup unavailable.");
    } finally {
      setLoading(false);
    }
  }

  function handleUseLocation() {
    if (!navigator.geolocation) {
      setError("Location lookup is not available in this browser.");
      return;
    }

    setError("");
    setLoading(true);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        void lookupDistrict({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
        });
      },
      () => {
        setLoading(false);
        setError("Location permission was not granted. You can still enter an address.");
      },
      { enableHighAccuracy: false, timeout: 8_000, maximumAge: 300_000 },
    );
  }

  const districtCode = result?.stateCode && result?.district ? `${result.stateCode} District ${result.district}` : "Your District";

  return (
    <section className="page-shell" aria-label="District lookup">
      <TopIdentity title="District" subtitle="Find representatives without storing your address." />

      <form className="form-grid" onSubmit={handleSubmit}>
        <label className="sr-only" htmlFor="address">
          Street address
        </label>
        <div className="claim-input-link">
          <MapPin aria-hidden="true" size={24} />
          <input
            id="address"
            className="input"
            value={address}
            onChange={(event) => setAddress(event.target.value)}
            autoComplete="street-address"
            placeholder="1600 Pennsylvania Ave NW, Washington, DC"
            required
          />
          <button className="button secondary" type="submit" disabled={loading} aria-label="Look up district">
            <ArrowRight aria-hidden="true" size={22} />
          </button>
        </div>
        <button className="button secondary location-button" type="button" onClick={handleUseLocation} disabled={loading}>
          <LocateFixed aria-hidden="true" size={20} /> Use my location
        </button>
        {error ? (
          <p className="empty-state" role="alert">
            {error}
          </p>
        ) : null}
      </form>

      {loading ? <p className="empty-state">Looking up your district...</p> : null}

      {result ? (
        <>
          <DistrictHeroCard districtCode={districtCode} location={result.stateCode ? `${result.stateCode}` : undefined} />

          <section className="page-shell">
            <div className="section-row">
              <h2>Your Representatives</h2>
              <span className="status-pill good">Why these?</span>
            </div>
            <div className="representatives-row">
              {result.houseMembers?.length ? (
                result.houseMembers.map((member, index) => (
                  <RepresentativeMiniCard
                    key={`${memberName(member)}-${index}`}
                    name={memberName(member)}
                    role={memberRole(member, "U.S. House")}
                    label={String(result.district ? `${result.stateCode}-${result.district}` : "House")}
                    photoUrl={memberPhoto(member)}
                    tone="blue"
                  />
                ))
              ) : (
                <p className="empty-state">No House member data returned.</p>
              )}
              {result.senators?.length ? (
                result.senators.map((member, index) => (
                  <RepresentativeMiniCard
                    key={`${memberName(member)}-${index}`}
                    name={memberName(member)}
                    role={memberRole(member, "U.S. Senate")}
                    label={result.stateCode}
                    photoUrl={memberPhoto(member)}
                    tone={index % 2 ? "purple" : "teal"}
                  />
                ))
              ) : (
                <p className="empty-state">No senator data returned.</p>
              )}
            </div>
          </section>

          <section className="privacy-card">
            <ShieldCheck aria-hidden="true" size={50} color="#00A98F" />
            <div>
              <h3>Your privacy matters</h3>
              <p>{result.privacyNote ?? "We don't store your address. It's used only to find your district."}</p>
            </div>
            <Lock aria-hidden="true" size={28} color="#007C6B" />
          </section>

          <div className="explore-grid">
            <ActionTile
              href="/bills"
              title="Bills"
              body="Search related bills"
              asset={assets.billTypes.schoolMeals}
              tone="teal"
            />
            <ActionTile
              href="/methodology"
              title="Sources"
              body="How we verify"
              asset={assets.ui.source}
              tone="purple"
            />
            <ActionTile
              href="/feed"
              title="Learn"
              body="Civic basics"
              asset={assets.ui.quiz}
              tone="yellow"
            />
            <ActionTile
              href="/analyze"
              title="Analyze"
              body="Check a claim"
              asset={assets.truthScale.mixed}
              tone="blue"
            />
          </div>
        </>
      ) : !loading ? (
        <section className="district-hero-card">
          <div>
            <span className="district-kicker">Your district</span>
            <h2>Find it</h2>
            <p>Use an address once to find your district.</p>
            <span className="privacy-note">
              <ShieldCheck aria-hidden="true" size={24} /> We use this only for lookup.
            </span>
          </div>
        </section>
      ) : null}
    </section>
  );
}
