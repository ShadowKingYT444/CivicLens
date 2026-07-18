import {
  BILL_TYPE_LABELS,
  type BillType,
  OFFICIAL_SOURCE_URLS,
} from "../constants";

export interface ParsedBillRef {
  raw: string;
  congress?: number;
  type: BillType;
  number: number;
}

interface BillPattern {
  type: BillType;
  pattern: RegExp;
}

const BILL_PATTERNS: BillPattern[] = [
  {
    type: "hjres",
    pattern: /\bH\.?[\s-]*J\.?[\s-]*Res(?:olution)?\.?[\s-]*(\d{1,6})\b/gi,
  },
  {
    type: "sjres",
    pattern: /\bS\.?[\s-]*J\.?[\s-]*Res(?:olution)?\.?[\s-]*(\d{1,6})\b/gi,
  },
  {
    type: "hconres",
    pattern: /\bH\.?[\s-]*Con\.?[\s-]*Res(?:olution)?\.?[\s-]*(\d{1,6})\b/gi,
  },
  {
    type: "sconres",
    pattern: /\bS\.?[\s-]*Con\.?[\s-]*Res(?:olution)?\.?[\s-]*(\d{1,6})\b/gi,
  },
  {
    type: "hres",
    pattern: /\bH\.?[\s-]*Res(?:olution)?\.?[\s-]*(\d{1,6})\b/gi,
  },
  {
    type: "sres",
    pattern: /\bS\.?[\s-]*Res(?:olution)?\.?[\s-]*(\d{1,6})\b/gi,
  },
  {
    type: "hjres",
    pattern: /\bHouse\s+Joint\s+Resolution\s+(?:No\.?\s*)?(\d{1,6})\b/gi,
  },
  {
    type: "sjres",
    pattern: /\bSenate\s+Joint\s+Resolution\s+(?:No\.?\s*)?(\d{1,6})\b/gi,
  },
  {
    type: "hconres",
    pattern: /\bHouse\s+Concurrent\s+Resolution\s+(?:No\.?\s*)?(\d{1,6})\b/gi,
  },
  {
    type: "sconres",
    pattern: /\bSenate\s+Concurrent\s+Resolution\s+(?:No\.?\s*)?(\d{1,6})\b/gi,
  },
  {
    type: "hres",
    pattern: /\bHouse\s+Resolution\s+(?:No\.?\s*)?(\d{1,6})\b/gi,
  },
  {
    type: "sres",
    pattern: /\bSenate\s+Resolution\s+(?:No\.?\s*)?(\d{1,6})\b/gi,
  },
  { type: "hr", pattern: /\bH\.?[\s-]*R\.?[\s-]*(\d{1,6})\b/gi },
  { type: "hr", pattern: /\bHouse\s+Bill\s+(?:No\.?\s*)?(\d{1,6})\b/gi },
  { type: "s", pattern: /\bS\.?[\s-]*(\d{1,6})\b/gi },
  { type: "s", pattern: /\bSenate\s+Bill\s+(?:No\.?\s*)?(\d{1,6})\b/gi },
];

export function parseBillRefs(input: string): ParsedBillRef[] {
  const refs: ParsedBillRef[] = [];

  for (const { type, pattern } of BILL_PATTERNS) {
    pattern.lastIndex = 0;

    for (const match of input.matchAll(pattern)) {
      const number = Number(match[1]);
      if (!Number.isInteger(number) || number <= 0) {
        continue;
      }

      const start = match.index ?? 0;
      const end = start + match[0].length;
      refs.push({
        raw: match[0],
        congress: extractCongress(
          input.slice(
            Math.max(0, start - 80),
            Math.min(input.length, end + 80),
          ),
        ),
        type,
        number,
      });
    }
  }

  return dedupeBillRefs(refs).sort(
    (a, b) => input.indexOf(a.raw) - input.indexOf(b.raw),
  );
}

export function parseSingleBillRef(input: string): ParsedBillRef | undefined {
  return parseBillRefs(input)[0];
}

export function normalizeBillType(input: string): BillType | undefined {
  const normalized = input.toLowerCase().replace(/[^a-z]/g, "");

  for (const type of Object.keys(BILL_TYPE_LABELS) as BillType[]) {
    if (normalized === type) {
      return type;
    }
  }

  if (normalized === "hjr" || normalized === "hjresolution") return "hjres";
  if (normalized === "sjr" || normalized === "sjresolution") return "sjres";
  if (normalized === "hcr" || normalized === "hconresolution") return "hconres";
  if (normalized === "scr" || normalized === "sconresolution") return "sconres";

  return undefined;
}

export function formatBillRef(ref: ParsedBillRef): string {
  const prefix = ref.congress
    ? `${formatCongressOrdinal(ref.congress)} Congress `
    : "";
  return `${prefix}${BILL_TYPE_LABELS[ref.type]} ${ref.number}`;
}

export function congressBillUrl(ref: ParsedBillRef): string | undefined {
  if (!ref.congress) {
    return undefined;
  }

  return `${OFFICIAL_SOURCE_URLS.congressBill}/${formatCongressOrdinal(ref.congress)}-congress/${typeToCongressPath(ref.type)}/${ref.number}`;
}

export function typeToCongressPath(type: BillType): string {
  switch (type) {
    case "hr":
      return "house-bill";
    case "s":
      return "senate-bill";
    case "hjres":
      return "house-joint-resolution";
    case "sjres":
      return "senate-joint-resolution";
    case "hconres":
      return "house-concurrent-resolution";
    case "sconres":
      return "senate-concurrent-resolution";
    case "hres":
      return "house-resolution";
    case "sres":
      return "senate-resolution";
  }

  const exhaustive: never = type;
  return exhaustive;
}

function extractCongress(context: string): number | undefined {
  const patterns = [
    /\b(\d{1,3})(?:st|nd|rd|th)?\s+Congress\b/i,
    /\bCongress\s*(?:No\.?|#|:)?\s*(\d{1,3})\b/i,
    /\((\d{1,3})(?:st|nd|rd|th)?\)/i,
  ];

  for (const pattern of patterns) {
    const match = pattern.exec(context);
    const congress = match ? Number(match[1]) : Number.NaN;
    if (Number.isInteger(congress) && congress > 0 && congress < 1000) {
      return congress;
    }
  }

  return undefined;
}

function dedupeBillRefs(refs: ParsedBillRef[]): ParsedBillRef[] {
  const seen = new Set<string>();
  const deduped: ParsedBillRef[] = [];

  for (const ref of refs) {
    const key = `${ref.congress ?? "unknown"}:${ref.type}:${ref.number}`;
    if (!seen.has(key)) {
      seen.add(key);
      deduped.push(ref);
    }
  }

  return deduped;
}

function formatCongressOrdinal(congress: number): string {
  const mod100 = congress % 100;
  if (mod100 >= 11 && mod100 <= 13) {
    return `${congress}th`;
  }

  switch (congress % 10) {
    case 1:
      return `${congress}st`;
    case 2:
      return `${congress}nd`;
    case 3:
      return `${congress}rd`;
    default:
      return `${congress}th`;
  }
}
