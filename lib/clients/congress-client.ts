import {
  BILL_TYPE_LABELS,
  ENV_VARS,
  NETWORK_LIMITS,
  OFFICIAL_SOURCE_URLS,
  type BillType,
  type RuntimeMode,
  DEMO_MODE,
  LIVE_MODE,
} from "../constants";
import { ExternalServiceError, NotFoundError } from "../errors";
import { congressBillUrl, parseBillRefs, type ParsedBillRef } from "../civic/bill-parser";

export type CongressClientSource = "live" | "fixture";

export type CongressClientResult<T> =
  | {
      ok: true;
      source: CongressClientSource;
      data: T;
    }
  | {
      ok: false;
      source: CongressClientSource;
      reason: string;
      data: T;
    };

export interface CongressCitation {
  id: string;
  sourceDocumentId: string;
  sourceType: "congress_bill" | "congress_summary" | "congress_action";
  title: string;
  url: string;
  sourceDate?: string;
  excerpt: string;
  bill?: {
    congress: number;
    type: BillType;
    number: number;
  };
}

export interface CongressAction {
  date?: string;
  text: string;
  type?: string;
}

export interface CongressSponsor {
  name: string;
  state?: string;
  party?: string;
  bioguideId?: string;
}

export interface CongressBillDetail {
  source: CongressClientSource;
  congress: number;
  type: BillType;
  number: number;
  title: string;
  shortTitle?: string;
  introducedDate?: string;
  latestAction?: CongressAction;
  sponsors: CongressSponsor[];
  subjects: string[];
  summaries: Array<{
    date?: string;
    text: string;
  }>;
  actions: CongressAction[];
  citations: CongressCitation[];
}

export interface CongressSearchResult {
  source: CongressClientSource;
  congress: number;
  type: BillType;
  number: number;
  title: string;
  url?: string;
  latestAction?: CongressAction;
}

export interface CongressVoteRecord {
  source: CongressClientSource;
  congress: number;
  chamber: "house" | "senate";
  rollCall?: number;
  date?: string;
  question?: string;
  result?: string;
  bill?: {
    type: BillType;
    number: number;
  };
}

export interface CongressMemberRecord {
  source: CongressClientSource;
  bioguideId?: string;
  name: string;
  chamber?: "house" | "senate";
  state?: string;
  district?: string;
  party?: string;
  url?: string;
}

export interface ListBillsOptions {
  congress?: number;
  limit?: number;
}

export interface ListMembersOptions extends ListBillsOptions {
  currentMember?: boolean;
}

export interface CongressClientOptions {
  apiKey?: string;
  baseUrl?: string;
  fetcher?: typeof fetch;
  timeoutMs?: number;
  fixtures?: CongressBillDetail[];
  env?: Record<string, string | undefined>;
}

export interface CongressClient {
  mode: RuntimeMode;
  configured: boolean;
  getBill(ref: ParsedBillRef): Promise<CongressBillDetail>;
  searchBills(query: string, limit?: number): Promise<CongressSearchResult[]>;
  listBills(options?: number | ListBillsOptions, limit?: number): Promise<CongressClientResult<CongressSearchResult[]>>;
  listHouseVotes(options?: number | Pick<ListBillsOptions, "congress">): Promise<CongressClientResult<CongressVoteRecord[]>>;
  listMembersByCongress(options?: number | ListMembersOptions): Promise<CongressClientResult<CongressMemberRecord[]>>;
}

let congressClientSingleton: CongressClient | undefined;

const DEFAULT_FIXTURE_BILL: CongressBillDetail = {
  source: "fixture",
  congress: 118,
  type: "hr",
  number: 2670,
  title: "National Defense Authorization Act for Fiscal Year 2024",
  shortTitle: "NDAA for Fiscal Year 2024",
  introducedDate: "2023-04-18",
  latestAction: {
    date: "2023-12-22",
    text: "Became Public Law No: 118-31.",
    type: "became_law",
  },
  sponsors: [
    {
      name: "Rep. Mike Rogers",
      state: "AL",
      party: "R",
      bioguideId: "R000575",
    },
  ],
  subjects: ["Armed Forces and National Security"],
  summaries: [
    {
      date: "2023-12-22",
      text:
        "Fixture summary for local demo mode: this bill became Public Law 118-31. Use live Congress.gov configuration for current official detail.",
    },
  ],
  actions: [
    {
      date: "2023-12-22",
      text: "Became Public Law No: 118-31.",
      type: "became_law",
    },
  ],
  citations: [
    {
      id: "congress-118-hr-2670",
      sourceDocumentId: "118-hr-2670",
      sourceType: "congress_bill",
      title: "H.R. 2670 - National Defense Authorization Act for Fiscal Year 2024",
      url: "https://www.congress.gov/bill/118th-congress/house-bill/2670",
      sourceDate: "2023-12-22",
      excerpt:
        "Demo fixture based on the Congress.gov bill record. Configure CONGRESS_API_KEY for live official responses.",
      bill: {
        congress: 118,
        type: "hr",
        number: 2670,
      },
    },
  ],
};

export function createCongressClient(options: CongressClientOptions = {}): CongressClient {
  const env = options.env ?? process.env;
  const apiKey = options.apiKey ?? env[ENV_VARS.congressApiKey];
  const baseUrl = trimTrailingSlash(
    options.baseUrl ??
      env[ENV_VARS.congressApiBaseUrl] ??
      env.CONGRESS_API_BASE ??
      OFFICIAL_SOURCE_URLS.congressApi,
  );
  const fetcher = options.fetcher ?? fetch;
  const timeoutMs = options.timeoutMs ?? NETWORK_LIMITS.congressTimeoutMs;
  const fixtures = options.fixtures?.length ? options.fixtures : [DEFAULT_FIXTURE_BILL];
  const configured = Boolean(apiKey);

  return {
    mode: configured ? LIVE_MODE : DEMO_MODE,
    configured,
    async getBill(ref: ParsedBillRef): Promise<CongressBillDetail> {
      if (!configured || !ref.congress) {
        return findFixture(fixtures, ref);
      }

      try {
        const detailUrl = buildCongressUrl(baseUrl, apiKey, `/bill/${ref.congress}/${ref.type}/${ref.number}`);
        const summariesUrl = buildCongressUrl(baseUrl, apiKey, `/bill/${ref.congress}/${ref.type}/${ref.number}/summaries`);
        const actionsUrl = buildCongressUrl(baseUrl, apiKey, `/bill/${ref.congress}/${ref.type}/${ref.number}/actions`);
        const [detailResult, summariesResult, actionsResult] = await Promise.allSettled([
          fetchJson(detailUrl, fetcher, timeoutMs),
          fetchJson(summariesUrl, fetcher, timeoutMs),
          fetchJson(actionsUrl, fetcher, timeoutMs),
        ]);

        if (detailResult.status === "rejected") {
          throw detailResult.reason;
        }

        return mapBillDetail(ref, detailResult.value, summariesResult, actionsResult);
      } catch {
        return findFixture(fixtures, ref);
      }
    },
    async searchBills(query: string, limit = 10): Promise<CongressSearchResult[]> {
      const parsedRefs = parseBillRefs(query);
      if (!configured) {
        return searchFixtureBills(fixtures, query, parsedRefs, limit);
      }

      // The official API offers bill lists and exact references, not free-text search.
      // Keyword searches below are intentionally bounded to the latest 250 bills.
      const safeLimit = Math.min(250, Math.max(1, Math.trunc(limit) || 10));
      try {
        if (parsedRefs.length) {
          const details = await Promise.allSettled(parsedRefs.slice(0, safeLimit).map((ref) =>
            this.getBill({ ...ref, congress: ref.congress ?? currentCongress(env) }),
          ));
          return details.flatMap((detail) => detail.status === "fulfilled"
            ? fixturesToSearchResults([detail.value], 1).map((bill) => ({ ...bill, source: detail.value.source }))
            : []);
        }
        const url = buildCongressUrl(baseUrl, apiKey, `/bill/${currentCongress(env)}`, {
          limit: "250",
        });
        const payload = await fetchJson(url, fetcher, timeoutMs);
        const words = query.trim().toLowerCase().split(/\s+/).filter(Boolean);
        return mapSearchResults(payload).filter((bill) => words.every((word) =>
          `${bill.title} ${bill.latestAction?.text ?? ""}`.toLowerCase().includes(word),
        )).slice(0, safeLimit);
      } catch {
        return searchFixtureBills(fixtures, query, parsedRefs, safeLimit);
      }
    },
    async listBills(options, limit): Promise<CongressClientResult<CongressSearchResult[]>> {
      const resolved = resolveListOptions(options, limit);
      if (!configured) {
        return okResult(fixturesToSearchResults(fixtures.filter((bill) => bill.congress === resolved.congress), resolved.limit), "fixture");
      }

      try {
        const url = buildCongressUrl(baseUrl, apiKey, `/bill/${resolved.congress}`, { limit: String(resolved.limit) });
        const payload = await fetchJson(url, fetcher, timeoutMs);
        return okResult(mapSearchResults(payload).slice(0, resolved.limit), "live");
      } catch {
        return okResult(fixturesToSearchResults(fixtures.filter((bill) => bill.congress === resolved.congress), resolved.limit), "fixture");
      }
    },
    async listHouseVotes(options): Promise<CongressClientResult<CongressVoteRecord[]>> {
      const congress = resolveCongressOption(options);
      return okResult(fixtures
        .filter((bill) => bill.congress === congress)
        .map((bill) => ({
          source: "fixture",
          congress: bill.congress,
          chamber: "house",
          date: bill.latestAction?.date,
          question: bill.title,
          result: bill.latestAction?.text,
          bill: {
            type: bill.type,
            number: bill.number,
          },
        })), "fixture");
    },
    async listMembersByCongress(options): Promise<CongressClientResult<CongressMemberRecord[]>> {
      const { congress, limit } = resolveListOptions(options);
      return okResult(fixtures
        .filter((bill) => bill.congress === congress)
        .flatMap((bill) =>
          bill.sponsors.map((sponsor) => ({
            source: "fixture" as const,
            bioguideId: sponsor.bioguideId,
            name: sponsor.name,
            chamber: bill.type.startsWith("h") ? ("house" as const) : ("senate" as const),
            state: sponsor.state,
            party: sponsor.party,
          })),
        )
        .slice(0, limit), "fixture");
    },
  };
}

export function getCongressClient(options?: CongressClientOptions): CongressClient {
  if (options) {
    return createCongressClient(options);
  }

  congressClientSingleton ??= createCongressClient();
  return congressClientSingleton;
}

export function isCongressApiConfigured(env: Record<string, string | undefined> = process.env): boolean {
  return Boolean(env[ENV_VARS.congressApiKey]);
}

function buildCongressUrl(
  baseUrl: string,
  apiKey: string | undefined,
  path: string,
  params: Record<string, string> = {},
): string {
  const url = new URL(`${baseUrl}${path}`);
  url.searchParams.set("format", "json");
  if (apiKey) {
    url.searchParams.set("api_key", apiKey);
  }
  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, value);
  }
  return url.toString();
}

async function fetchJson(url: string, fetcher: typeof fetch, timeoutMs: number): Promise<unknown> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetcher(url, { signal: controller.signal });
    if (!response.ok) {
      throw new ExternalServiceError("Congress.gov", response.status);
    }
    return response.json();
  } finally {
    clearTimeout(timeout);
  }
}

function mapBillDetail(
  ref: ParsedBillRef,
  detailPayload: unknown,
  summariesResult: PromiseSettledResult<unknown>,
  actionsResult: PromiseSettledResult<unknown>,
): CongressBillDetail {
  const bill = asRecord(asRecord(detailPayload)?.bill);
  if (!bill || Number(bill.number) !== ref.number || Number(bill.congress) !== ref.congress || normalizeCongressBillType(String(bill.type)) !== ref.type) {
    throw new NotFoundError("The official bill response did not match the requested bill.");
  }
  const title = readString(bill, ["title", "shortTitle"]) ?? `${BILL_TYPE_LABELS[ref.type]} ${ref.number}`;
  const summaryPayload = summariesResult.status === "fulfilled" ? summariesResult.value : undefined;
  const actionPayload = actionsResult.status === "fulfilled" ? actionsResult.value : undefined;
  const summaries = mapSummaries(summaryPayload);
  const actions = mapActions(actionPayload);
  const latestAction = mapAction(asRecord(bill.latestAction)) ?? actions[0];
  const url = congressBillUrl(ref) ?? readString(bill, ["url"]) ?? OFFICIAL_SOURCE_URLS.congressBill;

  return {
    source: "live",
    congress: ref.congress ?? (Number(readString(bill, ["congress"])) || 0),
    type: ref.type,
    number: ref.number,
    title,
    shortTitle: readString(bill, ["shortTitle"]),
    introducedDate: readString(bill, ["introducedDate"]),
    latestAction,
    sponsors: mapSponsors(bill.sponsors),
    subjects: mapSubjects(bill),
    summaries,
    actions,
    citations: [
      {
        id: `congress-${ref.congress ?? "unknown"}-${ref.type}-${ref.number}`,
        sourceDocumentId: `${ref.congress ?? "unknown"}-${ref.type}-${ref.number}`,
        sourceType: "congress_bill",
        title,
        url,
        sourceDate: latestAction?.date,
        excerpt: latestAction?.text ?? summaries[0]?.text ?? "Congress.gov bill record.",
        bill: {
          congress: ref.congress ?? 0,
          type: ref.type,
          number: ref.number,
        },
      },
    ],
  };
}

function mapSearchResults(payload: unknown): CongressSearchResult[] {
  const bills = asArray(asRecord(payload)?.bills);
  return bills.map((value) => {
    const bill = asRecord(value) ?? {};
    const type = normalizeCongressBillType(readString(bill, ["type"]) ?? "") ?? "hr";
    const congress = Number(readString(bill, ["congress"]));
    const number = Number(readString(bill, ["number"]));
    return {
      source: "live",
      congress: Number.isFinite(congress) ? congress : 0,
      type,
      number: Number.isFinite(number) ? number : 0,
      title: readString(bill, ["title", "shortTitle"]) ?? `${BILL_TYPE_LABELS[type]} ${number}`,
      url: congressBillUrl({ raw: "", congress, type, number }),
      latestAction: mapAction(asRecord(bill.latestAction)),
    };
  });
}

function mapSummaries(payload: unknown): CongressBillDetail["summaries"] {
  return asArray(asRecord(payload)?.summaries).map((value) => {
    const summary = asRecord(value) ?? {};
    return {
      date: readString(summary, ["updateDate", "actionDate"]),
      text: stripHtml(readString(summary, ["text"]) ?? ""),
    };
  }).filter((summary) => summary.text.length > 0);
}

function mapActions(payload: unknown): CongressAction[] {
  return asArray(asRecord(payload)?.actions)
    .map((value) => mapAction(asRecord(value)))
    .filter((action): action is CongressAction => Boolean(action?.text));
}

function mapAction(action: Record<string, unknown> | undefined): CongressAction | undefined {
  if (!action) {
    return undefined;
  }

  const text = readString(action, ["text", "actionCode"]);
  if (!text) {
    return undefined;
  }

  return {
    date: readString(action, ["actionDate", "date"]),
    text,
    type: readString(action, ["type", "actionCode"]),
  };
}

function mapSponsors(value: unknown): CongressSponsor[] {
  return asArray(value).map((item) => {
    const sponsor = asRecord(item) ?? {};
    return {
      name: readString(sponsor, ["fullName", "name", "directOrderName"]) ?? "Unknown sponsor",
      state: readString(sponsor, ["state"]),
      party: readString(sponsor, ["party"]),
      bioguideId: readString(sponsor, ["bioguideId"]),
    };
  });
}

function mapSubjects(bill: Record<string, unknown>): string[] {
  const policyArea = readString(asRecord(bill.policyArea) ?? {}, ["name"]);
  const subjects = asArray(asRecord(bill.subjects)?.legislativeSubjects)
    .map((subject) => readString(asRecord(subject) ?? {}, ["name"]))
    .filter((subject): subject is string => Boolean(subject));
  return [...new Set([policyArea, ...subjects].filter((subject): subject is string => Boolean(subject)))];
}

function searchFixtureBills(
  fixtures: CongressBillDetail[],
  query: string,
  parsedRefs: ParsedBillRef[],
  limit: number,
): CongressSearchResult[] {
  const normalizedQuery = query.trim().toLowerCase();
  const results = fixtures.filter((bill) => {
    return (
      parsedRefs.some((ref) => billMatchesRef(bill, ref)) ||
      bill.title.toLowerCase().includes(normalizedQuery) ||
      bill.shortTitle?.toLowerCase().includes(normalizedQuery)
    );
  });

  return results.slice(0, limit).map((bill) => ({
    source: "fixture",
    congress: bill.congress,
    type: bill.type,
    number: bill.number,
    title: bill.title,
    url: congressBillUrl({ raw: "", congress: bill.congress, type: bill.type, number: bill.number }),
    latestAction: bill.latestAction,
  }));
}

function fixturesToSearchResults(fixtures: CongressBillDetail[], limit: number): CongressSearchResult[] {
  return fixtures.slice(0, limit).map((bill) => ({
    source: "fixture",
    congress: bill.congress,
    type: bill.type,
    number: bill.number,
    title: bill.title,
    url: congressBillUrl({ raw: "", congress: bill.congress, type: bill.type, number: bill.number }),
    latestAction: bill.latestAction,
  }));
}

function okResult<T>(data: T, source: CongressClientSource): CongressClientResult<T> {
  return { ok: true, source, data };
}

function resolveCongressOption(options: number | Pick<ListBillsOptions, "congress"> | undefined): number {
  if (typeof options === "number") {
    return options;
  }

  return options?.congress ?? currentCongress(process.env);
}

function resolveListOptions(options?: number | ListBillsOptions, limit?: number): Required<ListBillsOptions> {
  if (typeof options === "number") {
    return {
      congress: options,
      limit: limit ?? 20,
    };
  }

  return {
    congress: options?.congress ?? currentCongress(process.env),
    limit: options?.limit ?? limit ?? 20,
  };
}

function currentCongress(env: Record<string, string | undefined>) {
  const value = Number(env.CURRENT_CONGRESS ?? 119);
  return Number.isInteger(value) && value > 0 ? value : 119;
}

function findFixture(fixtures: CongressBillDetail[], ref: ParsedBillRef): CongressBillDetail {
  const matched = fixtures.find((bill) => billMatchesRef(bill, ref));
  if (!matched) throw new NotFoundError("No matching official bill or saved example is available.");
  return matched;
}

function billMatchesRef(bill: CongressBillDetail, ref: ParsedBillRef): boolean {
  return bill.type === ref.type && bill.number === ref.number && (!ref.congress || bill.congress === ref.congress);
}

function normalizeCongressBillType(input: string): BillType | undefined {
  const normalized = input.toLowerCase().replace(/[^a-z]/g, "");
  const match = (Object.keys(BILL_TYPE_LABELS) as BillType[]).find((type) => type === normalized);
  return match;
}

function asRecord(value: unknown): Record<string, unknown> | undefined {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : undefined;
}

function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function readString(record: Record<string, unknown>, keys: string[]): string | undefined {
  for (const key of keys) {
    const value = record[key];
    if (typeof value === "string" && value.trim()) {
      return value.trim();
    }
    if (typeof value === "number") {
      return String(value);
    }
  }
  return undefined;
}

function stripHtml(input: string): string {
  return input.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
}

function trimTrailingSlash(input: string): string {
  return input.endsWith("/") ? input.slice(0, -1) : input;
}
