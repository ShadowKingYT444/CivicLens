import {
  ENV_VARS,
  INPUT_LIMITS,
  NETWORK_LIMITS,
  OFFICIAL_SOURCE_URLS,
  isTruthyEnv,
} from "../constants";
import { ValidationError } from "../errors";
import {
  createDemoDistrictResult,
  noMatchResult,
  parseCensusGeocoderResponse,
  type DistrictLookupResult,
} from "../civic/district-parser";

export interface CensusClientOptions {
  baseUrl?: string;
  live?: boolean;
  fetcher?: typeof fetch;
  timeoutMs?: number;
  fixture?: DistrictLookupResult;
  env?: Record<string, string | undefined>;
}

export interface CensusClient {
  configured: boolean;
  lookupDistrict(address: string): Promise<DistrictLookupResult>;
}

let censusClientSingleton: CensusClient | undefined;

export function createCensusClient(options: CensusClientOptions = {}): CensusClient {
  const env = options.env ?? process.env;
  const configured = options.live ?? isCensusGeocoderConfigured(env);
  const baseUrl = trimTrailingSlash(options.baseUrl ?? env[ENV_VARS.censusApiBaseUrl] ?? OFFICIAL_SOURCE_URLS.censusGeocoder);
  const fetcher = options.fetcher ?? fetch;
  const timeoutMs = options.timeoutMs ?? NETWORK_LIMITS.censusTimeoutMs;
  const fixture = options.fixture ?? createDemoDistrictResult();

  return {
    configured,
    async lookupDistrict(address: string): Promise<DistrictLookupResult> {
      validateAddress(address);

      if (!configured) {
        return fixture;
      }

      try {
        const payload = await fetchJson(buildCensusUrl(baseUrl, address), fetcher, timeoutMs);
        return parseCensusGeocoderResponse(payload);
      } catch {
        return fixture;
      }
    },
  };
}

export function getCensusClient(options?: CensusClientOptions): CensusClient {
  if (options) {
    return createCensusClient(options);
  }

  censusClientSingleton ??= createCensusClient();
  return censusClientSingleton;
}

export function isCensusGeocoderConfigured(env: Record<string, string | undefined> = process.env): boolean {
  const flags = [env.CENSUS_GEOCODER_ENABLED, env.CENSUS_GEOCODER_LIVE];
  if (flags.some((value) => /^(false|0|no)$/i.test(value?.trim() || ""))) return false;
  if (flags.some((value) => isTruthyEnv(value))) return true;
  if (isTruthyEnv(env.DEMO_MODE)) return false;
  const base = env.CENSUS_GEOCODER_URL || env.CENSUS_GEOCODER_BASE_URL || env.CENSUS_GEOCODER_BASE;
  if (!base) return false;
  try { return ["https:", "http:"].includes(new URL(base).protocol); } catch { return false; }
}

function buildCensusUrl(baseUrl: string, address: string): string {
  const url = new URL(`${baseUrl}/geographies/onelineaddress`);
  url.searchParams.set("address", address);
  url.searchParams.set("benchmark", "Public_AR_Current");
  url.searchParams.set("vintage", "Current_Current");
  url.searchParams.set("layers", "all");
  url.searchParams.set("format", "json");
  return url.toString();
}

async function fetchJson(url: string, fetcher: typeof fetch, timeoutMs: number): Promise<unknown> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetcher(url, { signal: controller.signal });
    if (!response.ok) {
      return noMatchResult("live");
    }
    return response.json();
  } finally {
    clearTimeout(timeout);
  }
}

function validateAddress(address: string): void {
  const normalized = address.trim();
  if (
    normalized.length < INPUT_LIMITS.addressMinLength ||
    normalized.length > INPUT_LIMITS.addressMaxLength
  ) {
    throw new ValidationError("Address length is outside the supported range.", {
      min: INPUT_LIMITS.addressMinLength,
      max: INPUT_LIMITS.addressMaxLength,
    });
  }
}

function trimTrailingSlash(input: string): string {
  return input.endsWith("/") ? input.slice(0, -1) : input;
}
