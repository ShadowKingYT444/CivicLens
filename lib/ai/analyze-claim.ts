import { generateAnalysis } from "./llm-client";
import { retrieveGroundedSources } from "../civic/source-grounder";
import { looksLikeAddress, redactSensitiveText } from "./validators";
import type { AnalyzeClaimResult, RelatedBillRef } from "../types";

export async function analyzeClaim(claim: string): Promise<AnalyzeClaimResult> {
  const redactedRetrievalQuery = redactSensitiveText(claim);
  const safeRetrievalQuery = looksLikeAddress(redactedRetrievalQuery)
    ? "[redacted address]"
    : redactedRetrievalQuery;
  const grounded = await retrieveGroundedSources(safeRetrievalQuery);
  const generated = await generateAnalysis({
    claim,
    citations: grounded.citations,
    validationErrors: grounded.validationErrors,
  });
  const relatedBills = grounded.citations
    .map((citation) => citation.bill)
    .filter((bill): bill is RelatedBillRef => Boolean(bill))
    .filter(
      (bill, index, bills) =>
        bills.findIndex(
          (candidate) => JSON.stringify(candidate) === JSON.stringify(bill),
        ) === index,
    );
  const retrievalWarnings = grounded.warnings ?? [];
  const identityContext = retrievalWarnings.filter((warning) => warning.includes("Bill numbers restart"));
  return {
    result: identityContext.length > 0
      ? { ...generated.result, keyContext: [...identityContext, ...generated.result.keyContext].slice(0, 6) }
      : generated.result,
    citations: grounded.citations,
    relatedBills,
    mode: generated.mode,
    sourceMode: grounded.mode,
    warnings: [...retrievalWarnings, ...generated.warnings],
  };
}
