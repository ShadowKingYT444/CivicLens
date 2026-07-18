import { PRIVACY_NOTES } from "../constants";
import { type StateCode, stateCodeFromFips, stateCodeFromName, normalizeStateCode } from "../fips";

export type DistrictLookupStatus = "matched" | "no_match" | "demo" | "error";
export type DistrictLookupSource = "live" | "fixture";

export interface Coordinates {
  lat: number;
  lon: number;
}

export interface RepresentativeSummary {
  name: string;
  chamber: "house" | "senate";
  party?: string;
  url?: string;
}

export interface DistrictLookupResult {
  status: DistrictLookupStatus;
  source: DistrictLookupSource;
  matchedAddress?: string;
  stateCode?: StateCode;
  district?: string;
  coordinates?: Coordinates;
  houseMembers: RepresentativeSummary[];
  senators: RepresentativeSummary[];
  privacyNote: string;
}

export interface ParsedDistrictLabel {
  stateCode?: StateCode;
  district?: string;
  atLarge: boolean;
}

export function parseCensusGeocoderResponse(response: unknown): DistrictLookupResult {
  const root = asRecord(response) ?? {};
  const result = asRecord(root.result) ?? {};
  const matches = Array.isArray(result.addressMatches) ? result.addressMatches : [];
  const firstMatch = asRecord(matches[0]);

  if (!firstMatch) {
    return noMatchResult("live");
  }

  const geographies = asRecord(firstMatch.geographies);
  const stateCode = extractStateCode(geographies);
  const district = extractCongressionalDistrict(geographies);
  const coordinates = extractCoordinates(firstMatch.coordinates);

  return {
    status: stateCode || district ? "matched" : "no_match",
    source: "live",
    matchedAddress: typeof firstMatch.matchedAddress === "string" ? firstMatch.matchedAddress : undefined,
    stateCode,
    district,
    coordinates,
    houseMembers: [],
    senators: [],
    privacyNote: PRIVACY_NOTES.address,
  };
}

export function parseDistrictLabel(input: string): ParsedDistrictLabel {
  const stateMatch = /\b([A-Z]{2})[-\s]?(\d{1,2}|at[-\s]?large)\b/i.exec(input);
  const atLarge = /\bat[-\s]?large\b/i.test(input);
  const stateCode = stateMatch ? normalizeStateCode(stateMatch[1]) : undefined;
  const districtNumber = stateMatch && /^\d+$/.test(stateMatch[2]) ? normalizeDistrictNumber(stateMatch[2]) : undefined;

  if (stateMatch || atLarge) {
    return {
      stateCode,
      district: atLarge ? "At-Large" : districtNumber,
      atLarge,
    };
  }

  const districtOnly = /\b(?:district|cd)\s*(\d{1,2})\b/i.exec(input);
  return {
    district: districtOnly ? normalizeDistrictNumber(districtOnly[1]) : undefined,
    atLarge,
  };
}

export function createDemoDistrictResult(): DistrictLookupResult {
  return {
    status: "demo",
    source: "fixture",
    matchedAddress: "Demo fixture address, not the submitted address",
    stateCode: "CA",
    district: "12",
    houseMembers: [],
    senators: [],
    privacyNote: PRIVACY_NOTES.address,
  };
}

export function noMatchResult(source: DistrictLookupSource): DistrictLookupResult {
  return {
    status: "no_match",
    source,
    houseMembers: [],
    senators: [],
    privacyNote: PRIVACY_NOTES.address,
  };
}

function extractStateCode(geographies: Record<string, unknown> | undefined): StateCode | undefined {
  const states = findGeographyArray(geographies, "states");
  const state = asRecord(states?.[0]);

  if (!state) {
    return undefined;
  }

  const byFips = stateCodeFromFips(readString(state, ["STATE", "STATEFP", "STATEFP20", "GEOID"]));
  if (byFips) {
    return byFips;
  }

  return stateCodeFromName(readString(state, ["NAME", "BASENAME"]));
}

function extractCongressionalDistrict(geographies: Record<string, unknown> | undefined): string | undefined {
  const districts = findGeographyArray(geographies, "congressional district");
  const district = asRecord(districts?.[0]);

  if (!district) {
    return undefined;
  }

  const rawDistrict = readString(district, [
    "CD119FP",
    "CD118FP",
    "CD117FP",
    "CD116FP",
    "CD115FP",
    "BASENAME",
    "NAME",
  ]);

  if (!rawDistrict) {
    return undefined;
  }

  const parsed = parseDistrictLabel(rawDistrict);
  return parsed.district ?? normalizeDistrictNumber(rawDistrict);
}

function extractCoordinates(value: unknown): Coordinates | undefined {
  const coordinates = asRecord(value);
  const lon = Number(coordinates?.x);
  const lat = Number(coordinates?.y);

  if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
    return undefined;
  }

  return { lat, lon };
}

function findGeographyArray(geographies: Record<string, unknown> | undefined, keyPart: string): unknown[] | undefined {
  if (!geographies) {
    return undefined;
  }

  const entry = Object.entries(geographies).find(([key, value]) => {
    return key.toLowerCase().includes(keyPart) && Array.isArray(value);
  });

  return entry?.[1] as unknown[] | undefined;
}

function normalizeDistrictNumber(input: string): string | undefined {
  const digits = /\d{1,2}/.exec(input);
  if (!digits) {
    return /\bat[-\s]?large\b/i.test(input) ? "At-Large" : undefined;
  }

  const numeric = Number(digits[0]);
  if (!Number.isInteger(numeric) || numeric < 0 || numeric > 99) {
    return undefined;
  }

  return numeric === 0 ? "At-Large" : String(numeric);
}

function readString(record: Record<string, unknown>, keys: string[]): string | undefined {
  for (const key of keys) {
    const value = record[key];
    if (typeof value === "string" && value.trim()) {
      return value.trim();
    }
  }

  return undefined;
}

function asRecord(value: unknown): Record<string, unknown> | undefined {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : undefined;
}
