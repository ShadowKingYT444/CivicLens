import { createHash } from "crypto";

const FALLBACK_DIMENSIONS = 128;

export type EmbeddingResult =
  | { ok: true; embedding: number[]; mode: "live" | "demo" }
  | { ok: false; reason: string; mode: "demo" };

export function isEmbeddingsConfigured(): boolean {
  return Boolean(process.env.OPENAI_API_KEY || process.env.EMBEDDINGS_API_KEY);
}

export async function embedText(text: string): Promise<number[]> {
  const result = await createEmbedding(text);
  return result.ok ? result.embedding : deterministicEmbedding(text);
}

export async function createEmbedding(text: string): Promise<EmbeddingResult> {
  if (isEmbeddingsConfigured()) {
    const embedding = await tryOpenAIEmbedding(text);
    if (embedding) return { ok: true, embedding, mode: "live" };
  }
  return { ok: true, embedding: deterministicEmbedding(text), mode: "demo" };
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
  if (!apiKey) return null;
  const baseUrl = (process.env.EMBEDDINGS_BASE_URL || process.env.OPENAI_BASE_URL || "https://api.openai.com/v1").replace(/\/+$/, "");
  const endpoint = `${baseUrl.endsWith("/v1") ? baseUrl : `${baseUrl}/v1`}/embeddings`;
  const rawTimeout = Number(process.env.EMBEDDINGS_TIMEOUT_MS ?? 8_000);
  const timeoutMs = Number.isFinite(rawTimeout) ? Math.min(30_000, Math.max(100, rawTimeout)) : 8_000;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(endpoint, {
      method: "POST",
      signal: controller.signal,
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: process.env.EMBEDDINGS_MODEL || process.env.OPENAI_EMBEDDING_MODEL || "text-embedding-3-small",
        input: text.slice(0, 8000),
      }),
    });
    if (!response.ok) return null;
    const payload = (await response.json()) as { data?: Array<{ embedding?: unknown }> };
    const vector = payload.data?.[0]?.embedding;
    return Array.isArray(vector) && vector.length > 0 && vector.every((value) => typeof value === "number" && Number.isFinite(value))
      ? vector : null;
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
  }
}
