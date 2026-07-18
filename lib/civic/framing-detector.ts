export type FramingSeverity = "info" | "caution" | "high";

export interface FramingFlag {
  id:
    | "loaded_language"
    | "absolute_claim"
    | "missing_source"
    | "call_to_action"
    | "identity_blame"
    | "conspiracy_frame"
    | "single_cause_frame"
    | "unsupported_quantifier";
  label: string;
  severity: FramingSeverity;
  explanation: string;
  rubric: string;
}

interface FramingRule {
  flag: FramingFlag;
  pattern: RegExp;
}

const SOURCE_PATTERN = /\b(?:according to|source|cited|reported by|congress\.gov|census\.gov|\.gov|bill text|roll call|public law)\b/i;

const RULES: FramingRule[] = [
  {
    pattern: /\b(?:corrupt|evil|traitor|destroying america|radical agenda|extremist|enemy of the people)\b/i,
    flag: {
      id: "loaded_language",
      label: "Loaded language",
      severity: "caution",
      explanation: "The claim uses emotionally charged labels that should be separated from source-backed facts.",
      rubric: "Flags emotionally charged descriptors that can steer interpretation before evidence is shown.",
    },
  },
  {
    pattern: /\b(?:always|never|everyone|nobody|guaranteed|undeniable|proof that|without question)\b/i,
    flag: {
      id: "absolute_claim",
      label: "Absolute wording",
      severity: "info",
      explanation: "The claim uses absolute wording that may need narrower source-backed wording.",
      rubric: "Flags universal or certainty terms that official records may not fully support.",
    },
  },
  {
    pattern: /\b(?:share this|tell everyone|make them vote|vote for|vote against|donate|canvass|campaign script)\b/i,
    flag: {
      id: "call_to_action",
      label: "Political call to action",
      severity: "high",
      explanation: "The text asks for electoral or campaign action rather than neutral civic explanation.",
      rubric: "Flags requests that could become persuasion, voting advice, or campaign strategy.",
    },
  },
  {
    pattern: /\b(?:immigrants|liberals|conservatives|democrats|republicans|students|parents|workers)\s+(?:are|all|always|never|want|caused|ruined)\b/i,
    flag: {
      id: "identity_blame",
      label: "Identity blame",
      severity: "caution",
      explanation: "The claim frames a broad group as responsible and should be checked against specific evidence.",
      rubric: "Flags broad group blame where official sources may only address specific actions or records.",
    },
  },
  {
    pattern: /\b(?:secret plan|cover[- ]?up|deep state|they don't want you to know|hidden agenda)\b/i,
    flag: {
      id: "conspiracy_frame",
      label: "Conspiracy framing",
      severity: "caution",
      explanation: "The claim suggests hidden coordination; official evidence may not support that framing.",
      rubric: "Flags hidden-intent claims that require stronger sourcing than ordinary policy descriptions.",
    },
  },
  {
    pattern: /\b(?:only reason|single reason|all because|caused entirely by|nothing but)\b/i,
    flag: {
      id: "single_cause_frame",
      label: "Single-cause framing",
      severity: "info",
      explanation: "The claim attributes an outcome to one cause, which may omit important context.",
      rubric: "Flags claims that compress complex government actions into a single cause.",
    },
  },
  {
    pattern: /\b(?:millions|billions|most people|massive|huge number|countless|everyone knows)\b/i,
    flag: {
      id: "unsupported_quantifier",
      label: "Unsupported scale wording",
      severity: "info",
      explanation: "The claim uses scale language that should be tied to a specific official number.",
      rubric: "Flags quantity or scale terms when no numeric source is provided in the text.",
    },
  },
];

export function detectFraming(input: string): FramingFlag[] {
  const flags = RULES.filter((rule) => rule.pattern.test(input)).map((rule) => rule.flag);

  if (looksFactual(input) && !SOURCE_PATTERN.test(input)) {
    flags.push({
      id: "missing_source",
      label: "No source named",
      severity: "info",
      explanation: "The claim appears factual but does not name an official or checkable source.",
      rubric: "Flags factual claims that should be grounded before explanation.",
    });
  }

  return dedupeFlags(flags);
}

function looksFactual(input: string): boolean {
  return /\b(?:bill|law|voted|passed|signed|funds|bans|requires|allows|representative|senator|district|agency|court)\b/i.test(
    input,
  );
}

function dedupeFlags(flags: FramingFlag[]): FramingFlag[] {
  const seen = new Set<string>();
  const deduped: FramingFlag[] = [];

  for (const flag of flags) {
    if (!seen.has(flag.id)) {
      seen.add(flag.id);
      deduped.push(flag);
    }
  }

  return deduped;
}
