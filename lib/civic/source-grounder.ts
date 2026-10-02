import { z } from "zod";
import { redactSensitiveText } from "../privacy/redaction";
import sourcePacksJson from "../../data/source-packs.json";
import { CitationSchema, type BillType, type Citation } from "../ai/schemas";
import {
  buildReadableBillFields,
  dedupeTimelineActions,
  sanitizeBillText,
  sanitizeBillTextList,
  type BillReadableFields,
} from "../ai/summarize-bill";
import { validateCitations } from "../ai/validators";
import {
  rankLexically,
  searchDatabaseLexically,
  type RankedDocument,
  type SearchableDocument,
} from "../db/lexical-search";
import { searchDatabaseVectors } from "../db/vector-search";
import { resolveOfficialSourceCandidates } from "./official-source-connectors";

export type ParsedBillRef = {
  raw: string;
  congress?: number;
  type: BillType;
  number: number;
};

export type GroundedSource = SearchableDocument & {
  citation: Citation;
  tags: string[];
};

export type BillAction = { date?: string; text: string };

export type BillVote = {
  chamber: string;
  date?: string;
  result: string;
  url?: string;
};

export type BillDetailBase = {
  congress: number;
  type: BillType;
  number: number;
  title: string;
  shortTitle?: string;
  latestAction?: string;
  summary: string;
  sponsors: string[];
  subjects: string[];
  actions: BillAction[];
  votes: BillVote[];
  citations: Citation[];
  mode: "live" | "demo";
};

export type BillDetail = BillDetailBase & BillReadableFields;

const SourcePackSchema = z
  .object({
    id: z.string().min(1),
    title: z.string().min(1),
    excerpt: z.string().min(1),
    body: z.string().min(1),
    url: z.string().url(),
    sourceType: z.string().min(1),
    tags: z.array(z.string()).default([]),
    citation: CitationSchema,
  })
  .strict();

function sourcePackToGroundedSource(
  sourcePack: z.infer<typeof SourcePackSchema>,
): GroundedSource {
  return {
    id: sourcePack.id,
    title: sourcePack.title,
    body: sourcePack.body,
    excerpt: sourcePack.excerpt,
    url: sourcePack.url,
    sourceType: sourcePack.sourceType,
    citation: sourcePack.citation,
    tags: sourcePack.tags,
  };
}

const SOURCE_PACKS = z.array(SourcePackSchema).parse(sourcePacksJson);
const SOURCE_PACK_DOCUMENTS: GroundedSource[] = SOURCE_PACKS.map(
  sourcePackToGroundedSource,
);
const SOURCE_PACK_STOPWORDS = new Set([
  "about",
  "after",
  "also",
  "and",
  "are",
  "best",
  "can",
  "did",
  "does",
  "for",
  "from",
  "has",
  "have",
  "how",
  "into",
  "the",
  "that",
  "this",
  "who",
  "what",
  "when",
  "where",
  "why",
  "which",
  "with",
  "would",
  "your",
]);

export const DEMO_BILL: BillDetail = enrichBillDetail({
  congress: 118,
  type: "hr",
  number: 82,
  title: "Social Security Fairness Act of 2023",
  latestAction: "Became Public Law No: 118-273.",
  summary:
    "H.R. 82 in the 118th Congress amended title II of the Social Security Act to repeal the government pension offset and windfall elimination provisions.",
  sponsors: ["Rep. Garret Graves"],
  subjects: ["Social Security", "Public pensions", "Retirement benefits"],
  actions: [
    { date: "2023-01-09", text: "Introduced in the House." },
    { date: "2025-01-05", text: "Became Public Law No: 118-273." },
  ],
  votes: [
    {
      chamber: "House",
      date: "2024-11-12",
      result: "Passed/agreed to in House.",
      url: "https://www.congress.gov/bill/118th-congress/house-bill/82/actions",
    },
    {
      chamber: "Senate",
      date: "2024-12-21",
      result: "Passed Senate.",
      url: "https://www.congress.gov/bill/118th-congress/house-bill/82/actions",
    },
  ],
  citations: [
    {
      id: "hr82-congress",
      sourceDocumentId: "118-hr-82",
      sourceType: "congress",
      title: "H.R.82 - Social Security Fairness Act of 2023",
      url: "https://www.congress.gov/bill/118th-congress/house-bill/82",
      sourceDate: "2025-01-05",
      excerpt:
        "Congress.gov identifies H.R. 82 in the 118th Congress as the Social Security Fairness Act of 2023 and lists its legislative actions.",
      bill: { congress: 118, type: "hr", number: 82 },
    },
    {
      id: "hr82-govinfo-law",
      sourceDocumentId: "PLAW-118publ273",
      sourceType: "govinfo",
      title: "Public Law 118-273",
      url: "https://www.govinfo.gov/content/pkg/PLAW-118publ273/html/PLAW-118publ273.htm",
      sourceDate: "2025-01-05",
      excerpt:
        "Public Law 118-273 amended title II of the Social Security Act to repeal the government pension offset and windfall elimination provisions.",
      bill: { congress: 118, type: "hr", number: 82 },
    },
  ],
  mode: "demo",
});

const BUILT_IN_DEMO_DOCUMENTS: GroundedSource[] = [
  {
    id: "source-hr82-law",
    title: "H.R. 82 became Public Law 118-273",
    excerpt: DEMO_BILL.summary,
    body: [
      DEMO_BILL.summary,
      "Students can compare claims about this bill with Congress.gov actions and the enrolled public law text on GovInfo.",
    ].join(" "),
    url: DEMO_BILL.citations[0].url,
    sourceType: "congress",
    citation: DEMO_BILL.citations[0],
    tags: ["bill", "social security", "wep", "gpo", "hr82"],
  },
  {
    id: "source-citations",
    title: "Official citations matter for civic claims",
    excerpt:
      "CivicLens answers should separate what official sources say from what is unknown or unsupported by the available sources.",
    body: "A reliable civic explanation names official sources, quotes or summarizes only the supported details, and clearly marks missing context.",
    url: "https://www.congress.gov/help",
    sourceType: "congress",
    citation: {
      id: "congress-help",
      sourceDocumentId: "congress-help",
      sourceType: "congress",
      title: "Congress.gov Help",
      url: "https://www.congress.gov/help",
      excerpt:
        "Congress.gov provides official legislative information that can ground student explanations about bills and legislative actions.",
    },
    tags: ["citations", "sources", "civic literacy"],
  },
  {
    id: "source-district-lookup",
    title: "District lookup privacy",
    excerpt:
      "A district lookup can be performed server-side without storing the raw address or sending it to a language model.",
    body: "Raw addresses are sensitive. CivicLens uses an address only for geocoding, then returns district context with a privacy note.",
    url: "https://geocoding.geo.census.gov/geocoder/",
    sourceType: "census",
    citation: {
      id: "census-geocoder",
      sourceDocumentId: "census-geocoder",
      sourceType: "census",
      title: "Census Geocoder",
      url: "https://geocoding.geo.census.gov/geocoder/",
      excerpt:
        "The Census Geocoder supports address lookup workflows for geographic information.",
    },
    tags: ["district", "privacy", "address", "census"],
  },
];

export const DEMO_SOURCE_DOCUMENTS: GroundedSource[] = [
  ...BUILT_IN_DEMO_DOCUMENTS,
  ...SOURCE_PACK_DOCUMENTS,
];

export async function retrieveGroundedSources(
  query: string,
  limit = 5,
): Promise<{
  citations: Citation[];
  documents: GroundedSource[];
  mode: "live" | "demo";
  validationErrors: string[];
}> {
  query = redactSensitiveText(query);
  const billRef = parseBillReference(query);
  if (billRef) {
    return retrieveBillSpecificSources(billRef, limit);
  }

  const [vectorResults, lexicalDbResults, officialCandidates] =
    await Promise.all([
      searchDatabaseVectors(query, limit),
      searchDatabaseLexically(query, limit),
      resolveOfficialSourceCandidates(query, limit),
    ]);

  const dbDocuments = [...vectorResults, ...lexicalDbResults]
    .map(dbResultToGroundedSource)
    .filter((document): document is GroundedSource => Boolean(document));
  const sourcePackDocuments = rankSourcePackDocuments(query, limit);
  const officialDocuments = officialCandidates.map(
    officialCandidateToGroundedSource,
  );
  const documents = dedupeById([
    ...dbDocuments,
    ...officialDocuments,
    ...sourcePackDocuments,
  ]).slice(0, limit);
  const citationValidation = validateAndFilterCitations(
    documents.map((document) => document.citation),
  );

  const validCitationIds = new Set(
    citationValidation.citations.map((citation) => citation.id),
  );
  const validDocuments = documents.filter((document) =>
    validCitationIds.has(document.citation.id),
  );
  const liveIds = new Set([
    ...dbDocuments.map((document) => document.id),
    ...officialCandidates
      .filter((candidate) => candidate.live === true)
      .map((candidate) => candidate.id),
  ]);

  return {
    citations: citationValidation.citations,
    documents: validDocuments,
    mode: validDocuments.some((document) => liveIds.has(document.id))
      ? "live"
      : "demo",
    validationErrors: citationValidation.errors,
  };
}

export function searchDemoSources(
  query: string,
  limit = 10,
): Array<RankedDocument<GroundedSource>> {
  return rankLexically(query, DEMO_SOURCE_DOCUMENTS, limit);
}

export function parseBillReference(query: string): ParsedBillRef | null {
  const patterns: Array<[BillType, RegExp]> = [
    ["hconres", /\bH\.?\s*Con\.?\s*Res\.?\s*(\d+)\b/i],
    ["sconres", /\bS\.?\s*Con\.?\s*Res\.?\s*(\d+)\b/i],
    ["hjres", /\bH\.?\s*J\.?\s*Res\.?\s*(\d+)\b/i],
    ["sjres", /\bS\.?\s*J\.?\s*Res\.?\s*(\d+)\b/i],
    ["hres", /\bH\.?\s*Res\.?\s*(\d+)\b/i],
    ["sres", /\bS\.?\s*Res\.?\s*(\d+)\b/i],
    ["hr", /\bH\.?\s*R\.?\s*(\d+)\b/i],
    ["s", /\bS\.?\s*(\d+)\b/i],
  ];

  for (const [type, pattern] of patterns) {
    const match = query.match(pattern);
    if (!match) {
      continue;
    }

    const congressMatch = query.match(
      /\b(\d{1,3})(?:st|nd|rd|th)?\s+Congress\b/i,
    );
    return {
      raw: match[0],
      congress: congressMatch ? Number(congressMatch[1]) : undefined,
      type,
      number: Number(match[1]),
    };
  }

  return null;
}

export function getDemoBill(
  congress: number,
  type: BillType,
  number: number,
): BillDetail | null {
  if (
    congress === DEMO_BILL.congress &&
    type === DEMO_BILL.type &&
    number === DEMO_BILL.number
  ) {
    return DEMO_BILL;
  }

  return null;
}

async function retrieveBillSpecificSources(
  ref: ParsedBillRef,
  limit: number,
): Promise<{
  citations: Citation[];
  documents: GroundedSource[];
  mode: "live" | "demo";
  validationErrors: string[];
}> {
  const candidates = getCongressCandidates(ref);
  let bill: BillDetail | null = null;

  for (const congress of candidates) {
    bill =
      (await fetchCongressBill(congress, ref.type, ref.number)) ||
      getExactDemoBill(congress, ref.type, ref.number);
    if (bill) {
      break;
    }
  }

  if (!bill) {
    return {
      citations: [],
      documents: [],
      mode: "demo",
      validationErrors: [],
    };
  }

  const candidateDocuments = billToGroundedSources(bill).slice(0, limit);
  const citationValidation = validateAndFilterCitations(
    candidateDocuments.map((document) => document.citation),
  );
  const validCitationIds = new Set(
    citationValidation.citations.map((citation) => citation.id),
  );
  const documents = candidateDocuments.filter((document) =>
    validCitationIds.has(document.citation.id),
  );

  return {
    citations: citationValidation.citations,
    documents,
    mode: bill.mode,
    validationErrors: citationValidation.errors,
  };
}

export async function fetchCongressBill(
  congress: number,
  type: BillType,
  number: number,
): Promise<BillDetail | null> {
  const apiKey = process.env.CONGRESS_API_KEY;
  if (!apiKey) {
    return null;
  }

  const baseUrl =
    process.env.CONGRESS_API_BASE_URL ||
    process.env.CONGRESS_API_BASE ||
    "https://api.congress.gov/v3";
  const billPath = `${baseUrl}/bill/${congress}/${type}/${number}`;
  const controller = new AbortController();
  const configuredTimeout = Number(process.env.CONGRESS_TIMEOUT_MS ?? 12_000);
  const timeoutMs = Number.isFinite(configuredTimeout)
    ? Math.min(30_000, Math.max(1_000, configuredTimeout))
    : 12_000;
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const [billResponse, summariesResponse, actionsResponse] =
      await Promise.all([
        withAbortDeadline(
          fetch(`${billPath}?api_key=${apiKey}&format=json`, {
            next: { revalidate: 3600 },
            signal: controller.signal,
          }),
          controller.signal,
        ),
        withAbortDeadline(
          fetch(`${billPath}/summaries?api_key=${apiKey}&format=json`, {
            next: { revalidate: 3600 },
            signal: controller.signal,
          }),
          controller.signal,
        ),
        withAbortDeadline(
          fetch(`${billPath}/actions?api_key=${apiKey}&format=json`, {
            next: { revalidate: 3600 },
            signal: controller.signal,
          }),
          controller.signal,
        ),
      ]);

    if (!billResponse.ok) {
      return null;
    }

    const billPayload = (await withAbortDeadline(
      billResponse.json(),
      controller.signal,
    )) as {
      bill?: {
        congress?: unknown;
        type?: unknown;
        number?: unknown;
        title?: string;
        shortTitle?: string;
        latestAction?: { text?: string; actionDate?: string };
        sponsors?: Array<{
          fullName?: string;
          firstName?: string;
          lastName?: string;
        }>;
        subjects?: { legislativeSubjects?: Array<{ name?: string }> };
        url?: string;
      };
    };
    const bill = billPayload.bill;
    if (
      !bill?.title ||
      !matchesCongressIdentity(bill, congress, type, number)
    ) {
      return null;
    }

    const summariesPayload = summariesResponse.ok
      ? ((await withAbortDeadline(
          summariesResponse.json(),
          controller.signal,
        )) as {
          summaries?: Array<{ text?: string; updateDate?: string }>;
        })
      : { summaries: [] };
    const actionsPayload = actionsResponse.ok
      ? ((await withAbortDeadline(
          actionsResponse.json(),
          controller.signal,
        )) as {
          actions?: Array<{ text?: string; actionDate?: string }>;
        })
      : { actions: [] };

    const title = sanitizeBillText(bill.title);
    const shortTitle = sanitizeBillText(bill.shortTitle);
    const latestAction = sanitizeBillText(bill.latestAction?.text);
    const officialSummary = sanitizeBillText(
      summariesPayload.summaries?.[0]?.text,
    );
    const url = `https://www.congress.gov/bill/${congress}th-congress/${congressBillPathSegment(type)}/${number}`;
    const billIdentity = { congress, type, number };
    const summaryDate = sanitizeBillText(
      summariesPayload.summaries?.[0]?.updateDate,
    );
    const citations = [
      latestAction
        ? CitationSchema.parse({
            id: `${congress}-${type}-${number}-action`,
            sourceDocumentId: `${congress}-${type}-${number}-action`,
            sourceType: "congress",
            title: `${title} - latest official action`,
            url,
            sourceDate:
              sanitizeBillText(bill.latestAction?.actionDate) || undefined,
            excerpt: citationExcerpt(latestAction),
            bill: billIdentity,
          })
        : null,
      officialSummary
        ? CitationSchema.parse({
            id: `${congress}-${type}-${number}-summary`,
            sourceDocumentId: `${congress}-${type}-${number}-summary`,
            sourceType: "congress",
            title: `${title} - official summary`,
            url,
            sourceDate: summaryDate || undefined,
            excerpt: citationExcerpt(officialSummary),
            bill: billIdentity,
          })
        : null,
    ].filter((citation): citation is Citation => Boolean(citation));

    if (citations.length === 0) {
      citations.push(
        CitationSchema.parse({
          id: `${congress}-${type}-${number}-record`,
          sourceDocumentId: `${congress}-${type}-${number}-record`,
          sourceType: "congress",
          title,
          url,
          excerpt: citationExcerpt(title),
          bill: billIdentity,
        }),
      );
    }

    return enrichBillDetail({
      congress,
      type,
      number,
      title,
      ...(shortTitle ? { shortTitle } : {}),
      latestAction,
      summary: officialSummary,
      sponsors: (bill.sponsors || [])
        .map(
          (sponsor) =>
            sponsor.fullName ||
            [sponsor.firstName, sponsor.lastName].filter(Boolean).join(" "),
        )
        .filter(Boolean),
      subjects: (bill.subjects?.legislativeSubjects || [])
        .map((subject) => subject.name || "")
        .filter(Boolean),
      actions: (actionsPayload.actions || [])
        .map((action) => ({ date: action.actionDate, text: action.text || "" }))
        .filter((action) => action.text),
      votes: [],
      citations,
      mode: "live",
    });
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

function withAbortDeadline<T>(
  operation: Promise<T>,
  signal: AbortSignal,
): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const abort = () => reject(new Error("Congress request timed out"));
    if (signal.aborted) {
      // Consume the pending operation's rejection even when the deadline already elapsed.
      operation.catch(() => undefined);
      abort();
      return;
    }
    signal.addEventListener("abort", abort, { once: true });
    operation
      .then(resolve, reject)
      .finally(() => signal.removeEventListener("abort", abort));
  });
}

function matchesCongressIdentity(
  bill: { congress?: unknown; type?: unknown; number?: unknown },
  congress: number,
  type: BillType,
  number: number,
): boolean {
  return (
    (bill.congress === undefined ||
      ((typeof bill.congress === "string" ||
        typeof bill.congress === "number") &&
        Number(bill.congress) === congress)) &&
    (bill.number === undefined ||
      ((typeof bill.number === "string" || typeof bill.number === "number") &&
        Number(bill.number) === number)) &&
    (bill.type === undefined ||
      (typeof bill.type === "string" &&
        bill.type.toLowerCase().replace(/[.\s]/g, "") === type))
  );
}

function enrichBillDetail(detail: BillDetailBase): BillDetail {
  const title = sanitizeBillText(detail.title);
  const shortTitle = sanitizeBillText(detail.shortTitle);
  const latestAction = sanitizeBillText(detail.latestAction);
  const actions = dedupeTimelineActions(detail.actions).slice(0, 12);
  const sponsors = sanitizeBillTextList(detail.sponsors);
  const subjects = sanitizeBillTextList(detail.subjects);
  const votes = detail.votes
    .map(sanitizeVote)
    .filter((vote) => vote.chamber && vote.result);
  const citations = dedupeCitations(detail.citations.map(sanitizeCitation));
  const summary = sanitizeBillText(detail.summary);
  const readable = buildReadableBillFields({
    title,
    shortTitle,
    latestAction,
    summary,
    subjects,
    actions,
  });

  return {
    ...detail,
    title: title || readable.simpleTitle,
    ...(shortTitle ? { shortTitle } : {}),
    latestAction: latestAction || undefined,
    summary: summary || readable.oneLineSummary,
    sponsors,
    subjects,
    actions,
    votes,
    citations,
    ...readable,
  };
}

function sanitizeVote(vote: BillVote): BillVote {
  const chamber = sanitizeBillText(vote.chamber);
  const result = sanitizeBillText(vote.result);
  const date = sanitizeBillText(vote.date);
  const url = sanitizeBillText(vote.url);

  return {
    chamber,
    result,
    ...(date ? { date } : {}),
    ...(url ? { url } : {}),
  };
}

function sanitizeCitation(citation: Citation): Citation {
  return {
    ...citation,
    title: sanitizeBillText(citation.title) || "Official source",
    sourceDate: sanitizeBillText(citation.sourceDate) || undefined,
    excerpt: citationExcerpt(citation.excerpt),
  };
}

function getExactDemoBill(
  congress: number,
  type: BillType,
  number: number,
): BillDetail | null {
  return congress === DEMO_BILL.congress &&
    type === DEMO_BILL.type &&
    number === DEMO_BILL.number
    ? DEMO_BILL
    : null;
}

function getCongressCandidates(ref: ParsedBillRef): number[] {
  if (ref.congress) {
    return [ref.congress];
  }

  const candidates = new Set<number>();
  if (ref.type === DEMO_BILL.type && ref.number === DEMO_BILL.number) {
    candidates.add(DEMO_BILL.congress);
  }

  const configuredCongress = Number(
    process.env.CURRENT_CONGRESS || process.env.DEFAULT_CONGRESS,
  );
  if (Number.isInteger(configuredCongress) && configuredCongress > 0) {
    candidates.add(configuredCongress);
  }

  candidates.add(inferCurrentCongress());
  return [...candidates];
}

function billToGroundedSources(bill: BillDetail): GroundedSource[] {
  const body = [
    bill.summary,
    bill.latestAction,
    ...bill.actions.map((action) => action.text),
    ...bill.votes.map((vote) => vote.result),
  ]
    .filter(Boolean)
    .join(" ");

  return bill.citations.map((citation) => ({
    id: `bill-source-${citation.id}`,
    title: citation.title,
    body,
    excerpt: citation.excerpt,
    url: citation.url,
    sourceType: citation.sourceType,
    citation,
    tags: [
      "bill",
      bill.type,
      `${bill.type}${bill.number}`,
      `${bill.type} ${bill.number}`,
      bill.title,
      ...bill.subjects,
    ],
  }));
}

function rankSourcePackDocuments(
  query: string,
  limit: number,
): Array<RankedDocument<GroundedSource>> {
  const normalizedQuery = normalizeForSourcePack(query);
  const queryTerms = tokenizeSourcePackQuery(normalizedQuery);
  if (queryTerms.length === 0) {
    return [];
  }

  return SOURCE_PACK_DOCUMENTS.map((document) => {
    const title = normalizeForSourcePack(document.title);
    const body = normalizeForSourcePack(
      [document.excerpt, document.body].filter(Boolean).join(" "),
    );
    const tags = normalizeForSourcePack(document.tags.join(" "));
    let score = 0;

    if (normalizedQuery.length > 4 && title.includes(normalizedQuery)) {
      score += 12;
    }
    if (normalizedQuery.length > 4 && body.includes(normalizedQuery)) {
      score += 8;
    }

    for (const term of queryTerms) {
      if (tags.split(" ").includes(term)) {
        score += 6;
      } else if (tags.includes(term)) {
        score += 4;
      }
      if (title.includes(term)) {
        score += 4;
      }
      if (body.includes(term)) {
        score += 1;
      }
    }

    return { ...document, score, matchType: "lexical" as const };
  })
    .filter((document) => document.score >= 2)
    .sort(
      (left, right) =>
        right.score - left.score || left.title.localeCompare(right.title),
    )
    .slice(0, limit);
}

function tokenizeSourcePackQuery(query: string): string[] {
  return Array.from(new Set(query.match(/[a-z0-9]+/g) || [])).filter(
    (term) => term.length > 2 && !SOURCE_PACK_STOPWORDS.has(term),
  );
}

function normalizeForSourcePack(input: string): string {
  return input.toLowerCase().replace(/\s+/g, " ").trim();
}

function dbResultToGroundedSource(
  result: RankedDocument,
): GroundedSource | null {
  if (!result.url) return null;
  const citation = CitationSchema.safeParse({
    id: `db-${result.id}`,
    sourceDocumentId: result.id,
    sourceType: result.sourceType || "other",
    title: result.title,
    url: result.url,
    excerpt: result.excerpt || result.body || result.title,
  });

  if (!citation.success || !validateCitations([citation.data]).ok) {
    return null;
  }

  return {
    id: result.id,
    title: result.title,
    body: result.body,
    excerpt: result.excerpt,
    url: result.url,
    sourceType: result.sourceType,
    citation: citation.data,
    tags: [],
  };
}

function officialCandidateToGroundedSource(
  candidate: Awaited<
    ReturnType<typeof resolveOfficialSourceCandidates>
  >[number],
): GroundedSource {
  return {
    id: candidate.id,
    title: candidate.title,
    body: candidate.body,
    excerpt: candidate.excerpt,
    url: candidate.url,
    sourceType: candidate.sourceType,
    citation: candidate.citation,
    tags: candidate.tags,
  };
}

function dedupeById<T extends { id: string }>(items: T[]): T[] {
  const seen = new Set<string>();
  return items.filter((item) => {
    if (seen.has(item.id)) {
      return false;
    }
    seen.add(item.id);
    return true;
  });
}

function dedupeCitations(citations: Citation[]): Citation[] {
  return dedupeById(citations);
}

function validateAndFilterCitations(citations: Citation[]): {
  citations: Citation[];
  errors: string[];
} {
  const validation = validateCitations(citations);
  const validCitations = dedupeCitations(citations).filter(
    (citation) => validateCitations([citation]).ok,
  );

  return {
    citations: validCitations,
    errors: validation.errors,
  };
}

function congressBillPathSegment(type: BillType): string {
  switch (type) {
    case "hr":
      return "house-bill";
    case "s":
      return "senate-bill";
    case "hjres":
      return "house-joint-resolution";
    case "sjres":
      return "senate-joint-resolution";
    case "hconres":
      return "house-concurrent-resolution";
    case "sconres":
      return "senate-concurrent-resolution";
    case "hres":
      return "house-resolution";
    case "sres":
      return "senate-resolution";
  }

  const exhaustive: never = type;
  return exhaustive;
}

function citationExcerpt(value: unknown): string {
  const clean = sanitizeBillText(value) || "Official source record.";
  if (clean.length <= 1200) {
    return clean;
  }

  return `${clean
    .slice(0, 1197)
    .replace(/\s+\S*$/, "")
    .trim()}...`;
}

function inferCurrentCongress(now = new Date()): number {
  const year = now.getUTCFullYear();
  const termYear =
    now.getUTCMonth() === 0 && now.getUTCDate() < 3 ? year - 1 : year;
  return Math.floor((termYear - 1789) / 2) + 1;
}
