import { describe, expect, it } from "vitest";
import {
  buildOfficialProviderHealth,
  buildOfficialSourceCandidates,
  listConfiguredOfficialProviders,
  resolveOfficialSourceCandidates,
} from "@/lib/civic/official-source-connectors";

const allProviderEnv = {
  GOVINFO_API_KEY: "govinfo-key",
  FEDERAL_REGISTER_API_BASE: "https://www.federalregister.gov/api/v1",
  REGULATIONS_API_KEY: "regulations-key",
  ECFR_API_BASE: "https://www.ecfr.gov/api",
  NARA_CATALOG_API_BASE: "https://catalog.archives.gov/api/v2",
  COURTLISTENER_API_BASE: "https://www.courtlistener.com/api/rest/v4",
  USASPENDING_API_BASE: "https://api.usaspending.gov",
  OPENFEC_API_KEY: "fec-key",
  WHITEHOUSE_BASE: "https://www.whitehouse.gov",
};

describe("official source connectors", () => {
  it("detects configured official provider families without live network", () => {
    expect(listConfiguredOfficialProviders(allProviderEnv)).toEqual([
      "govinfo",
      "federal-register",
      "regulations",
      "ecfr",
      "nara",
      "courtlistener",
      "usaspending",
      "openfec",
      "whitehouse",
    ]);

    expect(buildOfficialProviderHealth(allProviderEnv)).toMatchObject({
      govinfo: true,
      "federal-register": true,
      regulations: true,
      ecfr: true,
      nara: true,
      courtlistener: true,
      usaspending: true,
      openfec: true,
      whitehouse: true,
    });
  });

  it("returns no configured-provider candidates when no official endpoint env exists", () => {
    expect(buildOfficialSourceCandidates("campaign finance contribution reports", 5, {})).toEqual([]);
  });

  it("maps regulatory questions to configured Federal Register, Regulations.gov, and eCFR search surfaces", () => {
    const candidates = buildOfficialSourceCandidates(
      "EPA final rule for a CFR air quality standard",
      4,
      allProviderEnv,
    );

    expect(candidates.map((candidate) => candidate.providerId)).toEqual(
      expect.arrayContaining(["federal-register", "regulations", "ecfr"]),
    );
    expect(candidates.every((candidate) => candidate.citation.url.startsWith("https://"))).toBe(true);

    const federalRegister = candidates.find((candidate) => candidate.providerId === "federal-register");
    expect(new URL(federalRegister?.citation.url ?? "").hostname).toBe("www.federalregister.gov");
    expect(new URL(federalRegister?.citation.url ?? "").searchParams.get("conditions[term]")).toBe(
      "epa final rule for a cfr air quality standard",
    );
  });

  it("maps campaign-finance questions to FEC when OpenFEC is configured", () => {
    const [candidate] = buildOfficialSourceCandidates(
      "campaign finance contribution reports",
      1,
      allProviderEnv,
    );

    expect(candidate?.providerId).toBe("openfec");
    expect(candidate?.sourceType).toBe("elections");
    expect(new URL(candidate?.citation.url ?? "").hostname).toBe("www.fec.gov");
  });

  it("keeps raw query text out of citation metadata excerpts", () => {
    const rawQuery = "Student asks from 1600 Pennsylvania Ave NW about campaign finance";
    const [candidate] = buildOfficialSourceCandidates(rawQuery, 1, allProviderEnv);
    const citationJson = JSON.stringify(candidate?.citation);

    expect(citationJson).not.toContain(rawQuery);
    expect(citationJson).not.toContain("1600 Pennsylvania");
  });

  it("parses live Federal Register responses when official live fetching is enabled", async () => {
    const fetcher = async () =>
      new Response(
        JSON.stringify({
          results: [
            {
              title: "Clean Air Rule",
              html_url: "https://www.federalregister.gov/documents/2026/01/02/clean-air-rule",
              publication_date: "2026-01-02",
              abstract: "<p>Agency final rule summary.</p>",
              document_number: "2026-001",
            },
          ],
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      );

    const [candidate] = await resolveOfficialSourceCandidates("EPA final rule", 1, {
      env: { FEDERAL_REGISTER_API_BASE: "https://www.federalregister.gov/api/v1" },
      fetcher,
    });

    expect(candidate?.live).toBe(true);
    expect(candidate?.title).toBe("Clean Air Rule");
    expect(candidate?.citation.excerpt).toBe("Agency final rule summary.");
  });

  it("does not turn empty API search results into live evidence", async () => {
    const [candidate] = await resolveOfficialSourceCandidates("EPA final rule", 1, {
      env: { FEDERAL_REGISTER_API_BASE: "https://www.federalregister.gov/api/v1" },
      fetcher: async () => Response.json({ results: [] }),
    });
    expect(candidate?.live).toBe(false);
    expect(candidate?.citation.sourceDocumentId).toBe("federal-register-configured-search");
  });

  it("falls back to a citation target when a live provider request fails", async () => {
    const fetcher = async () => new Response("nope", { status: 503 });

    const [candidate] = await resolveOfficialSourceCandidates("EPA final rule", 1, {
      env: { FEDERAL_REGISTER_API_BASE: "https://www.federalregister.gov/api/v1" },
      fetcher,
    });

    expect(candidate?.live).toBe(false);
    expect(candidate?.providerId).toBe("federal-register");
  });

  it("parses live GovInfo search responses when an API key is configured", async () => {
    const fetcher = async () =>
      new Response(
        JSON.stringify({
          results: [
            {
              title: "Public Law 118-273",
              packageId: "PLAW-118publ273",
              dateIssued: "2025-01-05",
              snippet: "Official public law text.",
            },
          ],
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      );

    const [candidate] = await resolveOfficialSourceCandidates("Public Law 118-273", 1, {
      env: { GOVINFO_API_KEY: "govinfo-key" },
      fetcher,
    });

    expect(candidate?.providerId).toBe("govinfo");
    expect(candidate?.live).toBe(true);
    expect(candidate?.citation.sourceDocumentId).toBe("PLAW-118publ273");
  });

  it("parses live OpenFEC candidate search responses when a key is configured", async () => {
    const fetcher = async () =>
      new Response(
        JSON.stringify({
          results: [
            {
              name: "Sample Candidate",
              candidate_id: "H0XX00000",
              office_full: "House",
              party_full: "Independent",
              state: "CA",
            },
          ],
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      );

    const [candidate] = await resolveOfficialSourceCandidates("campaign finance candidate reports", 1, {
      env: { OPENFEC_API_KEY: "fec-key" },
      fetcher,
    });

    expect(candidate?.providerId).toBe("openfec");
    expect(candidate?.live).toBe(true);
    expect(candidate?.citation.url).toBe("https://www.fec.gov/data/candidate/H0XX00000/");
  });

  it("parses live CourtListener search responses for judicial claims", async () => {
    const fetcher = async () =>
      new Response(
        JSON.stringify({
          results: [
            {
              id: 42,
              caseName: "Sample v. Agency",
              absolute_url: "/opinion/42/sample-v-agency/",
              dateFiled: "2026-03-04",
              snippet: "<mark>injunction</mark> opinion excerpt",
            },
          ],
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      );

    const [candidate] = await resolveOfficialSourceCandidates("court opinion injunction", 1, {
      env: { COURTLISTENER_API_BASE: "https://www.courtlistener.com/api/rest/v4" },
      fetcher,
    });

    expect(candidate?.providerId).toBe("courtlistener");
    expect(candidate?.live).toBe(true);
    expect(candidate?.citation.excerpt).toBe("injunction opinion excerpt");
  });
});
