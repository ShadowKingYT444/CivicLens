import { existsSync } from "node:fs";
import { mkdir } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";

type LearningAsset = {
  match: RegExp;
  slug: string;
  kind: "logo" | "icon";
};

type PreparedImage = {
  buffer: Buffer;
  raw?: {
    width: number;
    height: number;
    channels: 4;
  };
};

const rootDir = process.cwd();
const sourceDir = path.join(rootDir, "assets", "learning_path");
const outputDir = path.join(rootDir, "public", "assets", "learning-path");

const learningAssets: LearningAsset[] = [
  { match: /\(1\)\.png$/i, slug: "logo", kind: "logo" },
  { match: /\(2\)\.png$/i, slug: "capitol-platform", kind: "icon" },
  { match: /\(3\)\.png$/i, slug: "capitol-path", kind: "icon" },
  { match: /\(4\)\.png$/i, slug: "star-coin", kind: "icon" },
  { match: /\(5\)\.png$/i, slug: "check-coin", kind: "icon" },
  { match: /\(6\)\.png$/i, slug: "treasure-chest", kind: "icon" },
];

async function main() {
  if (!existsSync(sourceDir)) {
    throw new Error(`Missing learning path assets at ${sourceDir}`);
  }

  await mkdir(outputDir, { recursive: true });

  for (const asset of learningAssets) {
    const source = await findSource(asset);
    const prepared = asset.kind === "icon" ? await cleanEdgeCheckerboard(source) : await keepLogo(source);
    const base = prepared.raw
      ? sharp(prepared.buffer, { raw: prepared.raw }).ensureAlpha()
      : sharp(prepared.buffer).ensureAlpha();

    if (asset.kind === "logo") {
      await base.clone().resize({ width: 384, withoutEnlargement: true }).webp({ quality: 88 }).toFile(
        path.join(outputDir, `${asset.slug}-384.webp`),
      );
      await base.clone().resize({ width: 512, withoutEnlargement: true }).png().toFile(
        path.join(outputDir, `${asset.slug}-512.png`),
      );
      await base.clone().resize({ width: 768, withoutEnlargement: true }).webp({ quality: 88 }).toFile(
        path.join(outputDir, `${asset.slug}-768.webp`),
      );
      continue;
    }

    const trimmed = base.trim({ threshold: 8 });
    await trimmed.clone().resize(384, 384, { fit: "inside", withoutEnlargement: true }).webp({ quality: 88 }).toFile(
      path.join(outputDir, `${asset.slug}-384.webp`),
    );
    await trimmed.clone().resize(512, 512, { fit: "inside", withoutEnlargement: true }).png().toFile(
      path.join(outputDir, `${asset.slug}-512.png`),
    );
    await trimmed.clone().resize(768, 768, { fit: "inside", withoutEnlargement: true }).webp({ quality: 88 }).toFile(
      path.join(outputDir, `${asset.slug}-768.webp`),
    );
  }

  console.log(`Prepared ${learningAssets.length} learning path assets.`);
}

async function findSource(asset: LearningAsset) {
  const { readdir } = await import("node:fs/promises");
  const files = await readdir(sourceDir);
  const source = files.find((file) => asset.match.test(file));
  if (!source) throw new Error(`Could not find source asset for ${asset.slug}`);
  return path.join(sourceDir, source);
}

async function keepLogo(file: string): Promise<PreparedImage> {
  return { buffer: await sharp(file).ensureAlpha().toBuffer() };
}

async function cleanEdgeCheckerboard(file: string): Promise<PreparedImage> {
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

  for (let index = 0; index < queue.length; index += 1) {
    const position = queue[index]!;
    const x = position % width;
    const y = Math.floor(position / width);
    const dataIndex = position * channels;
    data[dataIndex + 3] = 0;
    pushIfBackground(x + 1, y);
    pushIfBackground(x - 1, y);
    pushIfBackground(x, y + 1);
    pushIfBackground(x, y - 1);
  }

  return {
    buffer: Buffer.from(data),
    raw: { width, height, channels: 4 },
  };
}

function isBackgroundLike(r: number, g: number, b: number) {
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  return max > 214 && max - min < 24;
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
