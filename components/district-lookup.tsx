"use client";

import Link from "next/link";
import { FormEvent, useEffect, useRef, useState } from "react";
import { ArrowUpRight, LocateFixed, ShieldCheck } from "lucide-react";
import { getJson } from "./api";
import { DistrictHeroCard } from "./mobile/DistrictHeroCard";
import { RepresentativeMiniCard } from "./mobile/RepresentativeMiniCard";
import type { DistrictLookupResult } from "./types";

type MemberSummary = NonNullable<DistrictLookupResult["houseMembers"]>[number];

function memberName(member: MemberSummary) {
  return typeof member === "string"
    ? member
    : (member.fullName ?? member.name ?? "Representative");
}

function memberRole(member: MemberSummary, fallback: string) {
  if (typeof member === "string") return fallback;
  const party =
    member.party === "D"
      ? "Democratic"
      : member.party === "R"
        ? "Republican"
        : member.party;
  return [fallback, party, member.state].filter(Boolean).join(" · ");
}

export function DistrictLookup() {
  const [address, setAddress] = useState("");
  const [result, setResult] = useState<DistrictLookupResult | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const pending = useRef(false);
  const resultRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!result || loading) return;
    resultRef.current?.focus({ preventScroll: true });
    resultRef.current?.scrollIntoView({
      block: "start",
      behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches
        ? "auto"
        : "smooth",
    });
  }, [result, loading]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!address.trim() || pending.current) return;
    await lookupDistrict({ address: address.trim() });
  }

  async function lookupDistrict(requestBody: {
    address?: string;
    latitude?: number;
    longitude?: number;
  }) {
    pending.current = true;
    setLoading(true);
    setError("");
    setResult(null);
    try {
      const payload = await getJson<DistrictLookupResult>(
        "/api/district/lookup",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(requestBody),
        },
      );
      setResult(payload);
      setAddress("");
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : "District lookup unavailable. Try again with a full address.",
      );
    } finally {
      pending.current = false;
      setLoading(false);
    }
  }

  function handleUseLocation() {
    if (pending.current) return;
    if (!navigator.geolocation) {
      setError(
        "Location lookup is not available in this browser. Enter an address instead.",
      );
      return;
    }
    pending.current = true;
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
        pending.current = false;
        setLoading(false);
        setError(
          "Location permission was not granted. You can still enter an address.",
        );
      },
      { enableHighAccuracy: false, timeout: 8_000, maximumAge: 300_000 },
    );
  }

  const isDemo = result?.status === "demo";
  const notFound = result?.status === "not_found";
  const districtCode =
    result?.stateCode && result?.district != null
      ? `${result.stateCode} District ${result.district}`
      : "District unavailable";

  function renderMember(member: MemberSummary, index: number, chamber: string) {
    return (
      <RepresentativeMiniCard
        key={`${chamber}-${memberName(member)}-${index}`}
        name={memberName(member)}
        role={memberRole(member, chamber)}
        label={
          chamber === "U.S. House" && result?.district != null
            ? `${result.stateCode}-${result.district}`
            : result?.stateCode
        }
        photoUrl={typeof member === "string" ? undefined : member.photoUrl}
        officialUrl={
          typeof member === "string" ? undefined : member.officialUrl
        }
      />
    );
  }

  return (
    <section
      className="editorial-page editorial-district"
      aria-label="District lookup"
    >
      <header className="editorial-page-heading">
        <p className="editorial-kicker">Representation starts here</p>
        <h1>Find your district.</h1>
        <p className="editorial-lead">
          Look up your House district and federal representatives with a street
          address.
        </p>
      </header>

      <form
        className="editorial-district-form"
        onSubmit={handleSubmit}
        aria-busy={loading}
      >
        <label htmlFor="address">Street address</label>
        <p id="address-hint" className="subtle">
          Include city, state, and ZIP code for the closest match.
        </p>
        <div className="editorial-address-controls">
          <input
            id="address"
            className="input"
            value={address}
            onChange={(event) => setAddress(event.target.value)}
            autoComplete="street-address"
            placeholder="1600 Pennsylvania Ave NW, Washington, DC"
            aria-describedby="address-hint district-privacy"
            required
            disabled={loading}
          />
          <button
            className="button"
            type="submit"
            disabled={loading || !address.trim()}
            aria-label="Look up district"
          >
            {loading ? "Looking up…" : "Find district"}
          </button>
        </div>
        <div className="editorial-location-row">
          <button
            className="button secondary"
            type="button"
            onClick={handleUseLocation}
            disabled={loading}
          >
            <LocateFixed aria-hidden="true" size={18} /> Use my location
          </button>
          <span className="subtle">Requires browser permission</span>
        </div>
        <p className="editorial-privacy-note" id="district-privacy">
          <ShieldCheck aria-hidden="true" size={18} /> Your address is used for
          this lookup, then cleared. It is not stored or sent to AI providers.
        </p>
        {error ? (
          <p className="editorial-notice" role="alert">
            {error}
          </p>
        ) : null}
      </form>

      {loading ? (
        <p className="editorial-empty" role="status">
          Finding district and representative records…
        </p>
      ) : null}
      {notFound ? (
        <div
          className="editorial-empty"
          role="status"
          ref={resultRef}
          tabIndex={-1}
        >
          <h2>No district match</h2>
          <p>Try a full street address with city, state, and ZIP code.</p>
        </div>
      ) : result ? (
        <div
          className="editorial-district-result"
          aria-live="polite"
          ref={resultRef}
          tabIndex={-1}
          role="region"
          aria-label={isDemo ? "Sample district result" : "District result"}
        >
          {isDemo ? (
            <p className="editorial-notice">
              <strong>Sample result — not your district.</strong> Live lookup
              was unavailable. The district and representatives below are a
              curated example and do not match your entered address.
            </p>
          ) : null}
          <DistrictHeroCard
            districtCode={districtCode}
            location={result.stateCode}
            demo={isDemo}
          />
          <section
            className="editorial-section"
            aria-labelledby="representatives-heading"
          >
            <h2 id="representatives-heading">
              {isDemo ? "Sample representatives" : "Your representatives"}
            </h2>
            <div className="editorial-representatives">
              {result.houseMembers?.length ? (
                result.houseMembers.map((member, index) =>
                  renderMember(member, index, "U.S. House"),
                )
              ) : (
                <p className="subtle">No House member data returned.</p>
              )}
              {result.senators?.length ? (
                result.senators.map((member, index) =>
                  renderMember(member, index, "U.S. Senate"),
                )
              ) : (
                <p className="subtle">No senator data returned.</p>
              )}
            </div>
          </section>
          {result.privacyNote ? (
            <p className="editorial-privacy-note">
              <ShieldCheck aria-hidden="true" size={18} /> {result.privacyNote}
            </p>
          ) : null}
          <nav
            className="editorial-related-links"
            aria-label="Continue exploring"
          >
            <Link href="/bills">
              Read bills <ArrowUpRight size={16} aria-hidden="true" />
            </Link>
            <Link href="/feed">
              Learn civic basics <ArrowUpRight size={16} aria-hidden="true" />
            </Link>
            <Link href="/methodology">
              Lookup methodology <ArrowUpRight size={16} aria-hidden="true" />
            </Link>
          </nav>
        </div>
      ) : null}
    </section>
  );
}
