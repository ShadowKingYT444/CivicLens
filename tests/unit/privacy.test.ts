import { afterEach, describe, expect, it } from "vitest";
import { isTruthyEnv } from "@/lib/constants";
import { hashClaimText } from "@/lib/privacy/hashing";
import { redactClaimText, redactForLogging, redactRawAddress } from "@/lib/privacy/redaction";

const originalStoreRawInputs = process.env.STORE_RAW_INPUTS;

afterEach(() => {
  if (originalStoreRawInputs === undefined) {
    delete process.env.STORE_RAW_INPUTS;
  } else {
    process.env.STORE_RAW_INPUTS = originalStoreRawInputs;
  }
});

describe("privacy utilities", () => {
  it("hashes raw claim text deterministically without returning the original text", () => {
    const raw = "The House voted on H.R. 1 yesterday.";

    expect(hashClaimText(raw)).toBe(hashClaimText(raw));
    expect(hashClaimText(raw)).not.toContain(raw);
    expect(hashClaimText(raw)).toMatch(/^[a-f0-9]{64}$/);
  });

  it("redacts raw street addresses before text can be stored or displayed", () => {
    const redacted = redactRawAddress("1600 Pennsylvania Ave NW, Washington, DC 20500");

    expect(redacted.redacted).not.toContain("1600 Pennsylvania");
    expect(redacted.redacted).toBe("[address]");
    expect(redacted.changed).toBe(true);
  });

  it("redacts contact details from claim text", () => {
    const redacted = redactClaimText("Email me at student@example.com or call 202-555-0100 about H.R. 1.");

    expect(redacted.redacted).not.toContain("student@example.com");
    expect(redacted.redacted).not.toContain("202-555-0100");
    expect(redacted.redacted).toContain("H.R. 1");
  });

  it("redacts address-like text before logging", () => {
    const redacted = redactForLogging("Mail from 1600 Pennsylvania Ave NW, Washington, DC 20500.");

    expect(redacted).not.toContain("1600 Pennsylvania");
    expect(redacted).not.toContain("20500");
    expect(redacted).toContain("[address]");
    expect(redacted).toContain("[zip]");
  });

  it("does not treat raw-input storage as enabled by default", () => {
    delete process.env.STORE_RAW_INPUTS;
    expect(isTruthyEnv(process.env.STORE_RAW_INPUTS)).toBe(false);

    process.env.STORE_RAW_INPUTS = "true";
    expect(isTruthyEnv(process.env.STORE_RAW_INPUTS)).toBe(true);
  });
});
