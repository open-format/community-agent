CREATE TABLE "pending_rewards" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"community_id" text NOT NULL,
	"contributor_name" text NOT NULL,
	"wallet_address" text NOT NULL,
	"platform" text NOT NULL,
	"reward_id" text NOT NULL,
	"points" integer NOT NULL,
	"metadata_uri" text NOT NULL,
	"status" text DEFAULT 'pending',
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now(),
	"processed_at" timestamp with time zone,
	"error" text
);
--> statement-breakpoint
ALTER TABLE "pending_rewards" ADD CONSTRAINT "pending_rewards_community_id_communities_id_fk" FOREIGN KEY ("community_id") REFERENCES "public"."communities"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "pending_rewards_community_idx" ON "pending_rewards" USING btree ("community_id");--> statement-breakpoint
CREATE INDEX "pending_rewards_status_idx" ON "pending_rewards" USING btree ("status");