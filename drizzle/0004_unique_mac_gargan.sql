DROP TABLE "communities_wallets" CASCADE;--> statement-breakpoint
DROP TABLE "community_wallets" CASCADE;--> statement-breakpoint
ALTER TABLE "communities" ADD COLUMN "community_wallet_id" text;--> statement-breakpoint
ALTER TABLE "communities" ADD COLUMN "community_wallet_address" text;