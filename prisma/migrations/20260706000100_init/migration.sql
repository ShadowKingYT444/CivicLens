CREATE EXTENSION IF NOT EXISTS vector;
CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE TABLE "ConceptCard" (
  "id" TEXT NOT NULL,
  "slug" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "hook" TEXT NOT NULL,
  "body" TEXT NOT NULL,
  "category" TEXT NOT NULL,
  "difficulty" INTEGER NOT NULL,
  "sourceIds" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "quizJson" JSONB NOT NULL,
  "orderIndex" INTEGER NOT NULL DEFAULT 0,
  "isPublished" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ConceptCard_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "SourceDocument" (
  "id" TEXT NOT NULL,
  "sourceType" TEXT NOT NULL,
  "externalId" TEXT,
  "title" TEXT NOT NULL,
  "url" TEXT NOT NULL,
  "sourceDate" TIMESTAMPTZ,
  "issuingBody" TEXT,
  "content" TEXT NOT NULL,
  "contentHash" TEXT NOT NULL,
  "metadata" JSONB NOT NULL DEFAULT '{}'::JSONB,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "SourceDocument_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "SourceChunk" (
  "id" TEXT NOT NULL,
  "sourceDocumentId" TEXT NOT NULL,
  "chunkIndex" INTEGER NOT NULL,
  "text" TEXT NOT NULL,
  "tokenCount" INTEGER,
  "metadata" JSONB NOT NULL DEFAULT '{}'::JSONB,
  "embedding" vector(1536),
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "SourceChunk_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Citation" (
  "id" TEXT NOT NULL,
  "sourceDocumentId" TEXT NOT NULL,
  "sourceChunkId" TEXT,
  "sourceType" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "url" TEXT NOT NULL,
  "sourceDate" TIMESTAMPTZ,
  "excerpt" TEXT NOT NULL,
  "billCongress" INTEGER,
  "billType" TEXT,
  "billNumber" TEXT,
  "metadata" JSONB NOT NULL DEFAULT '{}'::JSONB,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Citation_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Bill" (
  "id" TEXT NOT NULL,
  "congress" INTEGER NOT NULL,
  "type" TEXT NOT NULL,
  "number" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "shortTitle" TEXT,
  "originChamber" TEXT,
  "introducedDate" TIMESTAMPTZ,
  "latestActionDate" TIMESTAMPTZ,
  "latestActionText" TEXT,
  "policyArea" TEXT,
  "congressGovUrl" TEXT,
  "summary" TEXT,
  "rawJson" JSONB NOT NULL DEFAULT '{}'::JSONB,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Bill_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "BillAction" (
  "id" TEXT NOT NULL,
  "billId" TEXT NOT NULL,
  "actionDate" TIMESTAMPTZ NOT NULL,
  "text" TEXT NOT NULL,
  "type" TEXT,
  "chamber" TEXT,
  "sourceUrl" TEXT,
  "orderIndex" INTEGER NOT NULL DEFAULT 0,
  "rawJson" JSONB NOT NULL DEFAULT '{}'::JSONB,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "BillAction_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "BillSummary" (
  "id" TEXT NOT NULL,
  "billId" TEXT NOT NULL,
  "actionDate" TIMESTAMPTZ,
  "versionCode" TEXT,
  "text" TEXT NOT NULL,
  "sourceUrl" TEXT,
  "rawJson" JSONB NOT NULL DEFAULT '{}'::JSONB,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "BillSummary_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Member" (
  "id" TEXT NOT NULL,
  "bioguideId" TEXT NOT NULL,
  "firstName" TEXT NOT NULL,
  "lastName" TEXT NOT NULL,
  "fullName" TEXT NOT NULL,
  "party" TEXT NOT NULL,
  "state" TEXT NOT NULL,
  "district" TEXT,
  "chamber" TEXT NOT NULL,
  "currentMember" BOOLEAN NOT NULL DEFAULT true,
  "officialUrl" TEXT,
  "imageUrl" TEXT,
  "rawJson" JSONB NOT NULL DEFAULT '{}'::JSONB,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Member_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "DistrictCache" (
  "id" TEXT NOT NULL,
  "locationHash" TEXT NOT NULL,
  "stateCode" TEXT NOT NULL,
  "district" TEXT NOT NULL,
  "latitude" DECIMAL(9,6),
  "longitude" DECIMAL(9,6),
  "responseJson" JSONB NOT NULL,
  "expiresAt" TIMESTAMPTZ NOT NULL,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "DistrictCache_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Vote" (
  "id" TEXT NOT NULL,
  "congress" INTEGER NOT NULL,
  "chamber" TEXT NOT NULL,
  "session" INTEGER,
  "rollCallNumber" INTEGER NOT NULL,
  "question" TEXT NOT NULL,
  "description" TEXT,
  "result" TEXT NOT NULL,
  "date" TIMESTAMPTZ NOT NULL,
  "sourceUrl" TEXT,
  "billId" TEXT,
  "rawJson" JSONB NOT NULL DEFAULT '{}'::JSONB,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Vote_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "VotePosition" (
  "id" TEXT NOT NULL,
  "voteId" TEXT NOT NULL,
  "bioguideId" TEXT,
  "name" TEXT NOT NULL,
  "party" TEXT,
  "state" TEXT,
  "district" TEXT,
  "voteCast" TEXT NOT NULL,
  CONSTRAINT "VotePosition_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ClaimAnalysis" (
  "id" TEXT NOT NULL,
  "inputHash" TEXT NOT NULL,
  "normalizedClaimHash" TEXT,
  "evidenceStatus" TEXT NOT NULL,
  "resultJson" JSONB NOT NULL,
  "redactedInput" TEXT,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ClaimAnalysis_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "QuizAttempt" (
  "id" TEXT NOT NULL,
  "conceptCardId" TEXT,
  "quizSlug" TEXT,
  "selectedIndex" INTEGER NOT NULL,
  "correctIndex" INTEGER NOT NULL,
  "isCorrect" BOOLEAN NOT NULL,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "QuizAttempt_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "IngestionRun" (
  "id" TEXT NOT NULL,
  "source" TEXT NOT NULL,
  "status" TEXT NOT NULL,
  "startedAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "finishedAt" TIMESTAMPTZ,
  "itemCount" INTEGER NOT NULL DEFAULT 0,
  "errorMessage" TEXT,
  "metadata" JSONB NOT NULL DEFAULT '{}'::JSONB,
  CONSTRAINT "IngestionRun_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ConceptCard_slug_key" ON "ConceptCard"("slug");
CREATE INDEX "ConceptCard_category_idx" ON "ConceptCard"("category");
CREATE INDEX "ConceptCard_difficulty_idx" ON "ConceptCard"("difficulty");
CREATE INDEX "ConceptCard_isPublished_orderIndex_idx" ON "ConceptCard"("isPublished", "orderIndex");
CREATE INDEX "ConceptCard_title_body_trgm_idx" ON "ConceptCard" USING GIN ((coalesce("title", '') || ' ' || coalesce("hook", '') || ' ' || coalesce("body", '')) gin_trgm_ops);

CREATE UNIQUE INDEX "SourceDocument_externalId_key" ON "SourceDocument"("externalId");
CREATE INDEX "SourceDocument_sourceType_idx" ON "SourceDocument"("sourceType");
CREATE INDEX "SourceDocument_contentHash_idx" ON "SourceDocument"("contentHash");
CREATE INDEX "SourceDocument_title_trgm_idx" ON "SourceDocument" USING GIN ("title" gin_trgm_ops);
CREATE INDEX "SourceDocument_content_trgm_idx" ON "SourceDocument" USING GIN ("content" gin_trgm_ops);

CREATE UNIQUE INDEX "SourceChunk_sourceDocumentId_chunkIndex_key" ON "SourceChunk"("sourceDocumentId", "chunkIndex");
CREATE INDEX "SourceChunk_sourceDocumentId_idx" ON "SourceChunk"("sourceDocumentId");
CREATE INDEX "SourceChunk_text_trgm_idx" ON "SourceChunk" USING GIN ("text" gin_trgm_ops);
CREATE INDEX "SourceChunk_embedding_ivfflat_idx" ON "SourceChunk" USING ivfflat ("embedding" vector_cosine_ops) WITH (lists = 100);

CREATE INDEX "Citation_sourceDocumentId_idx" ON "Citation"("sourceDocumentId");
CREATE INDEX "Citation_sourceChunkId_idx" ON "Citation"("sourceChunkId");
CREATE INDEX "Citation_billCongress_billType_billNumber_idx" ON "Citation"("billCongress", "billType", "billNumber");

CREATE UNIQUE INDEX "Bill_congress_type_number_key" ON "Bill"("congress", "type", "number");
CREATE INDEX "Bill_policyArea_idx" ON "Bill"("policyArea");
CREATE INDEX "Bill_latestActionDate_idx" ON "Bill"("latestActionDate");
CREATE INDEX "Bill_title_trgm_idx" ON "Bill" USING GIN ("title" gin_trgm_ops);
CREATE INDEX "Bill_summary_trgm_idx" ON "Bill" USING GIN ("summary" gin_trgm_ops);

CREATE INDEX "BillAction_billId_actionDate_idx" ON "BillAction"("billId", "actionDate");
CREATE INDEX "BillSummary_billId_idx" ON "BillSummary"("billId");

CREATE UNIQUE INDEX "Member_bioguideId_key" ON "Member"("bioguideId");
CREATE INDEX "Member_state_district_idx" ON "Member"("state", "district");
CREATE INDEX "Member_chamber_idx" ON "Member"("chamber");
CREATE INDEX "Member_currentMember_idx" ON "Member"("currentMember");
CREATE INDEX "Member_fullName_trgm_idx" ON "Member" USING GIN ("fullName" gin_trgm_ops);

CREATE UNIQUE INDEX "DistrictCache_locationHash_key" ON "DistrictCache"("locationHash");
CREATE INDEX "DistrictCache_stateCode_district_idx" ON "DistrictCache"("stateCode", "district");
CREATE INDEX "DistrictCache_expiresAt_idx" ON "DistrictCache"("expiresAt");

CREATE UNIQUE INDEX "Vote_congress_chamber_session_rollCallNumber_key" ON "Vote"("congress", "chamber", "session", "rollCallNumber");
CREATE INDEX "Vote_billId_idx" ON "Vote"("billId");
CREATE INDEX "Vote_date_idx" ON "Vote"("date");
CREATE INDEX "VotePosition_voteId_idx" ON "VotePosition"("voteId");
CREATE INDEX "VotePosition_bioguideId_idx" ON "VotePosition"("bioguideId");

CREATE INDEX "ClaimAnalysis_inputHash_idx" ON "ClaimAnalysis"("inputHash");
CREATE INDEX "ClaimAnalysis_createdAt_idx" ON "ClaimAnalysis"("createdAt");
CREATE INDEX "QuizAttempt_conceptCardId_idx" ON "QuizAttempt"("conceptCardId");
CREATE INDEX "QuizAttempt_createdAt_idx" ON "QuizAttempt"("createdAt");
CREATE INDEX "IngestionRun_source_startedAt_idx" ON "IngestionRun"("source", "startedAt");

ALTER TABLE "SourceChunk" ADD CONSTRAINT "SourceChunk_sourceDocumentId_fkey" FOREIGN KEY ("sourceDocumentId") REFERENCES "SourceDocument"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Citation" ADD CONSTRAINT "Citation_sourceDocumentId_fkey" FOREIGN KEY ("sourceDocumentId") REFERENCES "SourceDocument"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Citation" ADD CONSTRAINT "Citation_sourceChunkId_fkey" FOREIGN KEY ("sourceChunkId") REFERENCES "SourceChunk"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "BillAction" ADD CONSTRAINT "BillAction_billId_fkey" FOREIGN KEY ("billId") REFERENCES "Bill"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "BillSummary" ADD CONSTRAINT "BillSummary_billId_fkey" FOREIGN KEY ("billId") REFERENCES "Bill"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Vote" ADD CONSTRAINT "Vote_billId_fkey" FOREIGN KEY ("billId") REFERENCES "Bill"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "VotePosition" ADD CONSTRAINT "VotePosition_voteId_fkey" FOREIGN KEY ("voteId") REFERENCES "Vote"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "QuizAttempt" ADD CONSTRAINT "QuizAttempt_conceptCardId_fkey" FOREIGN KEY ("conceptCardId") REFERENCES "ConceptCard"("id") ON DELETE SET NULL ON UPDATE CASCADE;
