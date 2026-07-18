import trendingBills from "../../data/trending-bills.json";
import { z } from "zod";
import { congressBillUrl } from "./bill-parser";
import type { BillType } from "../constants";
import {
  getCongressClient,
  type CongressBillDetail,
  type CongressClient,
  type CongressSearchResult,
} from "../clients/congress-client";
import {
  buildBillCitationPacket,
  createDeterministicBillExplainer,
  generateBillExplainer,
  isMatchingBillDetail,
  type BillEnrichmentCitation,
  type BillEnrichmentResult,
} from "../ai/bill-enrichment";

export const TRENDING_BILL_LIMIT = 16;
export const MIN_TRENDING_BILL_LIMIT = 1;
export const MAX_TRENDING_BILL_LIMIT = 24;

const MIN_LIVE_CANDIDATE_POOL = 64;
const MAX_LIVE_CANDIDATE_POOL = 144;
const DETAIL_CONCURRENCY = 4;
const MAX_LLM_ENRICHMENTS = 2;
const BILL_PIPELINE_DEADLINE_MS = 18_000;

const billTypeSchema = z.enum([
  "hr",
  "s",
  "hjres",
  "sjres",
  "hconres",
  "sconres",
  "hres",
  "sres",
]);
const citedTextSchema = z
  .object({
    text: z.string().trim().min(1),
    citationIds: z.array(z.string().trim().min(1)).min(1),
  })
  .strict();
const sourceCitationSchema = z
  .object({
    id: z.string().trim().min(1),
    sourceDocumentId: z.string().trim().min(1),
    sourceType: z.enum([
      "congress_bill",
      "congress_summary",
      "congress_action",
    ]),
    publisher: z.literal("Congress.gov"),
    title: z.string().trim().min(1),
    url: z.string().url(),
    sourceDate: z.string().trim().min(1).optional(),
    excerpt: z.string().trim().min(1),
    bill: z
      .object({
        congress: z.number().int().positive(),
        type: billTypeSchema,
        number: z.number().int().positive(),
      })
      .strict(),
  })
  .strict();
const trendingBillFixtureSchema = z
  .object({
    id: z.string().trim().min(1),
    slug: z.string().trim().min(1),
    congress: z.number().int().positive(),
    type: billTypeSchema,
    number: z.number().int().positive(),
    title: z.string().trim().min(1),
    shortTitle: z.string().trim().min(1).optional(),
    impactLabel: z.string().trim().min(1),
    issueArea: z.string().trim().min(1),
    hook: z.string().trim().min(1),
    hookCitationIds: z.array(z.string().trim().min(1)).min(1).optional(),
    keyPoints: z.array(citedTextSchema).min(3).max(5),
    currentStep: citedTextSchema.extend({
      label: z.string().trim().min(1),
      date: z.string().trim().min(1).optional(),
    }),
    whyItMatters: citedTextSchema,
    whatChanges: citedTextSchema,
    whoIsAffected: citedTextSchema,
    detailRouteTarget: z.string().regex(/^\/bills\/\d+\/[a-z]+\/\d+$/),
    citations: z.array(sourceCitationSchema).min(1),
  })
  .strict()
  .superRefine((bill, context) => {
    const knownIds = new Set(bill.citations.map((citation) => citation.id));
    const citedIds = [
      ...(bill.hookCitationIds ?? []),
      ...bill.keyPoints.flatMap((point) => point.citationIds),
      ...bill.currentStep.citationIds,
      ...bill.whyItMatters.citationIds,
      ...bill.whatChanges.citationIds,
      ...bill.whoIsAffected.citationIds,
    ];
    if (citedIds.some((citationId) => !knownIds.has(citationId))) {
      context.addIssue({
        code: "custom",
        message: "Fixture text references an unknown citation id",
      });
    }
    if (
      bill.citations.some(
        (citation) =>
          citation.bill.congress !== bill.congress ||
          citation.bill.type !== bill.type ||
          citation.bill.number !== bill.number,
      )
    ) {
      context.addIssue({
        code: "custom",
        message: "Fixture citation identity does not match its bill",
      });
    }
  });
const trendingBillsFixtureSchema = z
  .object({ bills: z.array(trendingBillFixtureSchema).min(1) })
  .strict();

type CitedText = z.infer<typeof citedTextSchema>;
type TrendingBillFixture = z.infer<typeof trendingBillFixtureSchema>;

export type SourceCitation = BillEnrichmentCitation;

export type TrendingBillCard = {
  type: "bill";
  title: string;
  label: string;
  href: string;
  detailRouteTarget: string;
  url: string;
  snippet: string;
  quest: string;
  mode: "fixture" | "live";
  impactLabel: string;
  issueArea: string;
  hook: string;
  hookCitationIds: string[];
  keyPoints: CitedText[];
  currentStep: CitedText & {
    label: string;
    date?: string;
  };
  whyItMatters: CitedText;
  whatChanges: CitedText;
  whoIsAffected: CitedText;
  enrichment: {
    method: "llm" | "deterministic";
    provider?: "nim" | "groq";
    officialDetail: boolean;
  };
  sourceCount: number;
  citations: SourceCitation[];
  bill: {
    congress: number;
    type: BillType;
    number: number;
    title: string;
    latestAction?: string;
  };
};

export type RankedLiveBill = {
  bill: CongressSearchResult;
  score: number;
  impactLabel: string;
  issueArea: string;
};

export type TrendingBillsFeed = {
  mode: "fixture" | "live";
  congress: number;
  composition: {
    kind: "fixture" | "live" | "mixed";
    liveCount: number;
    fixtureCount: number;
  };
  results: TrendingBillCard[];
};

const highImpactRules: Array<{
  pattern: RegExp;
  impactLabel: string;
  issueArea: string;
  score: number;
}> = [
  {
    pattern:
      /\b(reconciliation|budget|appropriation|tax|debt limit|debt ceiling|spending)\b/i,
    impactLabel: "High impact: budget and taxes",
    issueArea: "Budget and taxes",
    score: 6,
  },
  {
    pattern: /\b(immigration|border|non-u\.?s\.? national|detain)\b/i,
    impactLabel: "High impact: immigration",
    issueArea: "Immigration",
    score: 5,
  },
  {
    pattern: /\b(health|medicare|medicaid|mental health|substance|patients)\b/i,
    impactLabel: "High impact: health",
    issueArea: "Health",
    score: 5,
  },
  {
    pattern: /\b(fentanyl|crime|public safety|law enforcement)\b/i,
    impactLabel: "High impact: public safety",
    issueArea: "Public safety",
    score: 5,
  },
  {
    pattern:
      /\b(technology|digital|online|cybersecurity|stablecoin|payment)\b/i,
    impactLabel: "High impact: technology",
    issueArea: "Technology",
    score: 5,
  },
  {
    pattern: /\b(education|school|student|lunch)\b/i,
    impactLabel: "High impact: education",
    issueArea: "Education",
    score: 4,
  },
  {
    pattern: /\b(social security|retirement|pension)\b/i,
    impactLabel: "High impact: retirement benefits",
    issueArea: "Retirement benefits",
    score: 4,
  },
  {
    pattern: /\b(defense|armed forces|national security)\b/i,
    impactLabel: "High impact: defense",
    issueArea: "Defense",
    score: 4,
  },
];

const LIVE_HIGH_IMPACT_MIN_SCORE = 5;
const lowImpactPattern =
  /\b(rename|designate|commemorative|coin|post office|mint|anniversary)\b/i;
const fixtureBills: TrendingBillFixture[] =
  trendingBillsFixtureSchema.parse(trendingBills).bills;

export function getDemoTrendingBills(
  limit = TRENDING_BILL_LIMIT,
): TrendingBillCard[] {
  return fixtureBills
    .slice(0, normalizeLimit(limit))
    .map((bill) => fixtureToCard(bill));
}

export function getTrendingBillFixtures(
  limit = TRENDING_BILL_LIMIT,
): TrendingBillCard[] {
  return getDemoTrendingBills(limit);
}

export async function getTrendingBillsFeed({
  congress = Number(
    process.env.CURRENT_CONGRESS ?? process.env.DEFAULT_CONGRESS ?? 119,
  ),
  limit = TRENDING_BILL_LIMIT,
  client = getCongressClient(),
  generateExplainer = generateBillExplainer,
  enrichmentDeadlineMs = BILL_PIPELINE_DEADLINE_MS,
}: {
  congress?: number;
  limit?: number;
  client?: CongressClient;
  generateExplainer?: typeof generateBillExplainer;
  enrichmentDeadlineMs?: number;
}): Promise<TrendingBillsFeed> {
  const safeLimit = normalizeLimit(limit);
  const pipelineDeadlineAt =
    Date.now() +
    normalizeDeadline(enrichmentDeadlineMs, BILL_PIPELINE_DEADLINE_MS);
  const candidateLimit = Math.min(
    MAX_LIVE_CANDIDATE_POOL,
    Math.max(MIN_LIVE_CANDIDATE_POOL, safeLimit * 6),
  );
  const listed = await resolveBeforeDeadline(
    () => client.listBills({ congress, limit: candidateLimit }),
    pipelineDeadlineAt,
    undefined,
  );
  const ranked =
    listed?.source === "live" ? rankLiveBillCandidates(listed.data ?? []) : [];
  const selected = diversifyRankedBills(
    ranked.filter((candidate) => candidate.score >= LIVE_HIGH_IMPACT_MIN_SCORE),
    safeLimit,
  );
  const liveCards = await enrichLiveCandidates(
    selected,
    client,
    generateExplainer,
    Math.max(250, pipelineDeadlineAt - Date.now()),
  );

  if (liveCards.length > 0) {
    const seenHrefs = new Set(liveCards.map((card) => card.href));
    const fixtureFill = getDemoTrendingBills(safeLimit).filter(
      (card) => !seenHrefs.has(card.href),
    );

    const results = [...liveCards, ...fixtureFill].slice(0, safeLimit);
    const liveCount = results.filter((card) => card.mode === "live").length;
    const fixtureCount = results.length - liveCount;
    return {
      mode: "live",
      congress,
      composition: {
        kind: fixtureCount > 0 ? "mixed" : "live",
        liveCount,
        fixtureCount,
      },
      results,
    };
  }

  const results = getDemoTrendingBills(safeLimit);
  return {
    mode: "fixture",
    congress,
    composition: {
      kind: "fixture",
      liveCount: 0,
      fixtureCount: results.length,
    },
    results,
  };
}

export function rankLiveBillCandidates(
  bills: CongressSearchResult[],
): RankedLiveBill[] {
  const deduped = new Map<string, RankedLiveBill>();

  bills
    .filter(
      (bill) =>
        Number.isInteger(bill.congress) &&
        bill.congress > 0 &&
        Number.isInteger(bill.number) &&
        bill.number > 0 &&
        bill.title.trim().length > 0,
    )
    .map((bill) => {
      const text = `${bill.title} ${bill.latestAction?.text ?? ""}`;
      const matched = highImpactRules
        .filter((rule) => rule.pattern.test(text))
        .sort((a, b) => b.score - a.score)[0];
      let score = matched?.score ?? 0;

      if (
        /\b(public law|became law|signed by the president|enacted)\b/i.test(
          text,
        )
      )
        score += 4;
      if (/\b(passed|agreed to|presented to president)\b/i.test(text))
        score += 2;
      if (lowImpactPattern.test(text)) score -= 7;

      return {
        bill,
        score,
        impactLabel: matched?.impactLabel ?? "High impact: civic record",
        issueArea: matched?.issueArea ?? "Civic impact",
      };
    })
    .forEach((candidate) => {
      const key = billKey(candidate.bill);
      const previous = deduped.get(key);
      if (
        !previous ||
        candidate.score > previous.score ||
        (candidate.score === previous.score &&
          !previous.bill.latestAction &&
          candidate.bill.latestAction)
      ) {
        deduped.set(key, candidate);
      }
    });

  return [...deduped.values()].sort(
    (a, b) =>
      b.score - a.score ||
      String(a.bill.title).localeCompare(String(b.bill.title)),
  );
}

export function mapLiveBillsToTrendingCards(
  bills: CongressSearchResult[],
  limit = TRENDING_BILL_LIMIT,
): TrendingBillCard[] {
  return diversifyRankedBills(
    rankLiveBillCandidates(bills).filter(
      (candidate) => candidate.score >= LIVE_HIGH_IMPACT_MIN_SCORE,
    ),
    normalizeLimit(limit),
  ).map((candidate, index) => liveToCard(candidate, index));
}

function fixtureToCard(bill: TrendingBillFixture): TrendingBillCard {
  const url =
    bill.citations[0]?.url ??
    congressBillUrl({
      raw: "",
      congress: bill.congress,
      type: bill.type,
      number: bill.number,
    }) ??
    "https://www.congress.gov/";

  return {
    type: "bill",
    title: bill.shortTitle || bill.title,
    label: `${bill.type.toUpperCase()} ${bill.number}`,
    href: bill.detailRouteTarget,
    detailRouteTarget: bill.detailRouteTarget,
    url,
    snippet: bill.hook,
    quest: bill.impactLabel,
    mode: "fixture",
    impactLabel: bill.impactLabel,
    issueArea: bill.issueArea,
    hook: bill.hook,
    hookCitationIds:
      bill.hookCitationIds ??
      bill.keyPoints[0]?.citationIds ??
      bill.whyItMatters.citationIds,
    keyPoints: bill.keyPoints,
    currentStep: bill.currentStep,
    whyItMatters: bill.whyItMatters,
    whatChanges: bill.whatChanges,
    whoIsAffected: bill.whoIsAffected ?? {
      text: "The cited official sources do not separately list every person or organization that may be affected.",
      citationIds: bill.whyItMatters.citationIds,
    },
    enrichment: {
      method: "deterministic",
      officialDetail: true,
    },
    sourceCount: bill.citations.length,
    citations: bill.citations,
    bill: {
      congress: bill.congress,
      type: bill.type,
      number: bill.number,
      title: bill.title,
      latestAction: bill.currentStep.text,
    },
  };
}

function liveToCard(
  candidate: RankedLiveBill,
  index: number,
): TrendingBillCard {
  const { bill, impactLabel, issueArea } = candidate;
  const href = `/bills/${bill.congress}/${bill.type}/${bill.number}`;
  const url =
    bill.url ??
    congressBillUrl({
      raw: "",
      congress: bill.congress,
      type: bill.type,
      number: bill.number,
    }) ??
    "https://www.congress.gov/";
  const latestAction =
    bill.latestAction?.text ?? "Recent Congress.gov bill record.";
  const citationId = `congress-${bill.congress}-${bill.type}-${bill.number}`;
  const citation: SourceCitation = {
    id: citationId,
    sourceDocumentId: `${bill.congress}-${bill.type}-${bill.number}`,
    sourceType: "congress_bill",
    publisher: "Congress.gov",
    title: bill.title,
    url,
    sourceDate: bill.latestAction?.date,
    excerpt: latestAction,
    bill: {
      congress: bill.congress,
      type: bill.type,
      number: bill.number,
    },
  };

  return {
    type: "bill",
    title: bill.title,
    label: `${bill.type.toUpperCase()} ${bill.number}`,
    href,
    detailRouteTarget: href,
    url,
    snippet: latestAction,
    quest: index === 0 ? "High-impact live bill" : `Live bill ${index + 1}`,
    mode: "live",
    impactLabel,
    issueArea,
    hook: latestAction,
    hookCitationIds: [citationId],
    keyPoints: [
      {
        text: `Latest official action: ${latestAction}`,
        citationIds: [citationId],
      },
      {
        text: "Open the detail page to inspect summaries, actions, sponsors, and source gaps.",
        citationIds: [citationId],
      },
      {
        text: "Treat this as source context, not voting advice.",
        citationIds: [citationId],
      },
    ],
    currentStep: {
      label: inferCurrentStep(latestAction),
      date: bill.latestAction?.date,
      text: latestAction,
      citationIds: [citationId],
    },
    whyItMatters: {
      text: `This live Congress.gov record is currently relevant in ${issueArea}.`,
      citationIds: [citationId],
    },
    whatChanges: {
      text: "Open details to compare official summaries and action text before repeating claims.",
      citationIds: [citationId],
    },
    whoIsAffected: {
      text: "This recent bill listing does not identify who would be affected. Open the official detail before drawing a conclusion.",
      citationIds: [citationId],
    },
    enrichment: {
      method: "deterministic",
      officialDetail: false,
    },
    sourceCount: 1,
    citations: [citation],
    bill: {
      congress: bill.congress,
      type: bill.type,
      number: bill.number,
      title: bill.title,
      latestAction,
    },
  };
}

function detailToCard(
  candidate: RankedLiveBill,
  detail: CongressBillDetail,
  enrichment: BillEnrichmentResult,
  index: number,
): TrendingBillCard {
  const { bill, impactLabel, issueArea } = candidate;
  const href = `/bills/${bill.congress}/${bill.type}/${bill.number}`;
  const url =
    enrichment.citations[0]?.url ??
    bill.url ??
    congressBillUrl({
      raw: "",
      congress: bill.congress,
      type: bill.type,
      number: bill.number,
    }) ??
    "https://www.congress.gov/";
  const latestAction = detail.latestAction ?? bill.latestAction;
  const actionCitation = enrichment.citations.find(
    (citation) => citation.sourceType === "congress_action",
  );
  const currentStepText =
    actionCitation?.excerpt ?? enrichment.explainer.hook.text;
  const currentStepCitationIds = actionCitation
    ? [actionCitation.id]
    : enrichment.explainer.hook.citationIds;

  return {
    type: "bill",
    title: detail.shortTitle || detail.title,
    label: `${bill.type.toUpperCase()} ${bill.number}`,
    href,
    detailRouteTarget: href,
    url,
    snippet: enrichment.explainer.hook.text,
    quest: index === 0 ? "High-impact live bill" : `Live bill ${index + 1}`,
    mode: "live",
    impactLabel,
    issueArea,
    hook: enrichment.explainer.hook.text,
    hookCitationIds: enrichment.explainer.hook.citationIds,
    keyPoints: enrichment.explainer.keyPoints,
    currentStep: {
      label: actionCitation
        ? inferCurrentStep(currentStepText)
        : "Status unavailable",
      date: actionCitation?.sourceDate,
      text: currentStepText,
      citationIds: currentStepCitationIds,
    },
    whyItMatters: enrichment.explainer.whyItMatters,
    whatChanges: enrichment.explainer.whatChanges,
    whoIsAffected: enrichment.explainer.whoIsAffected,
    enrichment: {
      method: enrichment.method,
      provider: enrichment.provider,
      officialDetail: true,
    },
    sourceCount: enrichment.citations.length,
    citations: enrichment.citations,
    bill: {
      congress: bill.congress,
      type: bill.type,
      number: bill.number,
      title: detail.title,
      latestAction: latestAction?.text,
    },
  };
}

async function enrichLiveCandidates(
  candidates: RankedLiveBill[],
  client: CongressClient,
  generateExplainer: typeof generateBillExplainer,
  deadlineMs: number,
): Promise<TrendingBillCard[]> {
  const deadlineAt =
    Date.now() + normalizeDeadline(deadlineMs, BILL_PIPELINE_DEADLINE_MS);
  const details = await mapWithConcurrency(
    candidates,
    DETAIL_CONCURRENCY,
    async (candidate) => {
      try {
        const detail = await resolveBeforeDeadline(
          () =>
            client.getBill({
              raw: "",
              congress: candidate.bill.congress,
              type: candidate.bill.type,
              number: candidate.bill.number,
            }),
          deadlineAt,
          undefined,
        );
        return detail && isMatchingBillDetail(detail, candidate.bill)
          ? detail
          : undefined;
      } catch {
        return undefined;
      }
    },
  );

  const hydrated = candidates
    .map((candidate, index) => ({ candidate, detail: details[index] }))
    .filter(
      (
        entry,
      ): entry is { candidate: RankedLiveBill; detail: CongressBillDetail } =>
        Boolean(entry.detail),
    );

  return Promise.all(
    hydrated.map(async ({ candidate, detail }, hydratedIndex) => {
      const citations = buildBillCitationPacket(detail);
      const deterministic: BillEnrichmentResult = {
        explainer: createDeterministicBillExplainer(detail, citations),
        citations,
        method: "deterministic",
      };
      const enrichment =
        hydratedIndex < MAX_LLM_ENRICHMENTS
          ? await resolveBeforeDeadline(
              () =>
                generateExplainer(detail, {
                  deadlineMs: Math.max(250, deadlineAt - Date.now()),
                }),
              deadlineAt,
              deterministic,
            )
          : deterministic;
      return detailToCard(candidate, detail, enrichment, hydratedIndex);
    }),
  );
}

export function diversifyRankedBills(
  candidates: RankedLiveBill[],
  limit: number,
): RankedLiveBill[] {
  const safeLimit = normalizeLimit(limit);
  const groups = new Map<string, RankedLiveBill[]>();
  for (const candidate of candidates) {
    const group = groups.get(candidate.issueArea) ?? [];
    group.push(candidate);
    groups.set(candidate.issueArea, group);
  }

  const selected: RankedLiveBill[] = [];
  let round = 0;
  while (selected.length < safeLimit) {
    let added = false;
    for (const group of groups.values()) {
      const candidate = group[round];
      if (candidate) {
        selected.push(candidate);
        added = true;
        if (selected.length >= safeLimit) break;
      }
    }
    if (!added) break;
    round += 1;
  }

  return selected;
}

function normalizeLimit(limit: number): number {
  if (!Number.isFinite(limit)) return TRENDING_BILL_LIMIT;
  return Math.min(
    MAX_TRENDING_BILL_LIMIT,
    Math.max(MIN_TRENDING_BILL_LIMIT, Math.trunc(limit)),
  );
}

function normalizeDeadline(value: number, fallback: number): number {
  if (!Number.isFinite(value)) return fallback;
  return Math.max(250, Math.min(fallback, Math.trunc(value)));
}

function billKey(
  bill: Pick<CongressSearchResult, "congress" | "type" | "number">,
): string {
  return `${bill.congress}:${bill.type}:${bill.number}`;
}

async function mapWithConcurrency<T, R>(
  items: T[],
  concurrency: number,
  worker: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
  const results = new Array<R>(items.length);
  let nextIndex = 0;
  const workers = Array.from(
    { length: Math.min(concurrency, items.length) },
    async () => {
      while (nextIndex < items.length) {
        const index = nextIndex;
        nextIndex += 1;
        results[index] = await worker(items[index] as T, index);
      }
    },
  );

  await Promise.all(workers);
  return results;
}

async function resolveBeforeDeadline<T>(
  operation: () => Promise<T>,
  deadlineAt: number,
  fallback: T,
): Promise<T> {
  const remainingMs = deadlineAt - Date.now();
  if (remainingMs <= 0) return fallback;

  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      operation(),
      new Promise<T>((resolve) => {
        timer = setTimeout(() => resolve(fallback), remainingMs);
      }),
    ]);
  } catch {
    return fallback;
  } finally {
    if (timer) clearTimeout(timer);
  }
}

function inferCurrentStep(text: string) {
  if (/\b(public law|became law|signed by the president|enacted)\b/i.test(text))
    return "Became law";
  if (/\b(presented to president)\b/i.test(text)) return "President";
  if (/\b(senate)\b/i.test(text)) return "Senate";
  if (/\b(house|passed)\b/i.test(text)) return "House";
  if (/\b(committee|referred|reported)\b/i.test(text)) return "Committee";
  return "Introduced";
}
