import { createEmbedding } from "../ai/embedding-client";
import { getPrisma } from "./prisma";
import type { RankedDocument } from "./lexical-search";

export async function searchDatabaseVectors(query: string, limit = 8): Promise<Array<RankedDocument>> {
  const prisma = await getPrisma();
  if (!prisma?.$queryRawUnsafe) {
    return [];
  }

  try {
    const result = await createEmbedding(query);
    // Stored vectors use vector(1536). Demo hashes are a different space and cannot be compared.
    if (!result.ok || result.mode !== "live" || result.embedding.length !== 1536 || !result.embedding.every(Number.isFinite)) return [];
    const vectorLiteral = `[${result.embedding.join(",")}]`;

    return await prisma.$queryRawUnsafe<Array<RankedDocument>>(
      `
      SELECT
        c."id"::text AS id,
        d."id" AS "sourceDocumentId",
        d."title",
        c."text" AS body,
        LEFT(c."text", 1200) AS excerpt,
        d."url",
        d."sourceType",
        c."metadata",
        1 - (c."embedding" <=> $1::vector) AS score,
        'vector' AS "matchType"
      FROM "SourceChunk" c
      JOIN "SourceDocument" d ON d."id" = c."sourceDocumentId"
      WHERE c."embedding" IS NOT NULL
      ORDER BY c."embedding" <=> $1::vector
      LIMIT $2
      `,
      vectorLiteral,
      Math.min(50, Math.max(1, Math.trunc(limit) || 8)),
    );
  } catch {
    return [];
  }
}
