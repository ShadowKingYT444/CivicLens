const EMAIL_PATTERN = /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi;
const PHONE_PATTERN = /(?:\+?1[\s.-]?)?(?:\(?\d{3}\)?[\s.-]?)\d{3}[\s.-]?\d{4}\b/g;
const SSN_PATTERN = /\b\d{3}-\d{2}-\d{4}\b/g;
const ZIP_PATTERN = /\b\d{5}(?:-\d{4})?\b/g;
const COORDINATE_PATTERN = /\b-?\d{1,3}\.\d{3,}\s*,\s*-?\d{1,3}\.\d{3,}\b/g;
const STREET_ADDRESS_PATTERN =
  /\b\d{1,6}\s+[A-Za-z0-9.'-]+(?:\s+[A-Za-z0-9.'-]+){0,5}\s+(?:Avenue|Ave|Boulevard|Blvd|Circle|Cir|Court|Ct|Drive|Dr|Highway|Hwy|Lane|Ln|Parkway|Pkwy|Place|Pl|Road|Rd|Route|Rt|Square|Sq|Street|St|Terrace|Ter|Trail|Trl|Way)\b\.?/gi;

export interface RedactionResult {
  redacted: string;
  changed: boolean;
  replacements: string[];
}

export function redactClaimText(input: string): RedactionResult {
  return redact(input, [
    [EMAIL_PATTERN, "[email]"],
    [PHONE_PATTERN, "[phone]"],
    [SSN_PATTERN, "[ssn]"],
    [COORDINATE_PATTERN, "[coordinates]"],
    [STREET_ADDRESS_PATTERN, "[address]"],
  ]);
}

export function redactRawAddress(input: string): RedactionResult {
  const trimmed = input.trim();

  if (!trimmed) {
    return { redacted: "", changed: false, replacements: [] };
  }

  return {
    redacted: "[address]",
    changed: true,
    replacements: ["address"],
  };
}

export function redactForLogging(input: string): string {
  return redactClaimText(input).redacted.replace(ZIP_PATTERN, "[zip]");
}

export function containsAddressLikeText(input: string): boolean {
  STREET_ADDRESS_PATTERN.lastIndex = 0;
  COORDINATE_PATTERN.lastIndex = 0;
  return STREET_ADDRESS_PATTERN.test(input) || COORDINATE_PATTERN.test(input);
}

function redact(input: string, replacements: Array<[RegExp, string]>): RedactionResult {
  let redacted = input;
  const labels = new Set<string>();

  for (const [pattern, replacement] of replacements) {
    pattern.lastIndex = 0;
    if (pattern.test(redacted)) {
      labels.add(replacement.replace(/[[\]]/g, ""));
      pattern.lastIndex = 0;
      redacted = redacted.replace(pattern, replacement);
    }
  }

  return {
    redacted,
    changed: redacted !== input,
    replacements: [...labels],
  };
}
