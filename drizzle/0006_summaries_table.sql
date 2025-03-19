-- Create extension if not exists (necessary for vector type)
CREATE EXTENSION IF NOT EXISTS vector;

-- Create summaries table
CREATE TABLE "summaries" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "community_id" text NOT NULL REFERENCES "communities"("id"),
  "summary_text" text NOT NULL,
  "start_date" timestamp NOT NULL,
  "end_date" timestamp NOT NULL,
  "platform_id" text NOT NULL,
  "embedding" vector(1536),
  "summarization_score" real,
  "coverage_score" real,
  "alignment_score" real,
  "summarization_reason" text,
  "unique_user_count" integer,
  "message_count" integer,
  "created_at" timestamp DEFAULT now(),
  "updated_at" timestamp DEFAULT now()
);

-- Create indexes for better querying performance
CREATE INDEX "summaries_community_id_idx" ON "summaries" ("community_id");
CREATE INDEX "summaries_platform_id_idx" ON "summaries" ("platform_id");
CREATE INDEX "summaries_date_range_idx" ON "summaries" ("start_date", "end_date"); 