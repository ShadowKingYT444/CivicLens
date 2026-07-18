import conceptCards from "../data/concept-cards.json";
import sampleActions from "../data/fixtures/bills/sample-bill-actions.json";
import sampleBill from "../data/fixtures/bills/sample-bill-detail.json";
import sampleSummary from "../data/fixtures/bills/sample-bill-summary.json";
import sampleCensus from "../data/fixtures/census/sample-district-response.json";
import sampleMembers from "../data/fixtures/members/sample-members.json";
import sampleVote from "../data/fixtures/votes/sample-house-vote.json";
import type {
  BillType,
  BillDetailView,
  Citation,
  FeedCardData,
  Representative,
} from "./types";

type AnyRecord = Record<string, unknown>;

function asRecord(value: unknown): AnyRecord {
  return value && typeof value === "object" ? (value as AnyRecord) : {};
}

function normalizeConceptCard(card: unknown): FeedCardData {
  const record = asRecord(card);
  const quizRecord = asRecord(record.quiz ?? record.quizJson);
  const options = Array.isArray(quizRecord.options)
    ? quizRecord.options.map(String).slice(0, 4)
    : [];
  while (options.length < 4) {
    options.push("Not enough information");
  }

  return {
    slug: String(record.slug),
    title: String(record.title),
    hook: String(record.hook ?? ""),
    body: String(record.body ?? ""),
    category: String(record.category ?? "Civics"),
    difficulty: [1, 2, 3].includes(Number(record.difficulty))
      ? (Number(record.difficulty) as 1 | 2 | 3)
      : 1,
    sourceIds: Array.isArray(record.sourceIds)
      ? record.sourceIds.map(String)
      : [],
    quiz: {
      question: String(quizRecord.question ?? "What is the main idea?"),
      options: options as [string, string, string, string],
      correctIndex: Number(quizRecord.correctIndex ?? 0),
      explanation: String(quizRecord.explanation ?? ""),
    },
    orderIndex: Number(record.orderIndex ?? 0),
    isPublished: record.isPublished !== false,
  };
}

export function getDemoConceptCards(): FeedCardData[] {
  return (conceptCards as unknown[])
    .map(normalizeConceptCard)
    .filter((card) => card.isPublished !== false)
    .sort((a, b) => a.orderIndex - b.orderIndex);
}

export function getDemoMembers(): Representative[] {
  const members = Array.isArray((sampleMembers as AnyRecord).members)
    ? ((sampleMembers as AnyRecord).members as Representative[])
    : [];
  return members;
}

export function getDemoCensusResponse() {
  return sampleCensus;
}

export function getDemoBill(): BillDetailView {
  const billRecord = asRecord((sampleBill as AnyRecord).bill ?? sampleBill);
  const summaryRecord = asRecord(
    (sampleSummary as AnyRecord).summary ?? sampleSummary,
  );
  const actions = Array.isArray((sampleActions as AnyRecord).actions)
    ? ((sampleActions as AnyRecord).actions as BillDetailView["actions"])
    : [];
  const members = getDemoMembers();
  const voteRecord = asRecord((sampleVote as AnyRecord).vote ?? sampleVote);
  const congress = Number(billRecord.congress ?? 119);
  const type = String(billRecord.type ?? "hr").toLowerCase() as BillType;
  const number = String(billRecord.number ?? "3076");
  const title = String(billRecord.title ?? "Sample Civic Education Bill");
  const billUrl = String(
    billRecord.congressUrl ??
      `https://www.congress.gov/bill/${congress}th-congress/house-bill/${number}`,
  );
  const citations: Citation[] = [
    {
      id: "bill-detail-1",
      sourceDocumentId: "demo-bill-detail",
      sourceType: "bill",
      title,
      url: billUrl,
      sourceDate: String(billRecord.updateDate ?? "2025-05-15"),
      excerpt: String(
        billRecord.latestActionText ??
          "Congress.gov records the latest official action for this sample bill.",
      ),
      bill: { congress, type, number: Number(number) },
    },
    {
      id: "bill-summary-1",
      sourceDocumentId: "demo-bill-summary",
      sourceType: "bill",
      title: `${title} summary`,
      url: String(summaryRecord.sourceUrl ?? billUrl),
      sourceDate: String(summaryRecord.updateDate ?? "2025-05-15"),
      excerpt: String(
        summaryRecord.text ??
          "The official summary explains the purpose and major provisions of the sample bill.",
      ),
      bill: { congress, type, number: Number(number) },
    },
  ];

  return {
    congress,
    type,
    number,
    title,
    originChamber: String(billRecord.originChamber ?? "House"),
    policyArea: String(billRecord.policyArea ?? "Education"),
    latestActionText: String(
      billRecord.latestActionText ??
        "Referred to the House Committee on Education and the Workforce.",
    ),
    latestActionDate: String(billRecord.latestActionDate ?? "2025-05-15"),
    introducedDate: String(billRecord.introducedDate ?? "2025-05-14"),
    updateDate: String(billRecord.updateDate ?? "2025-05-15"),
    apiUrl: String(billRecord.apiUrl ?? ""),
    congressUrl: billUrl,
    url: `/bills/${congress}/${type}/${number}`,
    summary: String(
      summaryRecord.text ??
        "This demo bill fixture gives CivicLens a stable official-source style record for local analysis.",
    ),
    summaries: [
      {
        actionDesc: String(summaryRecord.actionDesc ?? "Introduced in House"),
        text: String(
          summaryRecord.text ??
            "This demo bill fixture gives CivicLens a stable official-source style record for local analysis.",
        ),
        updateDate: String(summaryRecord.updateDate ?? "2025-05-15"),
        sourceUrl: String(summaryRecord.sourceUrl ?? billUrl),
      },
    ],
    actions,
    sponsors: members.slice(0, 2).map((member, index) => ({
      bioguideId: member.bioguideId,
      fullName: member.fullName,
      party: member.party,
      state: member.state,
      district: member.district ?? null,
      role: index === 0 ? "SPONSOR" : "COSPONSOR",
      date: "2025-05-14",
    })),
    subjects: [
      { name: "Civics education", type: "Legislative Subject" },
      {
        name: "Government information and archives",
        type: "Legislative Subject",
      },
    ],
    rollCalls: [
      {
        congress,
        session: Number(voteRecord.session ?? 1),
        chamber: "HOUSE",
        rollCallNumber: Number(voteRecord.rollCallNumber ?? 88),
        question: String(
          voteRecord.question ?? "On Motion to Suspend the Rules",
        ),
        description: String(voteRecord.description ?? "Demo vote data"),
        result: String(voteRecord.result ?? "Passed"),
        date: String(voteRecord.date ?? "2025-06-01"),
        apiUrl: String(voteRecord.apiUrl ?? ""),
      },
    ],
    citations,
  };
}

export function getDemoStats() {
  return {
    billsIndexed: 1,
    sourceChunksIndexed: getDemoConceptCards().length + 5,
    conceptCards: getDemoConceptCards().length,
    lastDataRefresh: "Demo fixture data",
  };
}
