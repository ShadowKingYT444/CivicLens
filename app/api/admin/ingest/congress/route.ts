import { NextResponse } from "next/server";

function isAuthorized(request: Request) {
  const configured = process.env.ADMIN_TOKEN;
  if (!configured) return false;
  const header = request.headers.get("authorization") ?? "";
  const bearer = header.startsWith("Bearer ") ? header.slice("Bearer ".length) : "";
  const cookie = request.headers
    .get("cookie")
    ?.split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith("civiclens_admin="))
    ?.split("=")[1];
  return bearer === configured || cookie === configured;
}

export async function POST(request: Request) {
  if (!isAuthorized(request)) {
    return NextResponse.json(
      { error: "UNAUTHORIZED", message: "Admin token required." },
      { status: 401 }
    );
  }

  return NextResponse.json({
    ok: true,
    jobType: "ingest-congress",
    status: process.env.CONGRESS_API_KEY ? "accepted" : "demo_noop",
    message: process.env.CONGRESS_API_KEY
      ? "Congress ingestion can be run with the CLI script in live mode."
      : "Congress API key is not configured, so demo fixtures remain active.",
  });
}
