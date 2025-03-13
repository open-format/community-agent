CREATE TABLE "community_wallets" (
	"id" text PRIMARY KEY NOT NULL,
	"address" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
ALTER TABLE "communities" ADD CONSTRAINT "communities_community_wallet_address_community_wallets_id_fk" FOREIGN KEY ("community_wallet_address") REFERENCES "public"."community_wallets"("id") ON DELETE no action ON UPDATE no action;