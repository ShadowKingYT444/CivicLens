import { createEmbedding } from "../lib/ai/embedding-client";

async function main() {
  const result = await createEmbedding("CivicLens demo source embedding check.");
  if (!result.ok) {
    console.info(`Embeddings unavailable: ${result.reason}. Lexical search remains active.`);
    return;
  }
  console.info(`Embedding provider returned ${result.embedding.length} dimensions.`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : "Embedding script failed.");
  process.exitCode = 1;
});
