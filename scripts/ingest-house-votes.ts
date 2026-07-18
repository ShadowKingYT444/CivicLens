import { getCongressClient } from "../lib/clients/congress-client";

async function main() {
  const client = getCongressClient();
  const congress = Number(process.env.CURRENT_CONGRESS ?? 119);
  const result = await client.listHouseVotes({ congress });
  if (!result.ok) {
    console.error(`House vote ingestion unavailable: ${result.reason}`);
    process.exitCode = 1;
    return;
  }
  console.info(`Fetched ${result.data.length} House votes for Congress ${congress}.`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : "House vote ingestion failed.");
  process.exitCode = 1;
});
