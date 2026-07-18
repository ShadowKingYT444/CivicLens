import { getCongressClient } from "../lib/clients/congress-client";

async function main() {
  const client = getCongressClient();
  const congress = Number(process.env.CURRENT_CONGRESS ?? 119);
  const limit = Number(process.env.CONGRESS_FETCH_LIMIT ?? 80);
  const result = await client.listBills({ congress, limit });
  if (!result.ok) {
    console.error(`Congress ingestion unavailable: ${result.reason}`);
    process.exitCode = 1;
    return;
  }
  console.info(`Fetched ${result.data.length} bills for Congress ${congress}.`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : "Congress ingestion failed.");
  process.exitCode = 1;
});
