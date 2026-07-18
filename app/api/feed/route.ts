import { NextResponse } from "next/server";
import { getPrisma } from "../../../lib/db/prisma";

type FeedCard = {
  slug: string;
  title: string;
  hook: string;
  body: string;
  category: string;
  difficulty: 1 | 2 | 3;
  sourceIds: string[];
  quizJson: unknown;
  orderIndex: number;
  isPublished: boolean;
};

const BUILT_IN_FEED: FeedCard[] = [
  {
    slug: "check-the-source",
    title: "Check the official source",
    hook: "A strong civic claim should point back to an official document.",
    body: "Compare the claim with Congress.gov, GovInfo, Census, House, or Senate sources before deciding what the evidence supports.",
    category: "source-literacy",
    difficulty: 1,
    sourceIds: ["congress-help"],
    quizJson: {
      question: "What is the best first step when checking a bill claim?",
      answer: "Find an official source for the bill or action.",
    },
    orderIndex: 1,
    isPublished: true,
  },
  {
    slug: "separate-claim-from-context",
    title: "Separate claim from context",
    hook: "A source can be real while a claim about it is incomplete.",
    body: "Look for what the source says, what it does not say, and whether the claim adds conclusions that are not in the official record.",
    category: "analysis",
    difficulty: 2,
    sourceIds: ["hr82-congress"],
    quizJson: {
      question: "What should you do when a source does not answer part of a claim?",
      answer: "Mark the gap instead of guessing.",
    },
    orderIndex: 2,
    isPublished: true,
  },
];

export async function GET() {
  const dbCards = await getFeedFromDb();
  if (dbCards.length > 0) {
    return NextResponse.json({ data: dbCards, mode: "live" });
  }

  const fixtureCards = await loadFixtureCards();
  return NextResponse.json({ data: fixtureCards, mode: "demo" });
}

async function getFeedFromDb(): Promise<FeedCard[]> {
  const prisma = await getPrisma();
  if (!prisma?.$queryRawUnsafe) {
    return [];
  }

  try {
    return await prisma.$queryRawUnsafe<FeedCard[]>(
      `
      SELECT
        slug,
        title,
        hook,
        body,
        category,
        difficulty,
        source_ids AS "sourceIds",
        quiz_json AS "quizJson",
        order_index AS "orderIndex",
        is_published AS "isPublished"
      FROM concept_cards
      WHERE is_published = true
      ORDER BY order_index ASC, title ASC
      `,
    );
  } catch {
    return [];
  }
}

async function loadFixtureCards(): Promise<FeedCard[]> {
  try {
    const fs = await import("fs/promises");
    const path = await import("path");
    const raw = await fs.readFile(path.join(process.cwd(), "data", "concept-cards.json"), "utf8");
    const parsed = JSON.parse(raw) as FeedCard[];
    return parsed.filter((card) => card.isPublished !== false);
  } catch {
    return BUILT_IN_FEED;
  }
}
