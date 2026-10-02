import { CitationSchema, type Citation } from "../ai/schemas";
import { redactSensitiveText } from "../privacy/redaction";

export type OfficialProviderId =
  | "govinfo"
  | "federal-register"
  | "regulations"
  | "ecfr"
  | "nara"
  | "courtlistener"
  | "usaspending"
  | "openfec"
  | "whitehouse";

export type OfficialSourceCandidate = {
  id: string;
  providerId: OfficialProviderId;
  title: string;
  excerpt: string;
  body: string;
  url: string;
  sourceType: Citation["sourceType"];
  tags: string[];
  citation: Citation;
  live?: boolean;
};

export type OfficialSourceFetchOptions = {
  env?: Record<string, string | undefined>;
  fetcher?: typeof fetch;
  timeoutMs?: number;
};

type ProviderDefinition = {
  id: OfficialProviderId;
  envKeys: string[];
  defaultBaseUrl: string;
  sourceType: Citation["sourceType"];
  title: string;
  excerpt: string;
  tags: string[];
  keywords: string[];
  buildUrl: (baseUrl: string, query: string, env: Record<string, string | undefined>) => string;
};

const PROVIDERS: ProviderDefinition[] = [
  {
    id: "govinfo",
    envKeys: ["GOVINFO_API_BASE", "GOVINFO_API_BASE_URL", "GOVINFO_API_KEY"],
    defaultBaseUrl: "https://api.govinfo.gov",
    sourceType: "govinfo",
    title: "GovInfo official publications search",
    excerpt: "GovInfo provides official publications from all three branches of the federal government.",
    tags: ["law", "public law", "statute", "budget", "appropriation", "federal register", "congressional record"],
    keywords: ["public law", "statute", "appropriation", "budget", "congressional record", "govinfo"],
    buildUrl: (baseUrl, query, env) => {
      const url = new URL("/app/search", publicGovInfoBase(baseUrl));
      url.searchParams.set("query", query);
      if (env.GOVINFO_API_KEY) url.searchParams.set("source", "api-configured");
      return url.toString();
    },
  },
  {
    id: "federal-register",
    envKeys: ["FEDERAL_REGISTER_API_BASE", "FEDERAL_REGISTER_API_BASE_URL"],
    defaultBaseUrl: "https://www.federalregister.gov/api/v1",
    sourceType: "federal-register",
    title: "Federal Register documents",
    excerpt: "The Federal Register publishes proposed rules, final rules, notices, and presidential documents.",
    tags: ["rule", "regulation", "notice", "agency", "executive order", "federal register"],
    keywords: ["rule", "regulation", "notice", "agency", "executive order", "federal register"],
    buildUrl: (_baseUrl, query) => {
      const url = new URL("https://www.federalregister.gov/documents/search");
      url.searchParams.set("conditions[term]", query);
      return url.toString();
    },
  },
  {
    id: "regulations",
    envKeys: ["REGULATIONS_API_BASE", "REGULATIONS_API_BASE_URL", "REGULATIONS_API_KEY"],
    defaultBaseUrl: "https://api.regulations.gov/v4",
    sourceType: "federal-register",
    title: "Regulations.gov docket search",
    excerpt: "Regulations.gov hosts federal rulemaking dockets, public comments, and supporting documents.",
    tags: ["rulemaking", "docket", "comment", "regulation", "agency"],
    keywords: ["rulemaking", "docket", "comment period", "public comment", "regulations.gov", "regulation"],
    buildUrl: (_baseUrl, query) => {
      const url = new URL("https://www.regulations.gov/search");
      url.searchParams.set("filter", query);
      return url.toString();
    },
  },
  {
    id: "ecfr",
    envKeys: ["ECFR_API_BASE", "ECFR_API_BASE_URL"],
    defaultBaseUrl: "https://www.ecfr.gov/api",
    sourceType: "federal-register",
    title: "Electronic Code of Federal Regulations",
    excerpt: "eCFR is the current, official-leaning presentation of federal regulations organized by title and part.",
    tags: ["cfr", "regulation", "code of federal regulations", "agency rule"],
    keywords: ["cfr", "code of federal regulations", "regulation", "agency rule", "title"],
    buildUrl: (_baseUrl, query) => {
      const url = new URL("https://www.ecfr.gov/search");
      url.searchParams.set("search[query]", query);
      return url.toString();
    },
  },
  {
    id: "nara",
    envKeys: ["NARA_CATALOG_API_BASE", "NARA_CATALOG_API_BASE_URL"],
    defaultBaseUrl: "https://catalog.archives.gov/api/v2",
    sourceType: "records",
    title: "National Archives Catalog",
    excerpt: "The National Archives Catalog describes federal records, founding documents, and archival materials.",
    tags: ["archives", "records", "founding documents", "constitution", "historical record"],
    keywords: ["archives", "records", "constitution", "bill of rights", "founding documents", "nara"],
    buildUrl: (_baseUrl, query) => {
      const url = new URL("https://catalog.archives.gov/search");
      url.searchParams.set("q", query);
      return url.toString();
    },
  },
  {
    id: "courtlistener",
    envKeys: ["COURTLISTENER_API_BASE", "COURTLISTENER_API_BASE_URL"],
    defaultBaseUrl: "https://www.courtlistener.com/api/rest/v4",
    sourceType: "courts",
    title: "CourtListener legal search",
    excerpt: "CourtListener provides searchable court opinions and legal materials from federal and state courts.",
    tags: ["court", "supreme court", "opinion", "judge", "case law"],
    keywords: ["court", "supreme court", "opinion", "ruling", "judge", "lawsuit", "case"],
    buildUrl: (_baseUrl, query) => {
      const url = new URL("https://www.courtlistener.com/");
      url.searchParams.set("q", query);
      return url.toString();
    },
  },
  {
    id: "usaspending",
    envKeys: ["USASPENDING_API_BASE", "USASPENDING_API_BASE_URL"],
    defaultBaseUrl: "https://api.usaspending.gov",
    sourceType: "other",
    title: "USAspending federal spending search",
    excerpt: "USAspending.gov tracks federal awards, recipients, agencies, and spending categories.",
    tags: ["spending", "grant", "contract", "award", "federal money", "agency spending"],
    keywords: ["spending", "grant", "contract", "award", "federal money", "usa spending", "usaspending"],
    buildUrl: (_baseUrl, query) => {
      const url = new URL("https://www.usaspending.gov/search");
      url.searchParams.set("keywords", query);
      return url.toString();
    },
  },
  {
    id: "openfec",
    envKeys: ["OPENFEC_API_BASE", "OPENFEC_API_BASE_URL", "OPENFEC_API_KEY"],
    defaultBaseUrl: "https://api.open.fec.gov/v1",
    sourceType: "elections",
    title: "Federal Election Commission data",
    excerpt: "The FEC publishes official campaign finance, committee, candidate, and election disclosure data.",
    tags: ["fec", "campaign finance", "committee", "candidate", "donation", "election"],
    keywords: ["fec", "campaign finance", "committee", "candidate", "donation", "election", "super pac"],
    buildUrl: (_baseUrl, query, env) => {
      const url = new URL("https://www.fec.gov/data/");
      url.searchParams.set("search_type", "candidates");
      url.searchParams.set("q", query);
      if (env.OPENFEC_API_KEY) url.searchParams.set("source", "api-configured");
      return url.toString();
    },
  },
  {
    id: "whitehouse",
    envKeys: ["WHITEHOUSE_BASE", "WHITEHOUSE_PRESIDENTIAL_ACTIONS_URL", "WHITEHOUSE_REMARKS_URL"],
    defaultBaseUrl: "https://www.whitehouse.gov",
    sourceType: "other",
    title: "White House official statements and actions",
    excerpt: "WhiteHouse.gov publishes presidential actions, statements, proclamations, fact sheets, and remarks.",
    tags: ["president", "white house", "executive order", "proclamation", "remarks", "statement"],
    keywords: ["president", "white house", "executive order", "proclamation", "remarks", "statement"],
    buildUrl: (_baseUrl, query, env) => {
      const base = env.WHITEHOUSE_PRESIDENTIAL_ACTIONS_URL || env.WHITEHOUSE_REMARKS_URL ||
        new URL("briefing-room/", `${trimTrailingSlash(_baseUrl)}/`).toString();
      const url = new URL(base);
      url.searchParams.set("s", query);
      return url.toString();
    },
  },
];

export function listConfiguredOfficialProviders(
  env: Record<string, string | undefined> = process.env,
): OfficialProviderId[] {
  return PROVIDERS.filter((provider) => provider.envKeys.some((key) => hasValue(env[key]))).map((provider) => provider.id);
}

export function buildOfficialSourceCandidates(
  query: string,
  limit = 4,
  env: Record<string, string | undefined> = process.env,
): OfficialSourceCandidate[] {
  const cleanQuery = normalizeQuery(redactSensitiveText(query));
  if (!cleanQuery) {
    return [];
  }

  const queryTerms = tokenize(cleanQuery);
  return PROVIDERS.map((provider) => ({
    provider,
    score: scoreProvider(provider, cleanQuery, queryTerms, env),
  }))
    .filter(({ provider }) => provider.envKeys.some((key) => hasValue(env[key])))
    .filter((entry) => entry.score > 0)
    .sort((left, right) => right.score - left.score || left.provider.title.localeCompare(right.provider.title))
    .slice(0, limit)
    .map(({ provider }) => providerToCandidate(provider, cleanQuery, env));
}

export function buildOfficialProviderHealth(
  env: Record<string, string | undefined> = process.env,
): Record<OfficialProviderId, boolean> {
  return Object.fromEntries(
    PROVIDERS.map((provider) => [provider.id, provider.envKeys.some((key) => hasValue(env[key]))]),
  ) as Record<OfficialProviderId, boolean>;
}

export async function resolveOfficialSourceCandidates(
  query: string,
  limit = 4,
  options: OfficialSourceFetchOptions = {},
): Promise<OfficialSourceCandidate[]> {
  const env = options.env ?? process.env;
  const safeQuery = normalizeQuery(redactSensitiveText(query));
  const candidates = buildOfficialSourceCandidates(safeQuery, limit, env);
  if (isExplicitlyDisabled(env.OFFICIAL_SOURCE_LIVE) || isExplicitlyDisabled(env.OFFICIAL_SOURCE_FETCH)) {
    return candidates;
  }

  const fetcher = options.fetcher ?? fetch;
  const timeoutMs = parseTimeoutMs(env.OFFICIAL_SOURCE_TIMEOUT_MS, options.timeoutMs ?? 1800);
  return Promise.all(
    candidates.map(async (candidate) => {
      try {
        const provider = PROVIDERS.find((item) => item.id === candidate.providerId);
        return provider ? await fetchProviderCandidate(candidate, provider, safeQuery, env, fetcher, timeoutMs) : candidate;
      } catch {
        return candidate;
      }
    }),
  );
}

async function fetchProviderCandidate(
  candidate: OfficialSourceCandidate,
  provider: ProviderDefinition,
  query: string,
  env: Record<string, string | undefined>,
  fetcher: typeof fetch,
  timeoutMs: number,
): Promise<OfficialSourceCandidate> {
  switch (provider.id) {
    case "govinfo":
      return fetchGovInfoCandidate(candidate, query, env, fetcher, timeoutMs);
    case "federal-register":
      return fetchFederalRegisterCandidate(candidate, query, env, fetcher, timeoutMs);
    case "regulations":
      return fetchRegulationsCandidate(candidate, query, env, fetcher, timeoutMs);
    case "ecfr":
      return fetchEcfrCandidate(candidate, query, env, fetcher, timeoutMs);
    case "nara":
      return fetchNaraCandidate(candidate, query, env, fetcher, timeoutMs);
    case "courtlistener":
      return fetchCourtListenerCandidate(candidate, query, env, fetcher, timeoutMs);
    case "usaspending":
      return fetchUsaSpendingCandidate(candidate, query, env, fetcher, timeoutMs);
    case "openfec":
      return fetchOpenFecCandidate(candidate, query, env, fetcher, timeoutMs);
    case "whitehouse":
      return fetchWhiteHouseCandidate(candidate, query, env, fetcher, timeoutMs);
  }
}

function providerToCandidate(
  provider: ProviderDefinition,
  query: string,
  env: Record<string, string | undefined>,
): OfficialSourceCandidate {
  const baseUrl = firstUrlValue(env, provider.envKeys) || provider.defaultBaseUrl;
  const url = provider.buildUrl(trimTrailingSlash(baseUrl), query, env);
  const id = `official-${provider.id}`;
  const excerpt = `${provider.excerpt} Use this official source family to check claims about ${provider.tags
    .slice(0, 4)
    .join(", ")}.`;
  const citation = CitationSchema.parse({
    id,
    sourceDocumentId: `${provider.id}-configured-search`,
    sourceType: provider.sourceType,
    title: provider.title,
    url,
    excerpt,
  });

  return {
    id,
    providerId: provider.id,
    title: provider.title,
    excerpt,
    body: `${excerpt} Query context: ${query}`,
    url,
    sourceType: provider.sourceType,
    tags: provider.tags,
    citation,
    live: false,
  };
}

async function fetchGovInfoCandidate(
  fallback: OfficialSourceCandidate,
  query: string,
  env: Record<string, string | undefined>,
  fetcher: typeof fetch,
  timeoutMs: number,
): Promise<OfficialSourceCandidate> {
  if (!env.GOVINFO_API_KEY) return fallback;

  const url = providerApiUrl(env, ["GOVINFO_API_BASE", "GOVINFO_API_BASE_URL"],
    "https://api.govinfo.gov",
    "search",
  );
  url.searchParams.set("api_key", env.GOVINFO_API_KEY);
  const payload = await fetchJson(url.toString(), fetcher, timeoutMs, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ query, pageSize: 1, offsetMark: "*" }),
  });
  const result = asArray(asRecord(payload)?.results)[0];
  const record = asRecord(result) ?? {};
  const packageId = readString(record, ["packageId"]);
  if (
    !packageId &&
    !readString(record, ["title", "snippet", "summary", "text"])
  )
    return fallback;
  return withLiveCitation(fallback, {
    title: readString(record, ["title"]) || fallback.title,
    url: readString(record, ["link", "resultLink"]) || (packageId ? `https://www.govinfo.gov/app/details/${packageId}` : fallback.url),
    sourceDate: readString(record, ["dateIssued", "publishDate"]),
    excerpt: stripHtml(readString(record, ["snippet", "summary", "text"]) || fallback.excerpt),
    sourceDocumentId: packageId,
  });
}

async function fetchFederalRegisterCandidate(
  fallback: OfficialSourceCandidate,
  query: string,
  env: Record<string, string | undefined>,
  fetcher: typeof fetch,
  timeoutMs: number,
): Promise<OfficialSourceCandidate> {
  const url = providerApiUrl(
    env,
    ["FEDERAL_REGISTER_API_BASE", "FEDERAL_REGISTER_API_BASE_URL"],
    "https://www.federalregister.gov/api/v1",
    "documents.json",
  );
  url.searchParams.set("conditions[term]", query);
  url.searchParams.set("per_page", "1");
  url.searchParams.set("order", "relevance");
  const payload = await fetchJson(url.toString(), fetcher, timeoutMs);
  const record = asRecord(asArray(asRecord(payload)?.results)[0]) ?? {};
  if (!readString(record, ["document_number", "title", "abstract"]))
    return fallback;
  return withLiveCitation(fallback, {
    title: readString(record, ["title"]) || fallback.title,
    url: readString(record, ["html_url", "pdf_url", "public_inspection_pdf_url"]) || fallback.url,
    sourceDate: readString(record, ["publication_date"]),
    excerpt: stripHtml(readString(record, ["abstract", "type"]) || fallback.excerpt),
    sourceDocumentId: readString(record, ["document_number"]),
  });
}

async function fetchRegulationsCandidate(
  fallback: OfficialSourceCandidate,
  query: string,
  env: Record<string, string | undefined>,
  fetcher: typeof fetch,
  timeoutMs: number,
): Promise<OfficialSourceCandidate> {
  const base = firstUrlValue(env, ["REGULATIONS_API_BASE", "REGULATIONS_API_BASE_URL"]) || "https://api.regulations.gov/v4";
  const url = new URL(`${trimTrailingSlash(base)}/documents`);
  url.searchParams.set("filter[searchTerm]", query);
  url.searchParams.set("page[size]", "1");
  if (env.REGULATIONS_API_KEY) url.searchParams.set("api_key", env.REGULATIONS_API_KEY);
  const payload = await fetchJson(url.toString(), fetcher, timeoutMs);
  const record = asRecord(asArray(asRecord(payload)?.data)[0]) ?? {};
  const attributes = asRecord(record.attributes) ?? {};
  const documentId = readString(attributes, ["documentId", "objectId"]) || readString(record, ["id"]);
  if (!documentId && !readString(attributes, ["title"])) return fallback;
  return withLiveCitation(fallback, {
    title: readString(attributes, ["title"]) || fallback.title,
    url: documentId ? `https://www.regulations.gov/document/${documentId}` : fallback.url,
    sourceDate: readString(attributes, ["postedDate", "commentEndDate"]),
    excerpt: stripHtml(readString(attributes, ["documentType", "agencyId"]) || fallback.excerpt),
    sourceDocumentId: documentId,
  });
}

async function fetchEcfrCandidate(
  fallback: OfficialSourceCandidate,
  query: string,
  env: Record<string, string | undefined>,
  fetcher: typeof fetch,
  timeoutMs: number,
): Promise<OfficialSourceCandidate> {
  const url = providerApiUrl(
    env,
    ["ECFR_API_BASE", "ECFR_API_BASE_URL"],
    "https://www.ecfr.gov/api",
    "search/v1/results",
  );
  url.searchParams.set("query", query);
  url.searchParams.set("page", "1");
  url.searchParams.set("per_page", "1");
  const payload = await fetchJson(url.toString(), fetcher, timeoutMs);
  const record = asRecord(asArray(asRecord(payload)?.results)[0]) ?? {};
  const hierarchy = asRecord(record.hierarchy) ?? {};
  const titleNumber = readString(hierarchy, ["title"]);
  const section = readString(record, ["section", "identifier"]);
  if (
    !titleNumber &&
    !section &&
    !readString(record, ["heading", "full_text_excerpt", "snippet"])
  )
    return fallback;
  return withLiveCitation(fallback, {
    title: [titleNumber ? `Title ${titleNumber}` : undefined, readString(record, ["type"]), readString(record, ["heading"])]
      .filter(Boolean)
      .join(" - ") || fallback.title,
    url: readString(record, ["url"]) || (titleNumber ? `https://www.ecfr.gov/current/title-${titleNumber}` : fallback.url),
    sourceDate: readString(record, ["starts_on"]),
    excerpt: stripHtml(readString(record, ["full_text_excerpt", "snippet", "heading"]) || fallback.excerpt),
    sourceDocumentId: section || titleNumber,
  });
}

async function fetchNaraCandidate(
  fallback: OfficialSourceCandidate,
  query: string,
  env: Record<string, string | undefined>,
  fetcher: typeof fetch,
  timeoutMs: number,
): Promise<OfficialSourceCandidate> {
  const url = providerApiUrl(
    env,
    ["NARA_CATALOG_API_BASE", "NARA_CATALOG_API_BASE_URL"],
    "https://catalog.archives.gov/api/v2",
    "records/search",
  );
  url.searchParams.set("q", query);
  url.searchParams.set("rows", "1");
  const payload = await fetchJson(url.toString(), fetcher, timeoutMs);
  const hit = asRecord(asArray(asRecord(asRecord(payload)?.body)?.hits)[0]) || asRecord(asArray(asRecord(asRecord(asRecord(payload)?.body)?.hits)?.hits)[0]);
  const source = asRecord(hit?._source) ?? hit ?? {};
  const record = asRecord(source.record) ?? source;
  const naId = readString(record, ["naId", "naIds", "identifier"]);
  if (
    !naId &&
    !readString(record, ["title", "scopeAndContentNote", "description"])
  )
    return fallback;
  return withLiveCitation(fallback, {
    title: readString(record, ["title"]) || fallback.title,
    url: naId ? `https://catalog.archives.gov/id/${naId}` : fallback.url,
    sourceDate: readString(record, ["inclusiveStartDate", "date"]),
    excerpt: stripHtml(readString(record, ["scopeAndContentNote", "description"]) || fallback.excerpt),
    sourceDocumentId: naId,
  });
}

async function fetchCourtListenerCandidate(
  fallback: OfficialSourceCandidate,
  query: string,
  env: Record<string, string | undefined>,
  fetcher: typeof fetch,
  timeoutMs: number,
): Promise<OfficialSourceCandidate> {
  const url = providerApiUrl(
    env,
    ["COURTLISTENER_API_BASE", "COURTLISTENER_API_BASE_URL"],
    "https://www.courtlistener.com/api/rest/v4",
    "search/",
  );
  url.searchParams.set("q", query);
  url.searchParams.set("type", "o");
  const payload = await fetchJson(url.toString(), fetcher, timeoutMs);
  const record = asRecord(asArray(asRecord(payload)?.results)[0]) ?? {};
  const absoluteUrl = readString(record, ["absolute_url"]);
  if (
    !absoluteUrl &&
    !readString(record, [
      "id",
      "cluster_id",
      "caseName",
      "caseNameFull",
      "case_name",
      "snippet",
    ])
  )
    return fallback;
  return withLiveCitation(fallback, {
    title: readString(record, ["caseName", "caseNameFull", "case_name"]) || fallback.title,
    url: absoluteUrl ? new URL(absoluteUrl, "https://www.courtlistener.com").toString() : fallback.url,
    sourceDate: readString(record, ["dateFiled", "date_filed"]),
    excerpt: stripHtml(readString(record, ["snippet", "plain_text", "summary"]) || fallback.excerpt),
    sourceDocumentId: readString(record, ["id", "cluster_id"]),
  });
}

async function fetchUsaSpendingCandidate(
  fallback: OfficialSourceCandidate,
  query: string,
  env: Record<string, string | undefined>,
  fetcher: typeof fetch,
  timeoutMs: number,
): Promise<OfficialSourceCandidate> {
  const url = providerApiUrl(
    env,
    ["USASPENDING_API_BASE", "USASPENDING_API_BASE_URL"],
    "https://api.usaspending.gov",
    "api/v2/search/spending_by_award/",
  );
  const payload = await fetchJson(url.toString(), fetcher, timeoutMs, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      filters: { keywords: [query] },
      fields: ["Award ID", "Recipient Name", "Award Amount", "Awarding Agency"],
      page: 1,
      limit: 1,
      sort: "Award Amount",
      order: "desc",
    }),
  });
  const record = asRecord(asArray(asRecord(payload)?.results)[0]) ?? {};
  const awardId = readString(record, ["Award ID", "generated_unique_award_id"]);
  if (!awardId && !readString(record, ["Recipient Name", "recipient_name"]))
    return fallback;
  return withLiveCitation(fallback, {
    title: readString(record, ["Recipient Name", "recipient_name"]) || fallback.title,
    url: awardId ? `https://www.usaspending.gov/award/${encodeURIComponent(awardId)}` : fallback.url,
    excerpt: stripHtml(readString(record, ["Awarding Agency", "awarding_agency"]) || fallback.excerpt),
    sourceDocumentId: awardId,
  });
}

async function fetchOpenFecCandidate(
  fallback: OfficialSourceCandidate,
  query: string,
  env: Record<string, string | undefined>,
  fetcher: typeof fetch,
  timeoutMs: number,
): Promise<OfficialSourceCandidate> {
  if (!env.OPENFEC_API_KEY) return fallback;

  const base = firstUrlValue(env, ["OPENFEC_API_BASE", "OPENFEC_API_BASE_URL"]) || "https://api.open.fec.gov/v1";
  const url = new URL(`${trimTrailingSlash(base)}/candidates/search/`);
  url.searchParams.set("q", query);
  url.searchParams.set("per_page", "1");
  url.searchParams.set("api_key", env.OPENFEC_API_KEY);
  const payload = await fetchJson(url.toString(), fetcher, timeoutMs);
  const record = asRecord(asArray(asRecord(payload)?.results)[0]) ?? {};
  const candidateId = readString(record, ["candidate_id"]);
  if (!candidateId && !readString(record, ["name"])) return fallback;
  return withLiveCitation(fallback, {
    title: readString(record, ["name"]) || fallback.title,
    url: candidateId ? `https://www.fec.gov/data/candidate/${candidateId}/` : fallback.url,
    sourceDate: readString(record, ["last_file_date"]),
    excerpt: stripHtml(
      [readString(record, ["office_full", "office"]), readString(record, ["party_full", "party"]), readString(record, ["state"])]
        .filter(Boolean)
        .join(" - ") || fallback.excerpt,
    ),
    sourceDocumentId: candidateId,
  });
}

async function fetchWhiteHouseCandidate(
  fallback: OfficialSourceCandidate,
  query: string,
  env: Record<string, string | undefined>,
  fetcher: typeof fetch,
  timeoutMs: number,
): Promise<OfficialSourceCandidate> {
  const url = providerApiUrl(
    env,
    ["WHITEHOUSE_BASE"],
    whiteHouseOrigin(env),
    "wp-json/wp/v2/search",
  );
  url.searchParams.set("search", query);
  url.searchParams.set("per_page", "1");
  const payload = await fetchJson(url.toString(), fetcher, timeoutMs);
  const record = asRecord(asArray(payload)[0]) ?? {};
  if (!readString(record, ["id", "title", "url"])) return fallback;
  return withLiveCitation(fallback, {
    title: stripHtml(readString(record, ["title"]) || fallback.title),
    url: readString(record, ["url"]) || fallback.url,
    excerpt: stripHtml(readString(record, ["subtype", "type"]) || fallback.excerpt),
    sourceDocumentId: readString(record, ["id"]),
  });
}

function scoreProvider(
  provider: ProviderDefinition,
  query: string,
  queryTerms: string[],
  env: Record<string, string | undefined>,
): number {
  const configured = provider.envKeys.some((key) => hasValue(env[key]));
  const providerText = `${provider.id} ${provider.tags.join(" ")} ${provider.keywords.join(" ")}`;
  const matchedTerms = queryTerms.filter((term) => providerText.includes(term));
  let score = matchedTerms.length * 3;

  if (provider.keywords.some((keyword) => query.includes(keyword))) {
    score += 6;
  }
  if (configured) {
    score += 2;
  }
  if (configured && score > 2) {
    score += 4;
  }

  return score;
}

function normalizeQuery(input: string): string {
  return input.toLowerCase().replace(/\s+/g, " ").trim().slice(0, 240);
}

function tokenize(input: string): string[] {
  return Array.from(new Set(input.match(/[a-z0-9]+/g) || [])).filter((term) => term.length > 2);
}

function hasValue(value: string | undefined): boolean {
  return Boolean(value?.trim());
}

function firstUrlValue(env: Record<string, string | undefined>, keys: string[]): string | undefined {
  return keys.map((key) => env[key]?.trim()).find((value): value is string => {
    if (!value) return false;
    try {
      const url = new URL(value);
      return ["https:", "http:"].includes(url.protocol) && !url.username && !url.password;
    } catch {
      return false;
    }
  });
}

function trimTrailingSlash(input: string): string {
  return input.replace(/\/+$/, "");
}

function providerApiUrl(
  env: Record<string, string | undefined>,
  keys: string[],
  defaultBase: string,
  path: string,
): URL {
  const base = firstUrlValue(env, keys) || defaultBase;
  return new URL(`${trimTrailingSlash(base)}/${path}`);
}

function whiteHouseOrigin(env: Record<string, string | undefined>): string {
  const configured = firstUrlValue(env, [
    "WHITEHOUSE_PRESIDENTIAL_ACTIONS_URL",
    "WHITEHOUSE_REMARKS_URL",
  ]);
  return configured ? new URL(configured).origin : "https://www.whitehouse.gov";
}

function sanitizeSourceUrl(value: string): string {
  const url = new URL(value);
  for (const key of [...url.searchParams.keys()]) {
    if (/^(?:api[_-]?key|access[_-]?token|token|authorization)$/i.test(key)) {
      url.searchParams.delete(key);
      continue;
    }
    const values = url.searchParams.getAll(key).map(redactSensitiveText);
    url.searchParams.delete(key);
    values.forEach((item) => url.searchParams.append(key, item));
  }
  url.pathname = redactSensitiveText(decodeURIComponent(url.pathname));
  url.hash = "";
  return url.toString();
}

function publicGovInfoBase(baseUrl: string): string {
  return baseUrl.includes("api.govinfo.gov") ? "https://www.govinfo.gov" : baseUrl;
}

function withLiveCitation(
  fallback: OfficialSourceCandidate,
  update: {
    title?: string;
    url?: string;
    sourceDate?: string;
    excerpt?: string;
    sourceDocumentId?: string;
  },
): OfficialSourceCandidate {
  const title = truncate(cleanText(update.title) || fallback.title, 240);
  const excerpt = truncate(cleanText(update.excerpt) || fallback.excerpt, 1200);
  const url = update.url && isValidUrl(update.url) ? sanitizeSourceUrl(update.url) : fallback.url;
  const sourceDocumentId = truncate(cleanText(update.sourceDocumentId) || fallback.citation.sourceDocumentId, 160);
  const citation = CitationSchema.parse({
    ...fallback.citation,
    title,
    url,
    sourceDate: truncate(cleanText(update.sourceDate), 40) || undefined,
    excerpt,
    sourceDocumentId,
  });

  return {
    ...fallback,
    title,
    excerpt,
    body: excerpt,
    url,
    citation,
    live: true,
  };
}

async function fetchJson(
  url: string,
  fetcher: typeof fetch,
  timeoutMs: number,
  init: RequestInit = {},
): Promise<unknown> {
  const controller = new AbortController();
  let timeout: ReturnType<typeof setTimeout> | undefined;
  const deadline = new Promise<never>((_, reject) => {
    timeout = setTimeout(() => {
      controller.abort();
      reject(new Error("Official source request timed out"));
    }, timeoutMs);
  });
  try {
    return await Promise.race([
      (async () => {
        const response = await fetcher(url, {
          ...init,
          signal: controller.signal,
          headers: {
            Accept: "application/json",
            ...(init.headers || {}),
          },
        });
        if (!response.ok) throw new Error("Official source request failed");
        return await response.json();
      })(),
      deadline,
    ]);
  } finally {
    clearTimeout(timeout);
  }
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
  return input.replace(/<[^>]*>/g, " ");
}

function cleanText(input: string | undefined): string {
  return redactSensitiveText(input || "").replace(/\s+/g, " ").trim();
}

function truncate(input: string | undefined, maxLength: number): string {
  const clean = cleanText(input);
  if (clean.length <= maxLength) {
    return clean;
  }

  return `${clean.slice(0, maxLength - 3).replace(/\s+\S*$/, "").trim()}...`;
}

function isValidUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === "https:" && !url.username && !url.password;
  } catch {
    return false;
  }
}

function parseTimeoutMs(raw: string | undefined, defaultMs: number): number {
  const parsed = Number.parseInt(raw || "", 10);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return defaultMs;
  }

  return Math.min(parsed, 8000);
}

function isExplicitlyDisabled(value: string | undefined): boolean {
  return value === "0" || value?.toLowerCase() === "false" || value?.toLowerCase() === "no";
}
