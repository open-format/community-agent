CREATE TABLE "communities_wallets" (
	"community_id" text PRIMARY KEY NOT NULL,
	"wallet_id" text,
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now(),
	CONSTRAINT "communities_wallets_wallet_id_unique" UNIQUE("wallet_id")
);
--> statement-breakpoint
ALTER TABLE "communities" DROP CONSTRAINT "communities_community_wallet_address_community_wallets_id_fk";
--> statement-breakpoint
ALTER TABLE "communities_wallets" ADD CONSTRAINT "communities_wallets_community_id_communities_id_fk" FOREIGN KEY ("community_id") REFERENCES "public"."communities"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "communities_wallets" ADD CONSTRAINT "communities_wallets_wallet_id_community_wallets_id_fk" FOREIGN KEY ("wallet_id") REFERENCES "public"."community_wallets"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "communities" DROP COLUMN "community_wallet_address";