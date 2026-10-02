import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  createEmbedding,
  embedText,
  isEmbeddingsConfigured,
} from "@/lib/ai/embedding-client";

const fetchMock = vi.fn();

function response(embedding: unknown) {
  return { ok: true, json: async () => ({ data: [{ embedding }] }) };
}

describe("embedding provider safety", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", fetchMock);
    fetchMock.mockReset();
    for (const name of [
      "EMBEDDING_PROVIDER",
      "OPENAI_API_KEY",
      "EMBEDDINGS_API_KEY",
      "OPENAI_BASE_URL",
      "EMBEDDINGS_MODEL",
      "OPENAI_EMBEDDING_MODEL",
      "EMBEDDINGS_DIMENSIONS",
      "EMBEDDINGS_TIMEOUT_MS",
    ]) {
      vi.stubEnv(name, undefined);
    }
    vi.stubEnv("OPENAI_API_KEY", "synthetic-embedding-key");
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });

  it.each(["demo", "disabled", "none", "off", " DEMO "])(
    "honors %s even with a key",
    async (provider) => {
      vi.stubEnv("EMBEDDING_PROVIDER", provider);
      expect(isEmbeddingsConfigured()).toBe(false);
      expect(await createEmbedding("public test text")).toMatchObject({
        ok: true,
        mode: "demo",
      });
      expect(fetchMock).not.toHaveBeenCalled();
    },
  );

  it("stays in demo without credentials", async () => {
    vi.stubEnv("OPENAI_API_KEY", undefined);
    expect(isEmbeddingsConfigured()).toBe(false);
    const result = await createEmbedding("public test text");
    expect(result).toMatchObject({ ok: true, mode: "demo" });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it.each([
    "https://provider.invalid",
    "https://provider.invalid/",
    "https://provider.invalid/v1",
    "https://provider.invalid/v1/",
  ])("normalizes %s and honors the documented model alias", async (base) => {
    vi.stubEnv("OPENAI_BASE_URL", base);
    vi.stubEnv("OPENAI_EMBEDDING_MODEL", "text-embedding-3-small");
    fetchMock.mockResolvedValue(response(new Array(1536).fill(0.25)));
    const result = await createEmbedding("public test text");
    expect(result).toMatchObject({ ok: true, mode: "live" });
    expect(fetchMock.mock.calls[0][0]).toBe(
      "https://provider.invalid/v1/embeddings",
    );
    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual({
      model: "text-embedding-3-small",
      input: "public test text",
    });
  });

  it("honors explicit dimensions and the existing model setting", async () => {
    vi.stubEnv("EMBEDDINGS_MODEL", "text-embedding-3-small");
    vi.stubEnv("OPENAI_EMBEDDING_MODEL", "ignored-alias");
    vi.stubEnv("EMBEDDINGS_DIMENSIONS", "3");
    fetchMock.mockResolvedValue(response([0.1, 0.2, 0.3]));
    expect(await createEmbedding("public text")).toEqual({
      ok: true,
      mode: "live",
      embedding: [0.1, 0.2, 0.3],
    });
    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toMatchObject({
      model: "text-embedding-3-small",
      dimensions: 3,
    });
  });

  it("validates the large model's native dimension", async () => {
    vi.stubEnv("OPENAI_EMBEDDING_MODEL", "text-embedding-3-large");
    fetchMock.mockResolvedValue(response(new Array(3072).fill(0.1)));
    expect(await createEmbedding("public text")).toMatchObject({
      ok: true,
      mode: "live",
    });
  });

  it.each([
    [],
    [0.1],
    ["0.1", 0.2, 0.3],
    [NaN, 0.2, 0.3],
    [Infinity, 0.2, 0.3],
    [0, 0, 0],
    null,
  ])(
    "rejects invalid provider vectors (%j) and labels fallback as demo",
    async (embedding) => {
      vi.stubEnv("EMBEDDINGS_DIMENSIONS", "3");
      fetchMock.mockResolvedValue(response(embedding));
      const result = await createEmbedding("public text");
      expect(result).toMatchObject({ ok: true, mode: "demo" });
      if (result.ok) expect(result.embedding).toHaveLength(128);
    },
  );

  it.each(["0", "-2", "NaN", "", "2.5", "65537"])(
    "rejects invalid dimension configuration %s before requesting",
    async (dimensions) => {
      vi.stubEnv("EMBEDDINGS_DIMENSIONS", dimensions);
      expect(await createEmbedding("public text")).toMatchObject({
        ok: true,
        mode: "demo",
      });
      expect(fetchMock).not.toHaveBeenCalled();
    },
  );

  it.each(["http", "malformed-json", "null", "exception"])(
    "falls back safely on %s failures",
    async (failure) => {
      if (failure === "http") fetchMock.mockResolvedValue({ ok: false });
      if (failure === "malformed-json")
        fetchMock.mockResolvedValue({
          ok: true,
          json: async () => {
            throw new Error("synthetic-secret private@example.com");
          },
        });
      if (failure === "null")
        fetchMock.mockResolvedValue({ ok: true, json: async () => null });
      if (failure === "exception")
        fetchMock.mockRejectedValue(
          new Error("synthetic-secret private@example.com"),
        );
      const result = await createEmbedding("public text");
      expect(result).toMatchObject({ ok: true, mode: "demo" });
      expect(JSON.stringify(result)).not.toContain("synthetic-secret");
      expect(await embedText("public text")).toHaveLength(128);
    },
  );

  it.each(["fetch", "body"])(
    "bounds stalled %s work and aborts the request",
    async (stage) => {
      vi.useFakeTimers();
      vi.stubEnv("EMBEDDINGS_TIMEOUT_MS", "25");
      if (stage === "fetch")
        fetchMock.mockImplementation(() => new Promise(() => {}));
      else
        fetchMock.mockResolvedValue({
          ok: true,
          json: () => new Promise(() => {}),
        });
      const pending = createEmbedding("public text");
      await vi.advanceTimersByTimeAsync(25);
      expect(await pending).toMatchObject({ ok: true, mode: "demo" });
      expect(fetchMock.mock.calls[0][1].signal.aborted).toBe(true);
      expect(vi.getTimerCount()).toBe(0);
    },
  );

  it("removes synthetic sensitive text before outbound embeddings", async () => {
    vi.stubEnv("EMBEDDINGS_DIMENSIONS", "3");
    fetchMock.mockResolvedValue(response([0.1, 0.2, 0.3]));
    await createEmbedding(
      "123A Main Street private@example.com 415-555-0100 123-45-6789 37.779123, -122.419456 civic policy",
    );
    const input = JSON.parse(fetchMock.mock.calls[0][1].body).input;
    for (const secret of [
      "123A Main Street",
      "private@example.com",
      "415-555-0100",
      "123-45-6789",
      "37.779123",
      "-122.419456",
    ]) {
      expect(input).not.toContain(secret);
    }
    expect(input).toContain("civic policy");
  });

  it("returns a generic reason if local processing throws", async () => {
    const result = await createEmbedding({
      toString() {
        throw new Error("synthetic-secret");
      },
    } as unknown as string);
    expect(result).toEqual({
      ok: false,
      reason: "embedding unavailable",
      mode: "demo",
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
