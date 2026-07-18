import { PrismaClient } from "@prisma/client";

async function main() {
  if (!process.env.DATABASE_URL) {
    console.info("DATABASE_URL is not set. Demo reset skipped.");
    return;
  }

  const prisma = new PrismaClient();
  try {
    await prisma.$transaction([
      prisma.quizAttempt.deleteMany(),
      prisma.claimAnalysis.deleteMany(),
      prisma.votePosition.deleteMany(),
      prisma.vote.deleteMany(),
      prisma.billSummary.deleteMany(),
      prisma.billAction.deleteMany(),
      prisma.bill.deleteMany(),
      prisma.citation.deleteMany(),
      prisma.sourceChunk.deleteMany(),
      prisma.sourceDocument.deleteMany(),
      prisma.member.deleteMany(),
      prisma.districtCache.deleteMany(),
      prisma.ingestionRun.deleteMany(),
      prisma.conceptCard.deleteMany(),
    ]);
    console.info("Demo database tables were reset.");
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
