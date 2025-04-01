CREATE TABLE "team_members" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"community_id" text NOT NULL,
	"discord_name" text NOT NULL,
	"role" text NOT NULL,
	"should_be_rewarded" boolean DEFAULT true,
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
ALTER TABLE "team_members" ADD CONSTRAINT "team_members_community_id_communities_id_fk" FOREIGN KEY ("community_id") REFERENCES "public"."communities"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "team_members_community_idx" ON "team_members" USING btree ("community_id");--> statement-breakpoint
CREATE INDEX "team_members_discord_name_idx" ON "team_members" USING btree ("discord_name");