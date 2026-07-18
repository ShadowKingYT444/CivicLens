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
    await prisma.$queryRawUnsafe(
      `
      INSERT INTO analyses (claim_hash, redacted_claim, result_json, citations_json, created_at)
      VALUES ($1, $2, $3::jsonb, $4::jsonb, NOW())
      `,
      claimHash,
      redactedClaim,
      JSON.stringify(resultForStorage),
      JSON.stringify(citations),
    );
    return { stored: true };
  } catch {
    return { stored: false, reason: "database write failed" };
  }
}
