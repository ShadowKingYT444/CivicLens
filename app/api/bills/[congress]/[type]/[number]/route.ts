import { NextResponse } from "next/server";
import { BillRouteParamsSchema } from "../../../../../../lib/ai/schemas";
import { fetchCongressBill, getDemoBill } from "../../../../../../lib/civic/source-grounder";

type RouteContext = {
  params: Promise<{ congress: string; type: string; number: string }>;
};

export async function GET(_request: Request, context: RouteContext) {
  const params = await context.params;
  const parsed = BillRouteParamsSchema.safeParse(params);

  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid bill route parameters" }, { status: 400 });
  }

  const { congress, type, number } = parsed.data;
  const bill = (await fetchCongressBill(congress, type, number)) || getDemoBill(congress, type, number);

  if (!bill) {
    return NextResponse.json(
      {
        status: "not_found",
        mode: "demo",
        message: "No live Congress.gov result or matching demo fixture was available for this bill.",
        availableDemoBill: { congress: 118, type: "hr", number: 82 },
      },
      { status: 404 },
    );
  }

  return NextResponse.json(bill);
}
