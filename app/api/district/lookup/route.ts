import { NextRequest, NextResponse } from "next/server";
import sampleMembersJson from "../../../../data/fixtures/members/sample-members.json";
import { DistrictLookupRequestSchema, type DistrictLookupResult } from "../../../../lib/ai/schemas";
import { normalizeStateCode, stateCodeFromFips, stateCodeFromName } from "../../../../lib/fips";

const PRIVACY_NOTE = "The raw address or coordinates are used only for this lookup and are not stored, logged, or sent to an LLM.";

type DistrictLookupInput = {
  demo?: boolean;
  address?: string;
  latitude?: number;
  longitude?: number;
};

type Representative = NonNullable<DistrictLookupResult["houseMembers"]>[number];

type CongressMemberPayload = {
  members?: Array<{
    bioguideId?: string;
    depiction?: { attribution?: string; imageUrl?: string };
    district?: string | number | null;
    name?: string;
    partyName?: string;
    state?: string;
    terms?: { item?: Array<{ chamber?: string; startYear?: number; endYear?: number }> };
    url?: string;
  }>;
};

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  const parsed = DistrictLookupRequestSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid district lookup request", issues: parsed.error.flatten().fieldErrors },
      { status: 400 },
    );
  }

  const result = parsed.data.demo === true
    ? demoDistrictLookup()
    : await tryCensusLookup(parsed.data);
  return NextResponse.json(result, { headers: { "Cache-Control": "no-store, private" } });
}

async function tryCensusLookup(input: DistrictLookupInput): Promise<DistrictLookupResult> {
  if (process.env.CENSUS_GEOCODER_ENABLED === "false" || process.env.CENSUS_GEOCODER_LIVE === "false") {
    return unavailableResult("Live district lookup is disabled. You can explore the clearly labeled sample district.");
  }

  const url = buildCensusUrl(input);
  if (!url) {
    return unavailableResult("District lookup could not be started.");
  }

  try {
    const response = await fetch(url, { cache: "no-store", signal: AbortSignal.timeout(8_000) });
    if (!response.ok) {
      return unavailableResult("The Census lookup service is unavailable. Try again or use the official House directory.");
    }

    const payload = (await response.json()) as {
      result?: {
        addressMatches?: Array<{
          matchedAddress?: string;
          coordinates?: { x?: number; y?: number };
          geographies?: Record<string, Array<Record<string, string>>>;
        }>;
        geographies?: Record<string, Array<Record<string, string>>>;
      };
    };
    const match = payload.result?.addressMatches?.[0];
    const geographies = match?.geographies || payload.result?.geographies || {};
    const congressional = findCongressionalDistrict(geographies);
    const stateCode = findStateCode(geographies, congressional);
    const district = normalizeDistrict(congressional);
    if (!stateCode || !district) {
      return { status: "not_found", source: "live", houseMembers: [], senators: [], privacyNote: PRIVACY_NOTE,
        message: "No current federal district matched. Include street, city, state and ZIP code, or check the official House directory." };
    }
    if ((payload.result?.addressMatches?.length ?? 0) > 1) {
      return { status: "not_found", source: "live", houseMembers: [], senators: [], privacyNote: PRIVACY_NOTE,
        message: "The address matched more than one location. Add the ZIP code and try again." };
    }
    const members = await fetchCongressMembers(stateCode, district);

    return {
      status: "matched",
      source: "live",
      memberSource: members.source,
      sourceDate: new Date().toISOString().slice(0, 10),
      congress: currentCongress(),
      message: members.source === "unavailable" ? "District verified by the U.S. Census Bureau. Current member data is unavailable; use the official directories below." : "District verified by the U.S. Census Bureau; available member records retrieved from Congress.gov.",
      stateCode,
      district,
      houseMembers: members.houseMembers,
      senators: members.senators,
      privacyNote: PRIVACY_NOTE,
    };
  } catch {
    return unavailableResult("The Census lookup service could not be reached. Try again or explore the sample district.");
  }
}

function currentCongress() {
  return Number(process.env.CURRENT_CONGRESS ?? 119);
}

function unavailableResult(message: string): DistrictLookupResult {
  return { status: "unavailable", source: "unavailable", memberSource: "unavailable", message, houseMembers: [], senators: [], privacyNote: PRIVACY_NOTE };
}

function buildCensusUrl(input: DistrictLookupInput): URL | null {
  const configuredBase =
    process.env.CENSUS_GEOCODER_URL ||
    process.env.CENSUS_GEOCODER_BASE_URL ||
    process.env.CENSUS_GEOCODER_BASE ||
    "https://geocoding.geo.census.gov/geocoder";
  const root = configuredBase.replace(/\/+$/, "").replace(/\/geographies\/(?:onelineaddress|coordinates)$/i, "");
  const path =
    typeof input.latitude === "number" && typeof input.longitude === "number"
      ? "geographies/coordinates"
      : "geographies/onelineaddress";
  const url = new URL(`${root}/${path}`);

  if (path.endsWith("coordinates")) {
    url.searchParams.set("x", String(input.longitude));
    url.searchParams.set("y", String(input.latitude));
  } else if (input.address) {
    url.searchParams.set("address", input.address);
  } else {
    return null;
  }

  url.searchParams.set("benchmark", process.env.CENSUS_BENCHMARK || "Public_AR_Current");
  url.searchParams.set("vintage", process.env.CENSUS_VINTAGE || (currentCongress() === 119 ? "ACS2025_Current" : "Current_Current"));
  url.searchParams.set("format", "json");
  url.searchParams.set("layers", "all");
  return url;
}

function findStateCode(
  geographies: Record<string, Array<Record<string, string>>>,
  congressional: Record<string, string> | null,
): string | undefined {
  const state = findGeography(geographies, /states/i);
  return (
    stateCodeFromFips(state?.STATE || state?.STATEFP || state?.GEOID || congressional?.STATE || congressional?.STATEFP) ||
    stateCodeFromName(state?.NAME || state?.BASENAME) ||
    normalizeStateCode(state?.STUSAB)
  );
}

function findCongressionalDistrict(geographies: Record<string, Array<Record<string, string>>>): Record<string, string> | null {
  // Census Current may describe future election boundaries. Match the serving Congress explicitly.
  return findGeography(geographies, new RegExp(`^${currentCongress()}(?:th|st|nd|rd)? Congressional Districts?$`, "i"));
}

function findGeography(
  geographies: Record<string, Array<Record<string, string>>>,
  pattern: RegExp,
): Record<string, string> | null {
  const entry = Object.entries(geographies).find(([name]) => pattern.test(name));
  return entry?.[1]?.[0] || null;
}

function normalizeDistrict(congressional: Record<string, string> | null): string | undefined {
  const raw =
    congressional?.[`CD${currentCongress()}FP`] ||
    congressional?.CD ||
    congressional?.BASENAME ||
    congressional?.NAME;
  if (!raw) {
    return undefined;
  }

  if (/at[-\s]?large/i.test(raw)) {
    return "At-Large";
  }

  const digits = raw.match(/\d{1,2}/)?.[0];
  if (!digits) {
    return undefined;
  }

  const numeric = Number(digits);
  return numeric === 0 ? "At-Large" : String(numeric);
}

async function fetchCongressMembers(
  stateCode: string,
  district: string | undefined,
): Promise<{ houseMembers: Representative[]; senators: Representative[]; source: "live" | "unavailable" }> {
  const apiKey = process.env.CONGRESS_API_KEY;
  if (!apiKey) {
    return { houseMembers: [], senators: [], source: "unavailable" };
  }

  const baseUrl = (process.env.CONGRESS_API_BASE_URL || process.env.CONGRESS_API_BASE || "https://api.congress.gov/v3").replace(/\/+$/, "");
  const districtPath = district && district !== "At-Large" ? district : "0";
  const urls = [
    `${baseUrl}/member/${stateCode}/${districtPath}?currentMember=true&limit=250&format=json&api_key=${encodeURIComponent(apiKey)}`,
    `${baseUrl}/member/${stateCode}?currentMember=true&limit=250&format=json&api_key=${encodeURIComponent(apiKey)}`,
  ];

  try {
    const [districtResult, stateResult] = await Promise.allSettled(urls.map(fetchJson<CongressMemberPayload>));
    if (districtResult.status === "rejected" && stateResult.status === "rejected") {
      return { houseMembers: [], senators: [], source: "unavailable" };
    }
    const districtPayload = districtResult.status === "fulfilled" ? districtResult.value : {};
    const statePayload = stateResult.status === "fulfilled" ? stateResult.value : {};
    const districtMembers = (districtPayload.members || []).map(memberFromCongress).filter(isRepresentativeObject);
    const stateMembers = (statePayload.members || []).map(memberFromCongress).filter(isRepresentativeObject);
    const houseMembers = districtMembers.filter((member) => member.chamber?.toLowerCase().includes("house"));
    const senators = stateMembers.filter((member) => member.chamber?.toLowerCase().includes("senate")).slice(0, 2);

    return {
      houseMembers,
      senators,
      source: "live",
    };
  } catch {
    return { houseMembers: [], senators: [], source: "unavailable" };
  }
}

async function fetchJson<T>(url: string): Promise<T> {
  const response = await fetch(url, { cache: "no-store", signal: AbortSignal.timeout(5_000) });
  if (!response.ok) {
    throw new Error(`Congress.gov member lookup failed: ${response.status}`);
  }
  return (await response.json()) as T;
}

function memberFromCongress(member: NonNullable<CongressMemberPayload["members"]>[number]): Extract<Representative, object> | null {
  const chamber = currentChamber(member.terms?.item);
  const fullName = displayName(member.name);
  if (!fullName) {
    return null;
  }

  return {
    bioguideId: member.bioguideId,
    fullName,
    name: fullName,
    party: member.partyName,
    state: member.state,
    district: member.district,
    chamber,
    officialUrl: member.bioguideId ? `https://www.congress.gov/member/${member.bioguideId}` : undefined,
    photoUrl: member.depiction?.imageUrl || congressPhotoUrl(member.bioguideId),
    imageAttribution: member.depiction?.attribution,
  };
}

function isRepresentativeObject(member: Extract<Representative, object> | null): member is Extract<Representative, object> {
  return member !== null;
}

function currentChamber(terms: Array<{ chamber?: string; startYear?: number; endYear?: number }> | undefined): string | undefined {
  return [...(terms || [])].sort((left, right) => (right.startYear || 0) - (left.startYear || 0))[0]?.chamber;
}

function displayName(name: string | undefined): string {
  if (!name) {
    return "";
  }

  const [last, first] = name.split(",").map((part) => part.trim());
  return first && last ? `${first} ${last}` : name.trim();
}

function congressPhotoUrl(bioguideId: string | undefined): string | undefined {
  return bioguideId ? `https://www.congress.gov/img/member/${bioguideId.toLowerCase()}_200.jpg` : undefined;
}

function fixtureMembers(
  stateCode = sampleMembersJson.stateCode,
  district: string | undefined = sampleMembersJson.district,
): { houseMembers: Representative[]; senators: Representative[] } {
  const members = sampleMembersJson.members.map((member) => ({
    bioguideId: member.bioguideId,
    fullName: member.fullName,
    name: member.fullName,
    party: member.party,
    state: member.state,
    district: member.district,
    chamber: member.chamber,
    officialUrl: member.officialUrl,
    photoUrl: congressPhotoUrl(member.bioguideId),
    imageAttribution: "Image from Congress.gov member image service when available.",
  }));
  const houseMembers = members.filter(
    (member) =>
      member.chamber.toLowerCase() === "house" &&
      member.state === stateCode &&
      (!district || member.district === district || district === "At-Large"),
  );
  const senators = members.filter((member) => member.chamber.toLowerCase() === "senate" && member.state === stateCode);

  return {
    houseMembers: houseMembers,
    senators: senators,
  };
}

function demoDistrictLookup(): DistrictLookupResult {
  const members = fixtureMembers(sampleMembersJson.stateCode, sampleMembersJson.district);
  return {
    status: "demo",
    source: "fixture",
    memberSource: "fixture",
    sourceDate: sampleMembersJson.sourceDate,
    congress: 119,
    message: "Sample CA-11 district from a saved July 6, 2026 snapshot. These are sample representatives, not a lookup of your location.",
    stateCode: sampleMembersJson.stateCode,
    district: sampleMembersJson.district,
    houseMembers: members.houseMembers,
    senators: members.senators,
    privacyNote: PRIVACY_NOTE,
  };
}
