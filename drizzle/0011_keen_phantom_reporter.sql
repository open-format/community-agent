CREATE TABLE "tiers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"community_id" uuid NOT NULL,
	"name" varchar(255) NOT NULL,
	"points_required" integer NOT NULL,
	"color" varchar(255) NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "communities" RENAME COLUMN "community_contract_chain" TO "community_contract_chain_id";--> statement-breakpoint
ALTER TABLE "communities" ALTER COLUMN "slug" SET DATA TYPE varchar(255);--> statement-breakpoint
ALTER TABLE "communities" ALTER COLUMN "slug" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "communities" ADD COLUMN "accent_color" varchar(7) DEFAULT '#6366F1' NOT NULL;--> statement-breakpoint
ALTER TABLE "communities" ADD COLUMN "token_label" varchar(255) DEFAULT 'Points' NOT NULL;--> statement-breakpoint
ALTER TABLE "communities" ADD COLUMN "user_label" varchar(255) DEFAULT 'User' NOT NULL;--> statement-breakpoint
ALTER TABLE "communities" ADD COLUMN "participant_label" varchar(255) DEFAULT 'Participant' NOT NULL;--> statement-breakpoint
ALTER TABLE "communities" ADD COLUMN "dark_mode" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "communities" ADD COLUMN "banner_url" varchar(255);--> statement-breakpoint
ALTER TABLE "communities" ADD COLUMN "token_to_display" varchar(42);--> statement-breakpoint
ALTER TABLE "communities" ADD COLUMN "show_social_handles" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "communities" ADD COLUMN "hidden_tokens" varchar(42)[] DEFAULT '{}';--> statement-breakpoint
ALTER TABLE "tiers" ADD CONSTRAINT "tiers_community_id_communities_id_fk" FOREIGN KEY ("community_id") REFERENCES "public"."communities"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "communities" ADD CONSTRAINT "communities_slug_unique" UNIQUE("slug");
ALTER TABLE "communities" ALTER COLUMN "community_contract_chain_id" TYPE integer
USING community_contract_chain_id::integer;