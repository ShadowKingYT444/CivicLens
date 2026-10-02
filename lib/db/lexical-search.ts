import { getPrisma } from "./prisma";

export type SearchableDocument = {
  id: string;
  sourceDocumentId?: string;
  title: string;
  body?: string;
  excerpt?: string;
  url?: string;
  sourceType?: string;
  metadata?: Record<string, unknown>;
};

export type RankedDocument<T extends SearchableDocument = SearchableDocument> = T & {
  score: number;
  matchType: "lexical" | "vector";
};

export function rankLexically<T extends SearchableDocument>(
  query: string,
  documents: T[],
  limit = 10,
): Array<RankedDocument<T>> {
  const normalizedQuery = normalize(query);
  const queryTerms = tokenize(normalizedQuery);

  return documents
    .map((document) => {
      const title = normalize(document.title);
      const body = normalize([document.excerpt, document.body].filter(Boolean).join(" "));
      let score = 0;

      if (title.includes(normalizedQuery)) {
        score += 12;
      }
      if (body.includes(normalizedQuery)) {
        score += 8;
      }

      for (const term of queryTerms) {
        if (title.includes(term)) {
          score += 4;
        }
        if (body.includes(term)) {
          score += 1;
        }
      }

      return { ...document, score, matchType: "lexical" as const };
    })
    .filter((document) => document.score > 0)
    .sort((left, right) => right.score - left.score || left.title.localeCompare(right.title))
    .slice(0, limit);
}

export async function searchDatabaseLexically(query: string, limit = 10): Promise<Array<RankedDocument>> {
  const prisma = await getPrisma();
  if (!prisma?.$queryRawUnsafe) {
    return [];
  }

  try {
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
        ts_rank_cd(to_tsvector('english', d."title" || ' ' || c."text"), plainto_tsquery('english', $1)) AS score,
        'lexical' AS "matchType"
      FROM "SourceChunk" c
      JOIN "SourceDocument" d ON d."id" = c."sourceDocumentId"
      WHERE to_tsvector('english', d."title" || ' ' || c."text") @@ plainto_tsquery('english', $1)
      ORDER BY score DESC, c."id"
      LIMIT $2
      `,
      query,
      Math.min(50, Math.max(1, Math.trunc(limit) || 10)),
    );
  } catch {
    return [];
  }
}

function normalize(input: string): string {
  return input.toLowerCase().replace(/\s+/g, " ").trim();
}

function tokenize(input: string): string[] {
  return Array.from(new Set(input.match(/[a-z0-9]+/g) || [])).filter((term) => term.length > 1);
}
