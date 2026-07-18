import { describe, expect, it } from "vitest";
import { parseDistrictLabel } from "@/lib/civic/district-parser";

describe("parseDistrictLabel", () => {
  it("parses compact congressional district references", () => {
    expect(parseDistrictLabel("CA-12")).toMatchObject({
      stateCode: "CA",
      district: "12"
    });
  });

  it("parses district-only references without inventing a state", () => {
    const parsed = parseDistrictLabel("congressional district 12");

    expect(parsed.district).toBe("12");
    expect(parsed.stateCode).toBeUndefined();
  });

  it("handles at-large districts", () => {
    expect(parseDistrictLabel("DC at-large")).toMatchObject({
      stateCode: "DC",
      district: "At-Large",
      atLarge: true
    });
  });

  it("does not parse raw addresses as congressional districts", () => {
    const parsed = parseDistrictLabel("1600 Pennsylvania Ave NW, Washington, DC");

    expect(parsed.stateCode).toBeUndefined();
    expect(parsed.district).toBeUndefined();
    expect(parsed.atLarge).toBe(false);
  });
});
