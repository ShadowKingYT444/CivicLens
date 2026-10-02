import { isCensusGeocoderConfigured } from "../../../lib/clients/census-client";
import { NextResponse } from "next/server";
import { isEmbeddingsConfigured } from "../../../lib/ai/embedding-client";
import { isLlmConfigured } from "../../../lib/ai/llm-client";
import { buildOfficialProviderHealth } from "../../../lib/civic/official-source-connectors";
import { getDatabaseStatus } from "../../../lib/db/prisma";

export async function GET() {
  const db = await getDatabaseStatus();

  return NextResponse.json({
    ok: true,
    mode: db === "ok" ? "live" : "demo",
    db,
    congressApiConfigured: Boolean(process.env.CONGRESS_API_KEY),
    censusGeocoderConfigured: isCensusGeocoderConfigured(),
    officialProviders: buildOfficialProviderHealth(),
    llmConfigured: isLlmConfigured(),
    embeddingsConfigured: isEmbeddingsConfigured(),
    timestamp: new Date().toISOString(),
  });
}
