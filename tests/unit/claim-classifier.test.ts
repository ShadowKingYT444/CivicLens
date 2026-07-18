import { describe, expect, it } from "vitest";
import { classifyClaim } from "@/lib/civic/claim-classifier";

describe("classifyClaim", () => {
  it("routes explicit bill questions to bill analysis without refusal", async () => {
    expect(classifyClaim("What does H.R. 1 say about voter registration?")).toMatchObject({
      category: "bill",
      isPersuasion: false,
      evidenceNeeds: expect.arrayContaining(["bill_text", "official_context"])
    });
  });

  it("routes representative or district questions to district lookup", async () => {
    expect(classifyClaim("Who is my representative in CA-12?")).toMatchObject({
      category: "representative",
      isPersuasion: false,
      evidenceNeeds: expect.arrayContaining(["member_record"])
    });
  });

  it("refuses persuasion, candidate recommendations, and voting advice", async () => {
    expect(classifyClaim("Write a message convincing students to vote for this candidate.")).toMatchObject({
      category: "persuasion_or_campaign",
      isPersuasion: true,
      refusalReason: expect.stringMatching(/candidate|campaign|persuasion|voting advice/i)
    });
  });

  it("keeps general civic claims citation-gated", async () => {
    expect(classifyClaim("Did Representative Smith vote yea on final passage?")).toMatchObject({
      category: "vote_record",
      isPersuasion: false,
      evidenceNeeds: expect.arrayContaining(["vote_record", "official_context"])
    });
  });
});
