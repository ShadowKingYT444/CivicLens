import { randomUUID } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { analyzeClaim } from "../../../lib/ai/analyze-claim";
import { AnalysisRequestSchema } from "../../../lib/ai/schemas";
import {
  projectAnalysisResultForStorage,
  redactSensitiveText,
  sha256Hex,
} from "../../../lib/ai/validators";
import { getPrisma } from "../../../lib/db/prisma";

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  const parsed = AnalysisRequestSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      {
        error: "Invalid analysis request",
        issues: parsed.error.flatten().fieldErrors,
      },
      { status: 400 },
    );
  }

  const { claim } = parsed.data;
  const analysis = await analyzeClaim(claim);
  const storage = await storeAnalysisIfEnabled(
    claim,
    analysis.result,
    analysis.citations,
  );

  return NextResponse.json({
    result: analysis.result,
    analysis: analysis.result,
    citations: analysis.citations,
    relatedBills: analysis.relatedBills,
    mode: analysis.mode,
    sourceMode: analysis.sourceMode,
    warnings: analysis.warnings,
    storage,
  });
}

async function storeAnalysisIfEnabled(
  claim: string,
  result: unknown,
  citations: unknown[],
): Promise<{
  stored: boolean;
  reason?: string;
}> {
  if (process.env.STORE_ANALYSES !== "true") {
    return { stored: false, reason: "STORE_ANALYSES is not enabled" };
  }

  const prisma = await getPrisma();
  if (!prisma?.$queryRawUnsafe) {
    return { stored: false, reason: "database unavailable" };
  }

  const claimHash = sha256Hex(claim);
  const storeRawInputs = process.env.STORE_RAW_INPUTS === "true";
  const redactedClaim = storeRawInputs ? redactSensitiveText(claim) : null;
  const resultForStorage = projectAnalysisResultForStorage(
    result,
    storeRawInputs,
  );

  try {
    const rows = await prisma.$queryRawUnsafe<Array<{ id: string }>>(
      `
      INSERT INTO "ClaimAnalysis" ("id", "inputHash", "normalizedClaimHash", "evidenceStatus", "resultJson", "redactedInput", "createdAt")
      VALUES ($1, $2, $3, $4, $5::jsonb, $6, NOW())
      RETURNING "id"
      `,
      randomUUID(),
      claimHash,
      result && typeof result === "object" && "normalizedClaim" in result && typeof result.normalizedClaim === "string" ? sha256Hex(result.normalizedClaim) : null,
      result && typeof result === "object" && "evidenceStatus" in result && typeof result.evidenceStatus === "string" ? result.evidenceStatus : "insufficient",
      JSON.stringify({ result: resultForStorage, citations: storeRawInputs ? citations : citations.map((citation) => {
        if (!citation || typeof citation !== "object") return {};
        const record = citation as Record<string, unknown>;
        return { id: record.id, sourceDocumentId: record.sourceDocumentId, sourceType: record.sourceType };
      }) }, (_key, value: unknown) => typeof value === "string" ? redactSensitiveText(value) : value),
      redactedClaim,
    );
    return rows.length > 0 ? { stored: true } : { stored: false, reason: "database write was not confirmed" };
  } catch {
    return { stored: false, reason: "database write failed" };
  }
}
