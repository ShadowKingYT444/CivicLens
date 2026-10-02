import { beforeEach, describe, expect, it, vi } from "vitest";
import lessons from "../../data/concept-cards.json";
import { GET } from "../../app/api/feed/route";

const { getPrisma, query } = vi.hoisted(() => ({ getPrisma: vi.fn(), query: vi.fn() }));
vi.mock("../../lib/db/prisma", () => ({ getPrisma }));

describe("lesson delivery", () => {
  beforeEach(() => { getPrisma.mockReset(); query.mockReset(); });
  it("delivers the complete authored curriculum and real source links without a database", async () => {
    getPrisma.mockResolvedValue(null);
    const body = await (await GET()).json();
    expect(body.mode).toBe("demo");
    expect(body.data).toHaveLength(32);
    for (const lesson of body.data) {
      expect(lesson.flashcards).toHaveLength(3);
      expect(lesson.quizQuestions).toHaveLength(3);
      expect(lesson.citations.length).toBeGreaterThan(0);
      expect(lesson.citations.every((citation: { id: string; url: string }) => lesson.sourceIds.includes(citation.id) && citation.url.startsWith("https://"))).toBe(true);
    }
  });
  it("preserves stored rich lesson content and hydrates legacy seeded lessons", async () => {
    const first = lessons[0];
    query.mockResolvedValue([
      { ...first, flashcards: undefined, quizQuestions: undefined },
      { ...lessons[1], quizJson: { ...lessons[1].quizJson, flashcards: [{ title: "Stored lesson", body: "A revised teaching card" }] } },
    ]);
    getPrisma.mockResolvedValue({ $queryRawUnsafe: query });
    const body = await (await GET()).json();
    expect(body.mode).toBe("live");
    expect(body.data[0].flashcards).toHaveLength(3);
    expect(body.data[0].quizQuestions).toHaveLength(3);
    expect(body.data[1].flashcards[0].title).toBe("Stored lesson");
  });
});
