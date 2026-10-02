import { isCensusGeocoderConfigured } from "../../../../lib/clients/census-client";
import { NextRequest, NextResponse } from "next/server";
import sampleMembersJson from "../../../../data/fixtures/members/sample-members.json";
import { DistrictLookupRequestSchema, DistrictLookupResultSchema, RepresentativeSummarySchema, type DistrictLookupResult } from "../../../../lib/ai/schemas";
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
  const result = DistrictLookupResultSchema.safeParse(live || demoDistrictLookup());
  return NextResponse.json(result.success ? result.data : demoDistrictLookup());
}

async function tryCensusLookup(input: DistrictLookupInput): Promise<DistrictLookupResult | null> {
  if (!isCensusGeocoderConfigured()) {
    return null;
  }

  try {
    const url = buildCensusUrl(input);
    if (!url) return null;
    const payload = (await fetchJson(url.toString(), timeoutMs(process.env.CENSUS_TIMEOUT_MS, 6000))) as {
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


    if (!stateCode || !district) {
      return { status: "not_found", houseMembers: [], senators: [], privacyNote: PRIVACY_NOTE };
    }

    const members = await fetchCongressMembers(stateCode, district);
    return {
      status: "matched",
      matchedAddress: match?.matchedAddress,
      stateCode,
      district,
      coordinates,
      houseMembers: members.houseMembers,
      senators: members.senators,
      privacyNote: PRIVACY_NOTE,
      representativesMode: members.houseMembers.length || members.senators.length ? "live" : "unavailable",
      warnings: members.houseMembers.length && members.senators.length ? [] : ["Some representative data is unavailable; no unrelated demo members were substituted."],
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
    return { houseMembers: [], senators: [] };
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
      houseMembers: houseMembers.filter((member) => member.state === stateCode && String(member.district) === districtPath),
      senators: senators.filter((member) => member.state === stateCode),
    };
  } catch {
    return { houseMembers: [], senators: [] };
  }
}

function timeoutMs(raw: string | undefined, fallback: number): number {
  const value = Number(raw);
  return Number.isFinite(value) && value > 0 ? Math.min(10000, Math.max(10, value)) : fallback;
}

async function fetchJson<T>(url: string, deadline = timeoutMs(process.env.CONGRESS_MEMBER_TIMEOUT_MS, 8000)): Promise<T> {
  const controller = new AbortController();
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      (async () => {
        const response = await fetch(url, { cache: "no-store", signal: controller.signal });
        if (!response.ok) throw new Error("Provider unavailable");
        return await response.json() as T;
      })(),
      new Promise<never>((_, reject) => {
        timer = setTimeout(() => { controller.abort(); reject(new Error("Provider deadline exceeded")); }, deadline);
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

function memberFromCongress(member: NonNullable<CongressMemberPayload["members"]>[number]): Extract<Representative, object> | null {
  const chamber = currentChamber(member.terms?.item);
  const fullName = displayName(typeof member.name === "string" ? member.name : undefined);
  if (!fullName) {
    return null;
  }

  const parsed = RepresentativeSummarySchema.safeParse({
    bioguideId: member.bioguideId,
    fullName,
    name: fullName,
    party: member.partyName,
    state: normalizeStateCode(member.state) || stateCodeFromName(member.state),
    district: member.district,
    chamber,
    officialUrl: member.url,
    photoUrl: member.depiction?.imageUrl || congressPhotoUrl(member.bioguideId),
    imageAttribution: member.depiction?.attribution,
  });
  return parsed.success ? parsed.data : null;
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
    houseMembers,
    senators,
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
    representativesMode: "fixture",
    warnings: ["Demo fixture district and representative data; no live lookup was performed."],
  };
}
