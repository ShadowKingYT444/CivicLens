import { createHash } from "crypto";
import { redactSensitiveText } from "../privacy/redaction";

const FALLBACK_DIMENSIONS = 128;
const DEFAULT_TIMEOUT_MS = 8000;

export type EmbeddingResult =
  | { ok: true; embedding: number[]; mode: "live" | "demo" }
  | { ok: false; reason: string; mode: "demo" };

export function isEmbeddingsConfigured(): boolean {
  const provider = process.env.EMBEDDING_PROVIDER?.trim().toLowerCase();
  return (
    !["demo", "disabled", "none", "off"].includes(provider || "") &&
    Boolean(process.env.OPENAI_API_KEY || process.env.EMBEDDINGS_API_KEY)
  );
}

export async function embedText(text: string): Promise<number[]> {
  const result = await createEmbedding(text);
  if (!result.ok) throw new Error("embedding unavailable");
  return result.embedding;
}

export async function createEmbedding(text: string): Promise<EmbeddingResult> {
  try {
    const safeText = redactSensitiveText(text);
    const liveEmbedding = isEmbeddingsConfigured()
      ? await tryOpenAIEmbedding(safeText)
      : null;
    return {
      ok: true,
      embedding: liveEmbedding || deterministicEmbedding(safeText),
      mode: liveEmbedding ? "live" : "demo",
    };
  } catch {
    return {
      ok: false,
      reason: "embedding unavailable",
      mode: "demo",
    };
  }
}

export function deterministicEmbedding(
  text: string,
  dimensions = FALLBACK_DIMENSIONS,
): number[] {
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

  const model =
    process.env.EMBEDDINGS_MODEL ||
    process.env.OPENAI_EMBEDDING_MODEL ||
    "text-embedding-3-small";
  const configuredDimensions = process.env.EMBEDDINGS_DIMENSIONS;
  const dimensions =
    configuredDimensions === undefined
      ? model === "text-embedding-3-large"
        ? 3072
        : 1536
      : Number(configuredDimensions);
  if (
    !Number.isSafeInteger(dimensions) ||
    dimensions <= 0 ||
    dimensions > 65536
  )
    return null;

  const configuredTimeout = Number(
    process.env.EMBEDDINGS_TIMEOUT_MS || DEFAULT_TIMEOUT_MS,
  );
  const timeoutMs =
    Number.isFinite(configuredTimeout) && configuredTimeout > 0
      ? Math.min(configuredTimeout, 30000)
      : DEFAULT_TIMEOUT_MS;
  const controller = new AbortController();
  let timer: ReturnType<typeof setTimeout> | undefined;

  try {
    const base = (
      process.env.OPENAI_BASE_URL || "https://api.openai.com"
    ).replace(/\/+$/, "");
    const endpoint = `${base.endsWith("/v1") ? base : `${base}/v1`}/embeddings`;
    const request = (async () => {
      const response = await fetch(endpoint, {
        method: "POST",
        signal: controller.signal,
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model,
          input: text.slice(0, 8000),
          ...(configuredDimensions !== undefined &&
          model.startsWith("text-embedding-3-")
            ? { dimensions }
            : {}),
        }),
      });

      if (!response.ok) return null;

      const payload = (await response.json()) as {
        data?: Array<{ embedding?: unknown }>;
      } | null;
      const embedding = payload?.data?.[0]?.embedding;
      return Array.isArray(embedding) &&
        embedding.length === dimensions &&
        embedding.every(
          (value) => typeof value === "number" && Number.isFinite(value),
        ) &&
        embedding.some((value) => value !== 0)
        ? (embedding as number[])
        : null;
    })();
    const deadline = new Promise<null>((resolve) => {
      timer = setTimeout(() => {
        controller.abort();
        resolve(null);
      }, timeoutMs);
    });
    return await Promise.race([request, deadline]);
  } catch {
    return null;
  } finally {
    if (timer !== undefined) clearTimeout(timer);
  }
}
