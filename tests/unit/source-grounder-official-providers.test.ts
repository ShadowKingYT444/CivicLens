import { afterEach, describe, expect, it, vi } from "vitest";
import {
  getDemoBill,
  retrieveGroundedSources,
} from "@/lib/civic/source-grounder";

const originalEnv = { ...process.env };

describe("source grounder official provider integration", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    process.env = { ...originalEnv };
  });

  it("never substitutes the seeded demo bill for a different requested identity", () => {
    process.env = { ...originalEnv };
    delete process.env.CONGRESS_API_KEY;

    expect(getDemoBill(119, "hr", 999)).toBeNull();
    expect(getDemoBill(118, "hr", 82)?.number).toBe(82);
  });

  it("discloses the assumed historical Congress for an unspecified demo bill", async () => {
    process.env = { ...originalEnv, CONGRESS_API_KEY: "" };
    const result = await retrieveGroundedSources("H.R. 82 became law.");
    expect(result.mode).toBe("demo");
    expect(result.warnings).toEqual([expect.stringMatching(/118th Congress.*Bill numbers restart/)]);
  });

  it("labels mixed live and packaged evidence conservatively", async () => {
    process.env = {
      ...originalEnv, DATABASE_URL: "", FEDERAL_REGISTER_API_BASE: "https://www.federalregister.gov/api/v1",
    };
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(Response.json({ results: [{
      title: "Agency public comment notice", abstract: "The agency invites public comments on a proposed rule.",
      html_url: "https://www.federalregister.gov/documents/2026/01/02/public-comment", document_number: "2026-001",
    }] })));
    const result = await retrieveGroundedSources("public comment on an agency rule", 5);
    expect(result.citations.some((citation) => citation.id === "official-federal-register")).toBe(true);
    expect(result.citations.some((citation) => citation.id !== "official-federal-register")).toBe(true);
    expect(result.mode).toBe("demo");
    expect(result.warnings).toEqual([expect.stringMatching(/mixed provenance/)]);
  });

  it("does not present configured search links as fetched evidence", async () => {
    process.env = {
      ...originalEnv,
      DATABASE_URL: "",
      OFFICIAL_SOURCE_LIVE: "false",
      OPENFEC_API_KEY: "fec-key",
      GOVINFO_API_KEY: "govinfo-key",
    };

    const result = await retrieveGroundedSources(
      "campaign finance contribution reports",
      5,
    );

    expect(result.mode).toBe("demo");
    expect(result.citations.map((citation) => citation.id)).not.toContain("official-openfec");
    expect(result.documents.some((document) => document.id === "official-openfec")).toBe(false);
  });

  it("keeps the latest action and substantive official summary as distinct analysis inputs", async () => {
    process.env = {
      ...originalEnv,
      CONGRESS_API_KEY: "test-key",
      CONGRESS_API_BASE_URL: "https://congress.test/v3",
    };

    const summaryText =
      "This bill repeals the sample offset rule and changes eligibility for the affected retirement benefit.";
    const fetchMock = vi.fn(async (input: string | URL | Request) => {
      const url = String(input);
      if (url.includes("/summaries?")) {
        return Response.json({
          summaries: [{ text: summaryText, updateDate: "2025-06-02" }],
        });
      }
      if (url.includes("/actions?")) {
        return Response.json({
          actions: [
            { text: "Introduced in House.", actionDate: "2025-01-03" },
            { text: "Referred to committee.", actionDate: "2025-01-04" },
          ],
        });
      }
      return Response.json({
        bill: {
          title: "Sample Retirement Benefit Act",
          latestAction: {
            text: "Referred to committee.",
            actionDate: "2025-01-04",
          },
          sponsors: [],
          subjects: { legislativeSubjects: [{ name: "Retirement benefits" }] },
        },
      });
    });
    vi.stubGlobal("fetch", fetchMock);

    const result = await retrieveGroundedSources(
      "What does H.R. 999 in the 119th Congress change?",
      5,
    );

    const action = result.citations.find(
      (citation) => citation.id === "119-hr-999-action",
    );
    const summary = result.citations.find(
      (citation) => citation.id === "119-hr-999-summary",
    );
    expect(action?.excerpt).toBe("Referred to committee.");
    expect(summary?.excerpt).toContain("repeals the sample offset rule");
    expect(action?.sourceDocumentId).not.toBe(summary?.sourceDocumentId);
    expect(result.documents.map((document) => document.citation.id)).toEqual(
      expect.arrayContaining(["119-hr-999-action", "119-hr-999-summary"]),
    );
  });
});
