import { describe, expect, it } from "vitest";
import { parseBillRefs, parseSingleBillRef } from "@/lib/civic/bill-parser";

describe("bill parser", () => {
  it("parses common House and Senate bill references", () => {
    expect(parseSingleBillRef("H.R. 1")).toMatchObject({
      type: "hr",
      number: 1
    });

    expect(parseSingleBillRef("S. 686")).toMatchObject({
      type: "s",
      number: 686
    });
  });

  it("parses congress numbers and resolution variants", () => {
    expect(parseSingleBillRef("118th Congress H.J.Res. 7")).toMatchObject({
      congress: 118,
      type: "hjres",
      number: 7
    });

    expect(parseSingleBillRef("116th Congress S.Con.Res. 14")).toMatchObject({
      congress: 116,
      type: "sconres",
      number: 14
    });
  });

  it("extracts the first official bill reference from a noisy student claim", () => {
    const parsed = parseSingleBillRef("My class is discussing whether HR 5376 changed climate funding.");

    expect(parsed).toMatchObject({
      type: "hr",
      number: 5376
    });
    expect(parsed?.raw.toLowerCase()).toContain("hr 5376");
  });

  it("returns null for text that does not contain a bill reference", () => {
    expect(parseBillRefs("What does Congress do?")).toEqual([]);
  });
});
