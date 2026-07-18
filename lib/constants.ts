export const APP_NAME = "CivicLens";

export const DEMO_MODE = "demo";
export const LIVE_MODE = "live";

export type RuntimeMode = typeof DEMO_MODE | typeof LIVE_MODE;

export const INPUT_LIMITS = {
  claimMinLength: 10,
  claimMaxLength: 2000,
  addressMinLength: 5,
  addressMaxLength: 500,
  searchMaxLength: 200,
  searchResultLimit: 10,
} as const;

export const NETWORK_LIMITS = {
  congressTimeoutMs: 8000,
  censusTimeoutMs: 8000,
  rateLimitWindowMs: 60_000,
  rateLimitMaxRequests: 30,
} as const;

export const ENV_VARS = {
  congressApiKey: "CONGRESS_API_KEY",
  congressApiBaseUrl: "CONGRESS_API_BASE_URL",
  censusLive: "CENSUS_GEOCODER_LIVE",
  censusApiBaseUrl: "CENSUS_GEOCODER_BASE_URL",
  storeAnalyses: "STORE_ANALYSES",
  storeRawInputs: "STORE_RAW_INPUTS",
  privacyHashPepper: "PRIVACY_HASH_PEPPER",
} as const;

export const OFFICIAL_SOURCE_URLS = {
  congressApi: "https://api.congress.gov/v3",
  congressBill: "https://www.congress.gov/bill",
  censusGeocoder: "https://geocoding.geo.census.gov/geocoder",
} as const;

export const PRIVACY_NOTES = {
  address:
    "CivicLens does not store raw addresses. Lookup uses server-side geocoding only when live mode is explicitly enabled.",
  claim:
    "CivicLens stores only hashes by default. Raw claim text is stored only when STORE_ANALYSES and STORE_RAW_INPUTS are both enabled.",
} as const;

export const BILL_TYPE_LABELS = {
  hr: "H.R.",
  s: "S.",
  hjres: "H.J.Res.",
  sjres: "S.J.Res.",
  hconres: "H.Con.Res.",
  sconres: "S.Con.Res.",
  hres: "H.Res.",
  sres: "S.Res.",
} as const;

export type BillType = keyof typeof BILL_TYPE_LABELS;

export function getRuntimeMode(env: Record<string, string | undefined> = process.env): RuntimeMode {
  return env[ENV_VARS.congressApiKey] ? LIVE_MODE : DEMO_MODE;
}

export function isTruthyEnv(value: string | undefined): boolean {
  return value === "1" || value?.toLowerCase() === "true" || value?.toLowerCase() === "yes";
}
