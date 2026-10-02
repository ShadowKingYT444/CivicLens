import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import conceptCards from "@/data/concept-cards.json";

const mocks = vi.hoisted(() => ({ getPrisma: vi.fn(), query: vi.fn(), embedding: vi.fn(), analyze: vi.fn() }));
vi.mock("@/lib/db/prisma", () => ({ getPrisma: mocks.getPrisma }));
vi.mock("@/lib/ai/embedding-client", () => ({ createEmbedding: mocks.embedding }));
vi.mock("@/lib/ai/analyze-claim", () => ({ analyzeClaim: mocks.analyze }));
import { searchDatabaseLexically } from "@/lib/db/lexical-search";
import { searchDatabaseVectors } from "@/lib/db/vector-search";
import { POST as analyzePost } from "@/app/api/analyze/route";
import { POST as quizPost } from "@/app/api/quiz/attempt/route";

function request(body: unknown) {
  return new NextRequest("http://localhost/api", { method: "POST", body: JSON.stringify(body), headers: { "Content-Type": "application/json" } });
}
beforeEach(() => {
  mocks.getPrisma.mockResolvedValue({ $queryRawUnsafe: mocks.query });
  mocks.query.mockResolvedValue([{ id: "confirmed-id" }]);
  vi.stubEnv("STORE_ANALYSES", "true");
  vi.stubEnv("STORE_RAW_INPUTS", "false");
});
afterEach(() => vi.unstubAllEnvs());

describe("database retrieval matches the shipped migration", () => {
  it("joins real source tables and constructs text search without a nonexistent search_vector column", async () => {
    await searchDatabaseLexically("'; DROP TABLE example; --", 999);
    const [sql, query, limit] = mocks.query.mock.calls[0];
    expect(sql).toContain('FROM "SourceChunk"');
    expect(sql).toContain('JOIN "SourceDocument"');
    expect(sql).toContain('c."text" AS body');
    expect(sql).toContain('to_tsvector');
    expect(sql).not.toContain('search_vector');
    expect(sql).not.toContain("DROP TABLE");
    expect(query).toContain("DROP TABLE");
    expect(limit).toBe(50);
  });

  it("does not compare deterministic demo or wrong-dimensional embeddings to vector1536 storage", async () => {
    mocks.embedding.mockResolvedValue({ ok: true, mode: "demo", embedding: Array(1536).fill(0.1) });
    expect(await searchDatabaseVectors("Congress")).toEqual([]);
    expect(mocks.query).not.toHaveBeenCalled();
    mocks.embedding.mockResolvedValue({ ok: true, mode: "live", embedding: [0.1, 0.2] });
    expect(await searchDatabaseVectors("Congress")).toEqual([]);
    expect(mocks.query).not.toHaveBeenCalled();
  });

  it("queries joined chunk embeddings with a bound live vector", async () => {
    mocks.embedding.mockResolvedValue({ ok: true, mode: "live", embedding: Array(1536).fill(0.1) });
    await searchDatabaseVectors("Congress");
    const [sql, vector] = mocks.query.mock.calls[0];
    expect(sql).toContain('c."embedding" <=> $1::vector');
    expect(sql).toContain('JOIN "SourceDocument"');
    expect(JSON.parse(vector)).toHaveLength(1536);
  });
});

describe("database storage confirms real rows and uses actual columns", () => {
  it("stores a privacy projection in ClaimAnalysis with required metadata, not a nonexistent analyses table", async () => {
    const privateClaim = "My address is 742 Evergreen Terrace and Congress passed this bill.";
    mocks.analyze.mockResolvedValue({ result: { normalizedClaim: privateClaim, evidenceStatus: "grounded", status: "answered", truthVerdict: "true", oneSentenceAnswer: privateClaim }, citations: [{ id: "official", sourceDocumentId: "document", sourceType: "congress", excerpt: privateClaim }], relatedBills: [], warnings: [], mode: "demo" });
    const body = await (await analyzePost(request({ claim: privateClaim }))).json();
    expect(body.storage).toEqual({ stored: true });
    const [sql, id, hash, normalizedHash, evidenceStatus, result, redacted] = mocks.query.mock.calls[0];
    expect(sql).toContain('INSERT INTO "ClaimAnalysis"');
    expect(sql).toContain('"inputHash"');
    expect(id.length).toBeGreaterThan(10);
    expect(hash).toHaveLength(64);
    expect(normalizedHash).toHaveLength(64);
    expect(evidenceStatus).toBe("grounded");
    expect(result).not.toContain(privateClaim);
    expect(redacted).toBeNull();
  });

  it("does not claim successful persistence when the insert returns no row", async () => {
    mocks.query.mockResolvedValue([]);
    mocks.analyze.mockResolvedValue({ result: { evidenceStatus: "insufficient" }, citations: [], relatedBills: [], warnings: [] });
    const body = await (await analyzePost(request({ claim: "Congress passed a test bill." }))).json();
    expect(body.storage.stored).toBe(false);
  });

  it("uses the authored answer key and valid indexes even if the client submits a forged answer key", async () => {
    const lesson = conceptCards[0];
    const question = lesson.quizQuestions[0];
    const wrongIndex = (question.correctIndex + 1) % question.options.length;
    const wrongAnswer = question.options[wrongIndex];
    const body = await (await quizPost(request({ quizId: lesson.slug, questionId: question.id, selectedAnswer: wrongAnswer, correctAnswer: wrongAnswer }))).json();
    expect(body).toMatchObject({ correct: false, recorded: true, gradingSource: "server_curriculum" });
    const [sql, , slug, , selectedIndex, correctIndex, correct] = mocks.query.mock.calls[0];
    expect(sql).toContain('INSERT INTO "QuizAttempt"');
    expect(sql).toContain('"selectedIndex"');
    expect(slug).toBe(lesson.slug);
    expect(selectedIndex).toBe(wrongIndex);
    expect(correctIndex).toBe(question.correctIndex);
    expect(correct).toBe(false);
  });

  it("keeps session-only questions as unverified practice without storing a fabricated score", async () => {
    const body = await (await quizPost(request({ quizId: "generated-question", questionId: "one", selectedAnswer: "A", correctAnswer: "A" }))).json();
    expect(body).toMatchObject({ correct: true, recorded: false, gradingSource: "client_practice" });
    expect(mocks.query).not.toHaveBeenCalled();
  });
});
