export type BillStage =
  "introduced" | "committee" | "house" | "senate" | "president" | "law";

export type BillReadableFields = {
  simpleTitle: string;
  oneLineSummary: string;
  inSimpleWords: string;
  whatChanges: string;
  whoIsAffected: string;
  currentStatus: string;
  stage: BillStage;
};

type BillActionInput = {
  date?: string;
  actionDate?: string;
  text?: string;
  description?: string;
};

type BillReadableInput = {
  title?: string;
  shortTitle?: string;
  summary?: string;
  latestAction?: string;
  subjects?: string[];
  actions?: BillActionInput[];
};

const ENTITY_MAP: Record<string, string> = {
  amp: "&",
  apos: "'",
  cent: " cents",
  copy: "(c)",
  emdash: "-",
  endash: "-",
  gt: ">",
  hellip: "...",
  laquo: '"',
  ldquo: '"',
  lsquo: "'",
  lt: "<",
  mdash: "-",
  nbsp: " ",
  ndash: "-",
  quot: '"',
  raquo: '"',
  rdquo: '"',
  reg: "(r)",
  rsquo: "'",
  sect: "section",
  shy: "",
  trade: "(tm)",
};

const CHANGE_PATTERNS = [
  /\b(?:amend|amends|amended|change|changes|changed)\b/i,
  /\b(?:repeal|repeals|repealed|remove|removes|removed)\b/i,
  /\b(?:establish|establishes|established|create|creates|created)\b/i,
  /\b(?:require|requires|required|prohibit|prohibits|prohibited)\b/i,
  /\b(?:authorize|authorizes|authorized|direct|directs|directed)\b/i,
  /\b(?:extend|extends|extended|increase|increases|decrease|decreases)\b/i,
];

const AFFECTED_PATTERNS = [
  /\b(?:people|person|persons|families|workers|employees|retirees|beneficiaries)\b/i,
  /\b(?:students|veterans|children|seniors|taxpayers|consumers|patients)\b/i,
  /\b(?:states|local governments|agencies|schools|employers|businesses)\b/i,
  /\b(?:who receive|who are|affected|eligible|covered by)\b/i,
];

const SENTENCE_BOUNDARY = /[.!?]["')\]]?\s+(?=[A-Z])/g;
const SENTENCE_ABBREVIATIONS =
  /\b(?:U\.S|U\.S\.C|D\.C|No|Sec|Rep|Sen|Mr|Mrs|Ms|Dr|Prof|Inc|Ltd)\.$/i;

export function sanitizeBillText(value: unknown): string {
  if (typeof value !== "string") {
    return "";
  }

  return decodeHtmlEntities(
    value
      .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, " ")
      .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, " ")
      .replace(/<br\s*\/?>/gi, " ")
      .replace(/<\/p\s*>/gi, " ")
      .replace(/<[^>]+>/g, " "),
  )
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u201C\u201D]/g, '"')
    .replace(/[\u2013\u2014]/g, "-")
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function sanitizeBillTextList(
  values: Array<unknown> | undefined,
): string[] {
  const seen = new Set<string>();
  const cleanValues: string[] = [];

  for (const value of values ?? []) {
    const clean = sanitizeBillText(value);
    const key = clean.toLowerCase();
    if (!clean || seen.has(key)) {
      continue;
    }

    seen.add(key);
    cleanValues.push(clean);
  }

  return cleanValues;
}

export function dedupeTimelineActions<T extends BillActionInput>(
  actions: T[] | undefined,
): Array<
  Omit<T, "date" | "actionDate" | "text" | "description"> & {
    date?: string;
    text: string;
  }
> {
  const seen = new Set<string>();
  const cleanActions: Array<
    Omit<T, "date" | "actionDate" | "text" | "description"> & {
      date?: string;
      text: string;
    }
  > = [];

  for (const action of actions ?? []) {
    const text = sanitizeBillText(action.text ?? action.description ?? "");
    if (!text) {
      continue;
    }

    const date = sanitizeBillText(action.date ?? action.actionDate ?? "");
    const key = `${date}|${text.toLowerCase()}`;
    if (seen.has(key)) {
      continue;
    }

    seen.add(key);
    const {
      date: _date,
      actionDate: _actionDate,
      text: _text,
      description: _description,
      ...rest
    } = action;
    cleanActions.push({
      ...rest,
      ...(date ? { date } : {}),
      text,
    });
  }

  return cleanActions;
}

export function buildReadableBillFields(
  input: BillReadableInput,
): BillReadableFields {
  const title = sanitizeBillText(input.title);
  const shortTitle = sanitizeBillText(input.shortTitle);
  const summary = stripLeadingTitle(
    sanitizeBillText(input.summary),
    shortTitle || title,
  );
  const latestAction = sanitizeBillText(input.latestAction);
  const actions = dedupeTimelineActions(input.actions);
  const subjects = sanitizeBillTextList(input.subjects);
  const stage = computeBillStage({ latestAction, actions });
  const summarySentences = splitSentences(summary);
  const latestStatus = latestAction || actions[0]?.text || "";
  const firstSummary = firstSubstantiveSentence(summarySentences);
  const statusFallback =
    latestStatus || "No official summary was returned for this bill.";

  const oneLineSummary = truncateText(
    simplifyPlainLanguage(firstSummary || statusFallback),
    170,
  );
  const inSimpleWords = truncateText(
    buildPlainSummary(summarySentences, oneLineSummary),
    260,
  );

  return {
    simpleTitle: makeSimpleTitle(shortTitle || title),
    oneLineSummary,
    inSimpleWords,
    whatChanges: truncateText(
      simplifyPlainLanguage(
        selectSentence(summarySentences, CHANGE_PATTERNS) || oneLineSummary,
      ),
      190,
    ),
    whoIsAffected: truncateText(
      simplifyPlainLanguage(
        selectSentence(summarySentences, AFFECTED_PATTERNS) ||
          subjectFallback(subjects) ||
          "The official summary does not identify a specific affected group.",
      ),
      190,
    ),
    currentStatus: makeCurrentStatus(stage, latestStatus),
    stage,
  };
}

export function computeBillStage(input: {
  latestAction?: string;
  actions?: BillActionInput[];
}): BillStage {
  const texts = [
    sanitizeBillText(input.latestAction),
    ...(input.actions ?? []).map((action) =>
      sanitizeBillText(action.text ?? action.description ?? ""),
    ),
  ].filter(Boolean);
  let stage: BillStage = "introduced";

  for (const text of texts) {
    const lower = text.toLowerCase();
    if (
      /\b(?:became (?:public |private )?law|public law no|public law|private law|signed by the president|signed by president|signed into law|approved by the president|approved by president|enacted)\b/.test(
        lower,
      )
    ) {
      return "law";
    }
    if (
      /\b(?:presented to the president|to president|ordered to be presented to the president)\b/.test(
        lower,
      )
    ) {
      stage = maxStage(stage, "president");
      continue;
    }
    if (
      /\b(?:passed senate|passed\/agreed to in senate|senate passed|passed the senate)\b/.test(
        lower,
      )
    ) {
      stage = maxStage(stage, "senate");
      continue;
    }
    if (
      /\b(?:passed house|passed\/agreed to in house|house passed|passed the house)\b/.test(
        lower,
      )
    ) {
      stage = maxStage(stage, "house");
      continue;
    }
    if (
      /\b(?:referred to|committee|reported by|ordered to be reported)\b/.test(
        lower,
      )
    ) {
      stage = maxStage(stage, "committee");
      continue;
    }
    if (/\b(?:introduced|read twice|read the first time)\b/.test(lower)) {
      stage = maxStage(stage, "introduced");
    }
  }

  return stage;
}

function stripLeadingTitle(summary: string, title: string): string {
  const cleanTitle = sanitizeBillText(title)
    .replace(/[.:;-]+$/, "")
    .trim();
  if (
    !summary ||
    !cleanTitle ||
    !summary.toLowerCase().startsWith(cleanTitle.toLowerCase())
  ) {
    return summary;
  }

  const withoutTitle = summary
    .slice(cleanTitle.length)
    .replace(/^[\s:.;-]+/, "")
    .trim();
  return withoutTitle.length > 20 ? withoutTitle : summary;
}

function decodeHtmlEntities(value: string): string {
  return value.replace(
    /&(#x?[0-9a-f]+|[a-z][a-z0-9]+);/gi,
    (match, entity: string) => {
      const normalized = entity.toLowerCase();
      if (normalized.startsWith("#x")) {
        return codePointToString(
          Number.parseInt(normalized.slice(2), 16),
          match,
        );
      }
      if (normalized.startsWith("#")) {
        return codePointToString(
          Number.parseInt(normalized.slice(1), 10),
          match,
        );
      }

      return ENTITY_MAP[normalized] ?? match;
    },
  );
}

function codePointToString(codePoint: number, fallback: string): string {
  if (!Number.isInteger(codePoint) || codePoint <= 0) {
    return fallback;
  }

  try {
    return String.fromCodePoint(codePoint);
  } catch {
    return fallback;
  }
}

function splitSentences(text: string): string[] {
  const sentences: string[] = [];
  let remaining = text.trim();

  while (remaining && sentences.length < 12) {
    SENTENCE_BOUNDARY.lastIndex = 0;
    let boundary: RegExpExecArray | null = null;
    let candidateBoundary: RegExpExecArray | null = null;
    while ((candidateBoundary = SENTENCE_BOUNDARY.exec(remaining))) {
      const candidate = remaining.slice(0, candidateBoundary.index + 1).trim();
      if (!SENTENCE_ABBREVIATIONS.test(candidate)) {
        boundary = candidateBoundary;
        break;
      }
    }

    if (!boundary) {
      sentences.push(remaining);
      break;
    }

    sentences.push(remaining.slice(0, boundary.index + 1).trim());
    remaining = remaining.slice(boundary.index + boundary[0].length).trim();
  }

  return sentences.map(sanitizeBillText).filter(Boolean);
}

function makeSimpleTitle(title: string): string {
  const simple = title
    .replace(
      /^\s*(?:[A-Z]\.?\s*)?(?:H\.?\s*R\.?|S\.?|H\.?\s*J\.?\s*Res\.?|S\.?\s*J\.?\s*Res\.?)\s*\d+\s*[-:]\s*/i,
      "",
    )
    .replace(/^\s*\d{1,3}(?:st|nd|rd|th)\s+Congress\s*[-:]\s*/i, "")
    .replace(/^A bill to\b/i, "Bill to")
    .trim();

  return truncateText(simple || title || "Bill details", 120);
}

function simplifyPlainLanguage(text: string): string {
  return sanitizeBillText(text)
    .replace(/\bThis bill\b/g, "The bill")
    .replace(/\bthis bill\b/g, "the bill")
    .replace(/\bamends\b/gi, "changes")
    .replace(/\bamended\b/gi, "changed")
    .replace(/\brepeals\b/gi, "ends")
    .replace(/\brepealed\b/gi, "ended")
    .replace(/\bprovisions\b/gi, "rules")
    .replace(/\bpursuant to\b/gi, "under")
    .replace(/\bshall\b/gi, "must")
    .replace(/\butilize\b/gi, "use")
    .replace(/\bcommence\b/gi, "begin")
    .replace(/\bterminate\b/gi, "end")
    .replace(/\bprior to\b/gi, "before")
    .replace(/\bsubsequent to\b/gi, "after")
    .replace(/\bnotwithstanding\b/gi, "despite")
    .replace(/\bUnited States Code\b/g, "U.S. Code")
    .replace(
      /\btitle\s+([IVXLCDM]+|\d+)\s+of\s+the\s+([A-Z][A-Za-z0-9 ,.'-]+? Act)\b/g,
      "the $2",
    )
    .replace(/\s+/g, " ")
    .trim();
}

function firstSubstantiveSentence(sentences: string[]): string | undefined {
  return sentences.find((sentence) => {
    const clean = sentence.trim();
    return (
      clean.length > 20 && !/^(?:short title|table of contents)\b/i.test(clean)
    );
  });
}

function buildPlainSummary(sentences: string[], fallback: string): string {
  const chosen = sentences
    .filter((sentence) => sentence.length > 20)
    .slice(0, 2)
    .join(" ");

  return simplifyPlainLanguage(chosen || fallback);
}

function selectSentence(
  sentences: string[],
  patterns: RegExp[],
): string | undefined {
  return sentences.find((sentence) =>
    patterns.some((pattern) => pattern.test(sentence)),
  );
}

function subjectFallback(subjects: string[]): string | undefined {
  if (!subjects.length) {
    return undefined;
  }

  return `Affected groups are not explicit in the summary; related subjects include ${joinShortList(subjects.slice(0, 3))}.`;
}

function joinShortList(values: string[]): string {
  if (values.length <= 1) {
    return values[0] ?? "";
  }
  if (values.length === 2) {
    return `${values[0]} and ${values[1]}`;
  }

  return `${values.slice(0, -1).join(", ")}, and ${values[values.length - 1]}`;
}

function makeCurrentStatus(stage: BillStage, latestAction: string): string {
  const labelByStage: Record<BillStage, string> = {
    introduced: "Introduced",
    committee: "In committee",
    house: "Passed or active in the House",
    senate: "Passed or active in the Senate",
    president: "Sent to the President",
    law: "Became law",
  };

  return latestAction
    ? `${labelByStage[stage]}: ${truncateText(latestAction, 180)}`
    : labelByStage[stage];
}

function maxStage(current: BillStage, next: BillStage): BillStage {
  const order: BillStage[] = [
    "introduced",
    "committee",
    "house",
    "senate",
    "president",
    "law",
  ];
  return order.indexOf(next) > order.indexOf(current) ? next : current;
}

function truncateText(text: string, maxLength: number): string {
  const clean = sanitizeBillText(text);
  if (clean.length <= maxLength) {
    return clean;
  }

  const shortened = clean
    .slice(0, maxLength - 3)
    .replace(/\s+\S*$/, "")
    .trim();
  return `${shortened || clean.slice(0, maxLength - 3)}...`;
}
