import { existsSync } from "node:fs";
import { mkdir, readdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";

type Category =
  | "truth-scale"
  | "bill-types"
  | "government"
  | "agencies"
  | "ui"
  | "mascot"
  | "misc";

type AssetPlan = {
  category: Category;
  slug: string;
  manifestGroup?: keyof typeof manifestSlots;
  manifestKey?: string;
  note?: string;
};

type ProcessedAsset = AssetPlan & {
  source: string;
  sourceRelative: string;
  hadAlpha: boolean;
  cleanedCheckerboard: boolean;
  outputs: Record<string, string>;
};

type RejectedAsset = {
  source: string;
  reason: string;
  output: string;
};

type PreparedImage = {
  buffer: Buffer;
  raw?: {
    width: number;
    height: number;
    channels: 4;
  };
  cleaned: boolean;
};

const rootDir = process.cwd();
const incomingDir = path.join(rootDir, "incoming-assets");
const fallbackDir = path.join(rootDir, "assets");
const sourceDir = existsSync(incomingDir) ? incomingDir : fallbackDir;
const publicAssetsDir = path.join(rootDir, "public", "assets");
const generatedDir = path.join(publicAssetsDir, "generated");
const rejectedDir = path.join(publicAssetsDir, "rejected-checkerboard");
const reportPath = path.join(rootDir, "ASSET_REPORT.md");
const manifestPath = path.join(rootDir, "lib", "asset-manifest.ts");

const imageExtensions = new Set([".png", ".webp", ".jpg", ".jpeg"]);
const pngSizes = [96, 192, 384, 512] as const;
const webpSizes = [384, 768] as const;

const manifestSlots = {
  truthScale: ["mostlyTrue", "mixed", "mostlyFalse", "insufficient"],
  billTypes: [
    "schoolMeals",
    "spending",
    "defense",
    "education",
    "healthcare",
    "environment",
    "infrastructure",
    "transportation",
    "housing",
    "publicSafety",
    "technology",
    "immigration",
    "taxation",
    "energy",
    "other",
  ],
  government: ["house", "senate", "supremeCourt", "executive", "congress"],
  agencies: ["dhs", "cia", "fbi", "ice", "doj", "state", "dod", "ssa", "epa", "nasa", "cdc", "irs"],
  ui: ["streak", "xp", "source", "quiz", "privacy", "claimCheck", "ballot", "vote"],
} as const;

const currentBundleOverrides: Array<[RegExp, AssetPlan]> = [
  [/03_04_18 PM \(1\)/, slot("bill-types", "school-meals", "billTypes", "schoolMeals")],
  [/03_04_19 PM \(2\)/, slot("bill-types", "spending", "billTypes", "spending")],
  [/03_04_19 PM \(3\)/, slot("bill-types", "defense", "billTypes", "defense")],
  [/03_04_19 PM \(4\)/, slot("bill-types", "education", "billTypes", "education")],
  [/03_04_21 PM \(5\)/, slot("bill-types", "healthcare", "billTypes", "healthcare")],
  [/03_04_21 PM \(6\)/, slot("bill-types", "environment", "billTypes", "environment")],
  [/03_04_22 PM \(7\)/, slot("bill-types", "infrastructure", "billTypes", "infrastructure")],
  [/03_04_22 PM \(8\)/, slot("bill-types", "transportation", "billTypes", "transportation")],
  [/03_04_26 PM \(1\)/, slot("truth-scale", "mostly-false", "truthScale", "mostlyFalse")],
  [/03_04_26 PM \(2\)/, slot("truth-scale", "mostly-true", "truthScale", "mostlyTrue")],
  [/03_04_26 PM \(3\)/, slot("truth-scale", "mixed", "truthScale", "mixed")],
  [/03_04_33 PM \(1\)/, slot("government", "congress-symbol", "government", "congress")],
  [/03_04_34 PM \(2\)/, slot("government", "house-symbol", "government", "house")],
  [/03_04_34 PM \(3\)/, slot("government", "supreme-court-symbol", "government", "supremeCourt")],
  [/03_04_34 PM \(4\)/, slot("agencies", "public-safety-symbol", "agencies", "dhs")],
  [/03_04_34 PM \(5\)/, slot("agencies", "navigation-symbol", "agencies", "state")],
  [/03_04_36 PM \(6\)/, slot("ui", "claim-check-symbol", "ui", "claimCheck")],
  [/03_04_36 PM \(7\)/, slot("bill-types", "immigration", "billTypes", "immigration")],
  [/03_07_17 PM/, {
    category: "misc",
    slug: "asset-reference-board",
    note: "Reference contact sheet; processed for review but not used as a primary app icon.",
  }],
  [/03_08_27 PM \(1\)/, { category: "misc", slug: "reference-home", note: "Mobile UI reference screenshot." }],
  [/03_08_28 PM \(2\)/, { category: "misc", slug: "reference-learn", note: "Mobile UI reference screenshot." }],
  [/03_08_28 PM \(3\)/, { category: "misc", slug: "reference-analyze", note: "Mobile UI reference screenshot." }],
  [/03_08_28 PM \(4\)/, { category: "misc", slug: "reference-bills", note: "Mobile UI reference screenshot." }],
  [/03_08_29 PM \(5\)/, { category: "misc", slug: "reference-district", note: "Mobile UI reference screenshot." }],
];

function slot(
  category: Category,
  slugName: string,
  manifestGroup: keyof typeof manifestSlots,
  manifestKey: string,
): AssetPlan {
  return { category, slug: slugName, manifestGroup, manifestKey };
}

async function main() {
  if (!existsSync(sourceDir)) {
    throw new Error(`No asset source folder found at ${incomingDir} or ${fallbackDir}`);
  }

  await rm(generatedDir, { recursive: true, force: true });
  await rm(rejectedDir, { recursive: true, force: true });
  await mkdir(generatedDir, { recursive: true });
  await mkdir(rejectedDir, { recursive: true });

  const files = (await readdir(sourceDir, { withFileTypes: true }))
    .filter((entry) => entry.isFile() && imageExtensions.has(path.extname(entry.name).toLowerCase()))
    .map((entry) => path.join(sourceDir, entry.name))
    .sort((a, b) => path.basename(a).localeCompare(path.basename(b)));

  const processed: ProcessedAsset[] = [];
  const rejected: RejectedAsset[] = [];

  for (const file of files) {
    const plan = inferAssetPlan(file);
    const metadata = await sharp(file).metadata();
    const hadAlpha = Boolean(metadata.hasAlpha);
    const square = metadata.width === metadata.height;
    const shouldTryCheckerboardCleanup = square && !hadAlpha && (await hasBakedCheckerboardEdge(file));

    const prepared: PreparedImage = shouldTryCheckerboardCleanup
      ? await cleanCheckerboardBackground(file)
      : { buffer: await sharp(file).ensureAlpha().toBuffer(), cleaned: false };

    if (shouldTryCheckerboardCleanup && !prepared.cleaned) {
      const output = path.join(rejectedDir, `${plan.slug}${path.extname(file).toLowerCase() || ".png"}`);
      await sharp(file).png().toFile(output);
      rejected.push({
        source: path.basename(file),
        reason: "Baked checkerboard background could not be safely cleaned.",
        output: toPublicPath(output),
      });
      continue;
    }

    const categoryDir = path.join(generatedDir, plan.category);
    await mkdir(categoryDir, { recursive: true });

    const base = prepared.raw
      ? sharp(prepared.buffer, { raw: prepared.raw }).ensureAlpha()
      : sharp(prepared.buffer).ensureAlpha();
    const resizedBase = hadAlpha || shouldTryCheckerboardCleanup ? base.trim({ threshold: 8 }) : base;
    const outputs: Record<string, string> = {};

    for (const size of pngSizes) {
      const output = path.join(categoryDir, `${plan.slug}-${size}.png`);
      await resizedBase
        .clone()
        .resize(size, size, { fit: "inside", withoutEnlargement: true })
        .png()
        .toFile(output);
      outputs[`${size}.png`] = toPublicPath(output);
    }

    for (const size of webpSizes) {
      const output = path.join(categoryDir, `${plan.slug}-${size}.webp`);
      await resizedBase
        .clone()
        .resize(size, size, { fit: "inside", withoutEnlargement: true })
        .webp({ quality: 86 })
        .toFile(output);
      outputs[`${size}.webp`] = toPublicPath(output);
    }

    processed.push({
      ...plan,
      source: path.basename(file),
      sourceRelative: path.relative(rootDir, file),
      hadAlpha,
      cleanedCheckerboard: shouldTryCheckerboardCleanup,
      outputs,
    });
  }

  await writeManifest(processed);
  await writeReport(processed, rejected, files.length);

  console.log(`Prepared ${processed.length} assets from ${path.relative(rootDir, sourceDir) || "."}`);
  if (rejected.length > 0) {
    console.log(`Rejected ${rejected.length} assets with baked checkerboard backgrounds.`);
  }
}

function inferAssetPlan(file: string): AssetPlan {
  const filename = path.basename(file);
  for (const [pattern, plan] of currentBundleOverrides) {
    if (pattern.test(filename)) return plan;
  }

  const lower = filename.toLowerCase();
  const slugName = sanitizeSlug(filename.replace(path.extname(filename), ""));

  if (/(scale|true|false|mixed|claim|check|wrong)/.test(lower)) {
    return { category: "truth-scale", slug: slugName };
  }
  if (
    /(bill|lunch|school|spending|tax|military|defense|education|health|healthcare|energy|environment|infrastructure|transport|agriculture|housing|labor|immigration|public-safety|public safety)/.test(
      lower,
    )
  ) {
    return { category: "bill-types", slug: slugName };
  }
  if (/(house|senate|supreme|scotus|court|executive|branch|congress)/.test(lower)) {
    return { category: "government", slug: slugName };
  }
  if (/(dhs|cia|fbi|ice|doj|state|dod|defense|ssa|epa|nasa|cdc|irs)/.test(lower)) {
    return { category: "agencies", slug: slugName };
  }
  if (/(streak|xp|badge|progress|reward|button|vote|source|magnifier|quiz|shield|lock)/.test(lower)) {
    return { category: "ui", slug: slugName };
  }
  if (/(bear|mascot|character)/.test(lower)) {
    return { category: "mascot", slug: slugName };
  }

  return {
    category: "misc",
    slug: slugName,
    note: "Category uncertain from filename; placed in misc.",
  };
}

function sanitizeSlug(value: string) {
  const slugName = value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 70);

  return slugName || "asset";
}

async function hasBakedCheckerboardEdge(file: string) {
  const { data, info } = await sharp(file).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  const { width, height, channels } = info;
  let samples = 0;
  let lightGraySamples = 0;
  const step = Math.max(1, Math.floor(Math.min(width, height) / 80));

  function inspect(x: number, y: number) {
    const index = (y * width + x) * channels;
    const r = data[index] ?? 0;
    const g = data[index + 1] ?? 0;
    const b = data[index + 2] ?? 0;
    samples += 1;
    if (isLightNeutral(r, g, b)) lightGraySamples += 1;
  }

  for (let x = 0; x < width; x += step) {
    inspect(x, 0);
    inspect(x, height - 1);
  }
  for (let y = 0; y < height; y += step) {
    inspect(0, y);
    inspect(width - 1, y);
  }

  return samples > 0 && lightGraySamples / samples > 0.86;
}

async function cleanCheckerboardBackground(file: string) {
  const { data, info } = await sharp(file).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const { width, height, channels } = info;
  const visited = new Uint8Array(width * height);
  const queue: number[] = [];

  function pushIfBackground(x: number, y: number) {
    if (x < 0 || y < 0 || x >= width || y >= height) return;
    const position = y * width + x;
    if (visited[position]) return;
    const index = position * channels;
    if (!isBackgroundLike(data[index] ?? 0, data[index + 1] ?? 0, data[index + 2] ?? 0)) return;
    visited[position] = 1;
    queue.push(position);
  }

  for (let x = 0; x < width; x += 1) {
    pushIfBackground(x, 0);
    pushIfBackground(x, height - 1);
  }
  for (let y = 0; y < height; y += 1) {
    pushIfBackground(0, y);
    pushIfBackground(width - 1, y);
  }

  let removed = 0;
  for (let index = 0; index < queue.length; index += 1) {
    const position = queue[index]!;
    const x = position % width;
    const y = Math.floor(position / width);
    const dataIndex = position * channels;
    data[dataIndex + 3] = 0;
    removed += 1;
    pushIfBackground(x + 1, y);
    pushIfBackground(x - 1, y);
    pushIfBackground(x, y + 1);
    pushIfBackground(x, y - 1);
  }

  return {
    buffer: Buffer.from(data),
    raw: { width, height, channels: 4 as const },
    cleaned: removed / (width * height) > 0.08,
  };
}

function isLightNeutral(r: number, g: number, b: number) {
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  return max > 222 && max - min < 18;
}

function isBackgroundLike(r: number, g: number, b: number) {
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  return max > 214 && max - min < 24;
}

function toPublicPath(file: string) {
  return `/${path.relative(path.join(rootDir, "public"), file).replaceAll(path.sep, "/")}`;
}

async function writeManifest(processed: ProcessedAsset[]) {
  const registry: Record<string, Record<string, string>> = {};
  for (const [group, keys] of Object.entries(manifestSlots)) {
    registry[group] = Object.fromEntries(keys.map((key) => [key, ""]));
  }

  for (const asset of processed) {
    if (!asset.manifestGroup || !asset.manifestKey) continue;
    registry[asset.manifestGroup][asset.manifestKey] = asset.outputs["384.webp"] ?? "";
  }

  const fallback = (group: string, from: string, to: string) => {
    if (!registry[group][to]) registry[group][to] = registry[group][from] ?? "";
  };

  fallback("truthScale", "mixed", "insufficient");
  fallback("billTypes", "spending", "taxation");
  fallback("billTypes", "environment", "energy");
  fallback("billTypes", "infrastructure", "housing");
  fallback("billTypes", "defense", "publicSafety");
  fallback("billTypes", "education", "technology");
  fallback("billTypes", "schoolMeals", "other");
  fallback("government", "house", "senate");
  fallback("government", "congress", "executive");
  fallback("agencies", "dhs", "fbi");
  fallback("agencies", "dhs", "ice");
  fallback("agencies", "state", "cia");
  fallback("agencies", "state", "doj");
  fallback("agencies", "state", "dod");
  fallback("agencies", "state", "ssa");
  fallback("agencies", "dhs", "epa");
  fallback("agencies", "state", "nasa");
  fallback("agencies", "dhs", "cdc");
  fallback("agencies", "state", "irs");
  fallback("ui", "claimCheck", "source");
  fallback("ui", "claimCheck", "quiz");
  fallback("ui", "claimCheck", "privacy");
  fallback("ui", "claimCheck", "streak");
  fallback("ui", "claimCheck", "xp");
  fallback("ui", "claimCheck", "ballot");
  fallback("ui", "claimCheck", "vote");

  const content = `// Generated by scripts/prepare-assets.ts. Do not edit by hand.
export const assets = ${JSON.stringify(registry, null, 2)} as const;

export type AssetRegistry = typeof assets;
export type AssetGroup = keyof AssetRegistry;
`;

  await writeFile(manifestPath, content, "utf8");
}

async function writeReport(processed: ProcessedAsset[], rejected: RejectedAsset[], total: number) {
  const byCategory = new Map<Category, ProcessedAsset[]>();
  for (const asset of processed) {
    byCategory.set(asset.category, [...(byCategory.get(asset.category) ?? []), asset]);
  }

  const lines = [
    "# Asset Report",
    "",
    `Source folder: \`${path.relative(rootDir, sourceDir)}\``,
    `Total source images: ${total}`,
    `Accepted assets: ${processed.length}`,
    `Rejected assets: ${rejected.length}`,
    "",
    "## Accepted Assets",
    "",
  ];

  for (const category of ["truth-scale", "bill-types", "government", "agencies", "ui", "mascot", "misc"] as Category[]) {
    const assetsForCategory = byCategory.get(category) ?? [];
    lines.push(`### ${category}`, "");
    if (assetsForCategory.length === 0) {
      lines.push("- None.", "");
      continue;
    }

    for (const asset of assetsForCategory) {
      const details = [
        `source: \`${asset.source}\``,
        asset.hadAlpha ? "alpha: yes" : "alpha: no",
        asset.cleanedCheckerboard ? "checkerboard cleaned: yes" : "checkerboard cleaned: no",
        asset.manifestGroup && asset.manifestKey
          ? `manifest: \`${asset.manifestGroup}.${asset.manifestKey}\``
          : "manifest: none",
        asset.note ? `note: ${asset.note}` : "",
      ].filter(Boolean);
      lines.push(`- \`${asset.slug}\` - ${details.join("; ")}`);
    }
    lines.push("");
  }

  lines.push("## Rejected Checkerboard Assets", "");
  if (rejected.length === 0) {
    lines.push("- None. Edge-connected checkerboard backgrounds were cleaned or the files were references.");
  } else {
    for (const asset of rejected) {
      lines.push(`- \`${asset.source}\` -> \`${asset.output}\`: ${asset.reason}`);
    }
  }

  lines.push(
    "",
    "## Notes",
    "",
    "- Agency and government images are treated as custom educational symbols, not official seals or logos.",
    "- The manifest uses normalized WebP paths for app UI and keeps PNG variants available for fallback/export use.",
  );

  await writeFile(reportPath, `${lines.join("\n")}\n`, "utf8");
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
