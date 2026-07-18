import { embedText } from "../ai/embedding-client";
import { getPrisma } from "./prisma";
import type { RankedDocument } from "./lexical-search";

export async function searchDatabaseVectors(query: string, limit = 8): Promise<Array<RankedDocument>> {
  const prisma = await getPrisma();
  if (!prisma?.$queryRawUnsafe) {
    return [];
  }

  try {
    const embedding = await embedText(query);
    const vectorLiteral = `[${embedding.join(",")}]`;

    return await prisma.$queryRawUnsafe<Array<RankedDocument>>(
      `
      SELECT
        id::text,
        title,
        body,
        excerpt,
        url,
        source_type AS "sourceType",
        1 - (embedding <=> $1::vector) AS score,
        'vector' AS "matchType"
      FROM source_chunks
      WHERE embedding IS NOT NULL
      ORDER BY embedding <=> $1::vector
      LIMIT $2
      `,
      vectorLiteral,
      limit,
    );
  } catch {
    return [];
  }
}
