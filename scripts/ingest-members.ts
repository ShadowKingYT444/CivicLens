import { getCongressClient } from "../lib/clients/congress-client";

async function main() {
  const client = getCongressClient();
  const congress = Number(process.env.CURRENT_CONGRESS ?? 119);
  const result = await client.listMembersByCongress({
    congress,
    limit: Number(process.env.CONGRESS_FETCH_LIMIT ?? 80),
    currentMember: true,
  });
  if (!result.ok) {
    console.error(`Member ingestion unavailable: ${result.reason}`);
    process.exitCode = 1;
    return;
  }
  console.info(`Fetched ${result.data.length} current members for Congress ${congress}.`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : "Member ingestion failed.");
  process.exitCode = 1;
});
