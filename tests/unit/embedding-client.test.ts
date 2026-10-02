import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createEmbedding, deterministicEmbedding } from "@/lib/ai/embedding-client";

const originalEnv = { ...process.env };

describe("embedding provider integrity", () => {
  beforeEach(() => {
    process.env = { ...originalEnv, OPENAI_API_KEY: "test-key" };
    delete process.env.EMBEDDINGS_API_KEY;
    delete process.env.EMBEDDINGS_BASE_URL;
    delete process.env.OPENAI_BASE_URL;
  });
  afterEach(() => { process.env = { ...originalEnv }; vi.unstubAllGlobals(); });

  it.each(["https://api.openai.com", "https://api.openai.com/v1/"])("normalizes %s without duplicating the API version", async (base) => {
    process.env.OPENAI_BASE_URL = base;
    const fetcher = vi.fn().mockResolvedValue(Response.json({ data: [{ embedding: [0.1, 0.2] }] }));
    vi.stubGlobal("fetch", fetcher);
    const result = await createEmbedding("Congress");
    expect(result).toEqual({ ok: true, embedding: [0.1, 0.2], mode: "live" });
    expect(fetcher.mock.calls[0][0]).toBe("https://api.openai.com/v1/embeddings");
  });

  it("labels provider errors as deterministic demo fallback", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("unavailable", { status: 503 })));
    expect(await createEmbedding("Congress")).toEqual({ ok: true, mode: "demo", embedding: deterministicEmbedding("Congress") });
  });

  it("rejects malformed provider vectors", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(Response.json({ data: [{ embedding: ["invalid"] }] })));
    const result = await createEmbedding("Congress");
    expect(result.mode).toBe("demo");
  });
});
