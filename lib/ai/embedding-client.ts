import { createHash } from "crypto";

const FALLBACK_DIMENSIONS = 128;

export type EmbeddingResult =
  | { ok: true; embedding: number[]; mode: "live" | "demo" }
  | { ok: false; reason: string; mode: "demo" };

export function isEmbeddingsConfigured(): boolean {
  return Boolean(process.env.OPENAI_API_KEY || process.env.EMBEDDINGS_API_KEY);
}

export async function embedText(text: string): Promise<number[]> {
  if (process.env.OPENAI_API_KEY || process.env.EMBEDDINGS_API_KEY) {
    const liveEmbedding = await tryOpenAIEmbedding(text);
    if (liveEmbedding) {
      return liveEmbedding;
    }
  }

  return deterministicEmbedding(text);
}

export async function createEmbedding(text: string): Promise<EmbeddingResult> {
  try {
    return {
      ok: true,
      embedding: await embedText(text),
      mode: isEmbeddingsConfigured() ? "live" : "demo",
    };
  } catch (error) {
    return {
      ok: false,
      reason: error instanceof Error ? error.message : "embedding unavailable",
      mode: "demo",
    };
  }
}

export function deterministicEmbedding(text: string, dimensions = FALLBACK_DIMENSIONS): number[] {
  const normalized = text.toLowerCase().replace(/\s+/g, " ").trim();
  const vector = new Array<number>(dimensions).fill(0);
  const tokens = normalized.match(/[a-z0-9]+/g) || [];

  for (const token of tokens) {
    const digest = createHash("sha256").update(token).digest();
    for (let index = 0; index < digest.length; index += 2) {
      const slot = digest[index] % dimensions;
      const sign = digest[index + 1] % 2 === 0 ? 1 : -1;
      vector[slot] += sign;
    }
  }

  const magnitude = Math.hypot(...vector) || 1;
  return vector.map((value) => Number((value / magnitude).toFixed(6)));
}

async function tryOpenAIEmbedding(text: string): Promise<number[] | null> {
  const apiKey = process.env.EMBEDDINGS_API_KEY || process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return null;
  }

  try {
    const response = await fetch(`${process.env.OPENAI_BASE_URL || "https://api.openai.com"}/v1/embeddings`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: process.env.EMBEDDINGS_MODEL || "text-embedding-3-small",
        input: text.slice(0, 8000),
      }),
    });

    if (!response.ok) {
      return null;
    }

    const payload = (await response.json()) as { data?: Array<{ embedding?: number[] }> };
    return payload.data?.[0]?.embedding || null;
  } catch {
    return null;
  }
}
