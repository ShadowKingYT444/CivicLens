import { createHash, createHmac, timingSafeEqual } from "node:crypto";
import { ENV_VARS } from "../constants";

export type HashPurpose = "claim" | "address" | "rate-limit" | "anonymous-id" | "generic";

export interface HashOptions {
  purpose?: HashPurpose;
  pepper?: string;
  env?: Record<string, string | undefined>;
}

export function hashClaimText(input: string, options: HashOptions = {}): string {
  return hashPrivateValue(input, { ...options, purpose: "claim" });
}

export function hashAddress(input: string, options: HashOptions = {}): string {
  return hashPrivateValue(input, { ...options, purpose: "address" });
}

export function hashPrivateValue(input: string, options: HashOptions = {}): string {
  const canonical = canonicalizePrivateValue(input);
  const purpose = options.purpose ?? "generic";
  const pepper = options.pepper ?? options.env?.[ENV_VARS.privacyHashPepper] ?? process.env[ENV_VARS.privacyHashPepper];
  const payload = `${purpose}:${canonical}`;

  if (pepper) {
    return createHmac("sha256", pepper).update(payload).digest("hex");
  }

  return createHash("sha256").update(payload).digest("hex");
}

export function canonicalizePrivateValue(input: string): string {
  return input.trim().replace(/\s+/g, " ").toLowerCase();
}

export function stableAnonymousId(parts: string[], options: HashOptions = {}): string {
  return hashPrivateValue(parts.map(canonicalizePrivateValue).join("|"), {
    ...options,
    purpose: "anonymous-id",
  }).slice(0, 32);
}

export function safeCompareHash(a: string, b: string): boolean {
  if (!/^[a-f0-9]{64}$/i.test(a) || !/^[a-f0-9]{64}$/i.test(b)) {
    return false;
  }

  const left = Buffer.from(a, "hex");
  const right = Buffer.from(b, "hex");
  return left.length === right.length && timingSafeEqual(left, right);
}
