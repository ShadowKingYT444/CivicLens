const EMAIL_PATTERN = /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi;
const PHONE_PATTERN = /(?:\+?1[\s.-]?)?(?:\(?\d{3}\)?[\s.-]?)\d{3}[\s.-]?\d{4}\b/g;
const SSN_PATTERN = /\b\d{3}-\d{2}-\d{4}\b/g;
const ZIP_PATTERN = /\b\d{5}(?:-\d{4})?\b/g;
const COORDINATE_PATTERN = /(?<![\w.])-?\d{1,3}\.\d{3,}\s*,\s*-?\d{1,3}\.\d{3,}(?![\w.])/g;

const STREET_ADDRESS_SOURCE = String.raw`\b\d{1,6}[A-Za-z]?\s+[A-Za-z0-9'.-]+(?:\s+[A-Za-z0-9'.-]+){0,6}\s+(?:Street|St|Avenue|Ave|Road|Rd|Boulevard|Blvd|Drive|Dr|Lane|Ln|Court|Ct|Way|Place|Pl|Terrace|Ter|Parkway|Pkwy|Highway|Hwy|Circle|Cir|Trail|Trl|Square|Sq|Loop|Plaza)\.?\b(?:\s+(?:Apt|Apartment|Unit|Suite|#)\s*[A-Za-z0-9-]+)?`;
const NUMBERED_ROUTE_ADDRESS_SOURCE = String.raw`\b\d{1,6}[A-Za-z]?\s+(?:(?:U\.?S\.?|State|County)\s+)?(?:Highway|Hwy|Route|Rte|County\s+Road|CR)\s*\d+[A-Za-z-]*(?:\s+(?:Box|Unit)\s*[A-Za-z0-9-]+)?\b`;
const RURAL_ROUTE_ADDRESS_SOURCE = String.raw`\b(?:Rural\s+Route|RR|HC)\s*\d+[A-Za-z-]*(?:\s*,?\s*Box\s*[A-Za-z0-9-]+)?\b`;
const PO_BOX_ADDRESS_SOURCE = String.raw`\b(?:P\.?\s*O\.?|Post\s+Office)\s+Box\s*[A-Za-z0-9-]+\b`;
const CONTEXTUAL_ADDRESS_SOURCE = String.raw`\b(?:(?:my|our)\s+)?(?:home\s+|mailing\s+|street\s+)?address\s*(?:is|:)\s*[^,;.!?\n]{2,100}|\b(?:I|we)\s+live\s+at\s+[^,;.!?\n]{2,100}`;

function addressPatterns(flags: string): RegExp[] {
  return [
    PO_BOX_ADDRESS_SOURCE,
    RURAL_ROUTE_ADDRESS_SOURCE,
    NUMBERED_ROUTE_ADDRESS_SOURCE,
    STREET_ADDRESS_SOURCE,
    CONTEXTUAL_ADDRESS_SOURCE,
  ].map((source) => new RegExp(source, flags));
}

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
    ...addressPatterns("gi").map((pattern): [RegExp, string] => [pattern, "[address]"]),
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

export function redactSensitiveText(input: string): string {
  return redactClaimText(input).redacted.replace(
    /\[(address|email|phone|ssn|coordinates)\]/g,
    "[redacted $1]",
  );
}

export function containsAddressLikeText(input: string): boolean {
  return addressPatterns("i").some((pattern) => pattern.test(input));
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
