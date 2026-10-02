import { readFile } from "node:fs/promises";
import path from "node:path";
import { PrismaClient, type Prisma } from "@prisma/client";

type ConceptCardSeed = {
  slug: string;
  title: string;
  hook: string;
  body: string;
  category: string;
  difficulty: number;
  sourceIds: string[];
  quizJson: {
    question: string;
    options: string[];
    correctIndex: number;
    explanation: string;
  };
  orderIndex: number;
  isPublished: boolean;
  visual?: Record<string, string>;
  flashcards?: unknown[];
  quizQuestions?: unknown[];
};

const conceptPath = path.join(process.cwd(), "data", "concept-cards.json");

function validateCard(card: ConceptCardSeed, index: number) {
  const label = `concept card ${index + 1}`;
  if (!card.slug || !card.title || !card.body || !card.category) {
    throw new Error(`${label} is missing required display fields`);
  }
  if (![1, 2, 3].includes(card.difficulty)) {
    throw new Error(`${label} has invalid difficulty`);
  }
  if (!Array.isArray(card.sourceIds)) {
    throw new Error(`${label} sourceIds must be an array`);
  }
  if (!card.quizJson || card.quizJson.options.length !== 4) {
    throw new Error(`${label} quiz must have exactly 4 options`);
  }
  if (card.quizJson.correctIndex < 0 || card.quizJson.correctIndex > 3) {
    throw new Error(`${label} quiz correctIndex must be 0-3`);
  }
}

async function main() {
  const raw = await readFile(conceptPath, "utf8");
  const cards = JSON.parse(raw) as ConceptCardSeed[];

  cards.forEach(validateCard);

  if (!process.env.DATABASE_URL) {
    console.info(`Validated ${cards.length} concept cards. DATABASE_URL is not set, so no database seed was run.`);
    return;
  }

  const prisma = new PrismaClient();
  try {
    for (const card of cards) {
      // Keep the authored lesson inside the existing JSON column. Extra display
      // fields are not Prisma model columns and must never reach create directly.
      const row = {
        slug: card.slug,
        title: card.title,
        hook: card.hook,
        body: card.body,
        category: card.category,
        difficulty: card.difficulty,
        sourceIds: card.sourceIds,
        quizJson: {
          ...card.quizJson,
          visual: card.visual,
          flashcards: card.flashcards,
          quizQuestions: card.quizQuestions,
        } as Prisma.InputJsonValue,
        orderIndex: card.orderIndex,
        isPublished: card.isPublished,
      };
      await prisma.conceptCard.upsert({
        where: { slug: card.slug },
        create: row,
        update: row,
      });
    }
    console.info(`Seeded ${cards.length} concept cards.`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
