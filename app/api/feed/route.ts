import { NextResponse } from "next/server";
import { getPrisma } from "../../../lib/db/prisma";
import sourcePacks from "../../../data/source-packs.json";
import authoredLessons from "../../../data/concept-cards.json";

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
    return NextResponse.json({ data: attachSources(dbCards), mode: "live" });
  }

  const fixtureCards = await loadFixtureCards();
  return NextResponse.json({ data: attachSources(fixtureCards), mode: "demo" });
}

function attachSources(cards: FeedCard[]) {
  const sources = new Map(sourcePacks.map((pack) => [pack.id, pack.citation]));
  const authored = new Map(authoredLessons.map((lesson) => [lesson.slug, lesson]));
  return cards.map((card) => {
    const stored = card.quizJson && typeof card.quizJson === "object" ? card.quizJson as Record<string, unknown> : {};
    const enriched = authored.get(card.slug);
    return {
    ...card,
    visual: stored.visual ?? enriched?.visual,
    flashcards: stored.flashcards ?? enriched?.flashcards,
    quizQuestions: stored.quizQuestions ?? enriched?.quizQuestions,
    citations: card.sourceIds.flatMap((id) => {
      const citation = sources.get(id);
      return citation ? [citation] : [];
    }),
    };
  });
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
        "sourceIds",
        "quizJson",
        "orderIndex",
        "isPublished"
      FROM "ConceptCard"
      WHERE "isPublished" = true
      ORDER BY "orderIndex" ASC, title ASC
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
