import { NextRequest, NextResponse } from "next/server";
import sampleMembersJson from "../../../../data/fixtures/members/sample-members.json";
import { DistrictLookupRequestSchema, type DistrictLookupResult } from "../../../../lib/ai/schemas";
import { normalizeStateCode, stateCodeFromFips, stateCodeFromName } from "../../../../lib/fips";

const PRIVACY_NOTE = "The raw address or coordinates are used only for this lookup and are not stored, logged, or sent to an LLM.";

type DistrictLookupInput = {
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

  const live = await tryCensusLookup(parsed.data);
  return NextResponse.json(live || demoDistrictLookup());
}

async function tryCensusLookup(input: DistrictLookupInput): Promise<DistrictLookupResult | null> {
  if (process.env.CENSUS_GEOCODER_ENABLED === "false" || process.env.CENSUS_GEOCODER_LIVE === "false") {
    return null;
  }

  const url = buildCensusUrl(input);
  if (!url) {
    return null;
  }

  try {
    const response = await fetch(url, { cache: "no-store" });
    if (!response.ok) {
      return null;
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
    const coordinates = extractCoordinates(match?.coordinates, input);
    const members = stateCode ? await fetchCongressMembers(stateCode, district) : fixtureMembers(stateCode, district);

    if (!stateCode && !district && !coordinates) {
      return { status: "not_found", houseMembers: [], senators: [], privacyNote: PRIVACY_NOTE };
    }

    return {
      status: "matched",
      matchedAddress: match?.matchedAddress,
      stateCode,
      district,
      coordinates,
      houseMembers: members.houseMembers,
      senators: members.senators,
      privacyNote: PRIVACY_NOTE,
    };
  } catch {
    return null;
  }
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
  url.searchParams.set("vintage", process.env.CENSUS_VINTAGE || "Current_Current");
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
  return findGeography(geographies, /congressional district/i);
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
    congressional?.CD119FP ||
    congressional?.CD118FP ||
    congressional?.CD117FP ||
    congressional?.CD116FP ||
    congressional?.CD115FP ||
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

function extractCoordinates(
  matchCoordinates: { x?: number; y?: number } | undefined,
  input: DistrictLookupInput,
): DistrictLookupResult["coordinates"] {
  if (typeof matchCoordinates?.x === "number" && typeof matchCoordinates?.y === "number") {
    return { latitude: matchCoordinates.y, longitude: matchCoordinates.x };
  }
  if (typeof input.latitude === "number" && typeof input.longitude === "number") {
    return { latitude: input.latitude, longitude: input.longitude };
  }
  return undefined;
}

async function fetchCongressMembers(
  stateCode: string,
  district: string | undefined,
): Promise<{ houseMembers: Representative[]; senators: Representative[] }> {
  const apiKey = process.env.CONGRESS_API_KEY;
  if (!apiKey) {
    return fixtureMembers(stateCode, district);
  }

  const baseUrl = (process.env.CONGRESS_API_BASE_URL || process.env.CONGRESS_API_BASE || "https://api.congress.gov/v3").replace(/\/+$/, "");
  const districtPath = district && district !== "At-Large" ? district : "0";
  const urls = [
    `${baseUrl}/member/${stateCode}/${districtPath}?currentMember=true&format=json&api_key=${encodeURIComponent(apiKey)}`,
    `${baseUrl}/member/${stateCode}?currentMember=true&format=json&api_key=${encodeURIComponent(apiKey)}`,
  ];

  try {
    const [districtPayload, statePayload] = await Promise.all(urls.map(fetchJson<CongressMemberPayload>));
    const districtMembers = (districtPayload.members || []).map(memberFromCongress).filter(isRepresentativeObject);
    const stateMembers = (statePayload.members || []).map(memberFromCongress).filter(isRepresentativeObject);
    const houseMembers = districtMembers.filter((member) => member.chamber?.toLowerCase().includes("house"));
    const senators = stateMembers.filter((member) => member.chamber?.toLowerCase().includes("senate")).slice(0, 2);

    return {
      houseMembers: houseMembers.length ? houseMembers : fixtureMembers(stateCode, district).houseMembers,
      senators: senators.length ? senators : fixtureMembers(stateCode, district).senators,
    };
  } catch {
    return fixtureMembers(stateCode, district);
  }
}

async function fetchJson<T>(url: string): Promise<T> {
  const response = await fetch(url, { cache: "no-store" });
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
    officialUrl: member.url,
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
    houseMembers: houseMembers.length ? houseMembers : members.filter((member) => member.chamber.toLowerCase() === "house").slice(0, 1),
    senators: senators.length ? senators : members.filter((member) => member.chamber.toLowerCase() === "senate").slice(0, 2),
  };
}

function demoDistrictLookup(): DistrictLookupResult {
  const members = fixtureMembers(sampleMembersJson.stateCode, sampleMembersJson.district);
  return {
    status: "demo",
    matchedAddress: "Demo fixture address",
    stateCode: sampleMembersJson.stateCode,
    district: sampleMembersJson.district,
    coordinates: { latitude: 37.779, longitude: -122.419 },
    houseMembers: members.houseMembers,
    senators: members.senators,
    privacyNote: PRIVACY_NOTE,
  };
}
