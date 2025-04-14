ALTER TABLE "platform_connections" ADD COLUMN "platform_name" text;

ALTER TABLE "pending_rewards"
ADD COLUMN "summary" text,
ADD COLUMN "description" text,
ADD COLUMN "impact" text,
ADD COLUMN "evidence" text[],
ADD COLUMN "reasoning" text;