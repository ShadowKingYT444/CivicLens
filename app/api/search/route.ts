import { NextRequest, NextResponse } from "next/server";
import { SearchQuerySchema } from "../../../lib/ai/schemas";
import {
  DEMO_BILL,
  fetchCongressBill,
  getDemoBill,
  parseBillReference,
  retrieveGroundedSources,
} from "../../../lib/civic/source-grounder";

export async function GET(request: NextRequest) {
  const parsed = SearchQuerySchema.safeParse({
    q: request.nextUrl.searchParams.get("q") || "",
  });

  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid search query" }, { status: 400 });
  }

  const query = parsed.data.q;
  const results: Array<Record<string, unknown>> = [];
  const billRef = parseBillReference(query);

  if (billRef) {
    const congress = billRef.congress || Number(process.env.CURRENT_CONGRESS ?? 119);
    const bill =
      (await fetchCongressBill(congress, billRef.type, billRef.number)) ||
      getDemoBill(congress, billRef.type, billRef.number) ||
      (!billRef.congress
        ? getDemoBill(DEMO_BILL.congress, billRef.type, billRef.number)
        : null);
    if (bill) {
      results.push({
        type: "bill",
        title: bill.title,
        href: `/bills/${bill.congress}/${bill.type}/${bill.number}`,
        url: bill.citations[0]?.url,
        congress: bill.congress,
        billType: bill.type,
        number: bill.number,
        summary: bill.summary,
        mode: bill.mode,
      });
    }
  }

  const grounded = await retrieveGroundedSources(query, 10);
  for (const document of grounded.documents) {
    if (results.length >= 10) {
      break;
    }
    if (results.some((result) => result.url === document.url || result.title === document.title)) {
      continue;
    }
    results.push({
      type: document.sourceType === "concept-card" ? "card" : "source",
      title: document.title,
      url: document.url,
      excerpt: document.excerpt,
      citation: document.citation,
    });
  }

  return NextResponse.json({
    results: results.slice(0, 10),
    mode: grounded.mode,
  });
}
