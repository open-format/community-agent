-- Add message and user count columns to summaries table
ALTER TABLE "summaries" 
ADD COLUMN IF NOT EXISTS "message_count" integer,
ADD COLUMN IF NOT EXISTS "unique_user_count" integer; 