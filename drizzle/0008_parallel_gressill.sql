CREATE TABLE "bad_example_rewards" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"community_id" text NOT NULL,
	"contributor" text NOT NULL,
	"short_summary" text NOT NULL,
	"evidence" text[],
	"why_not_reward" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "good_example_rewards" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"community_id" text NOT NULL,
	"contributor" text NOT NULL,
	"short_summary" text NOT NULL,
	"comprehensive_description" text NOT NULL,
	"impact" text NOT NULL,
	"evidence" text[],
	"reward_id" text NOT NULL,
	"suggested_reward" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
ALTER TABLE "bad_example_rewards" ADD CONSTRAINT "bad_example_rewards_community_id_communities_id_fk" FOREIGN KEY ("community_id") REFERENCES "public"."communities"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "good_example_rewards" ADD CONSTRAINT "good_example_rewards_community_id_communities_id_fk" FOREIGN KEY ("community_id") REFERENCES "public"."communities"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "bad_example_rewards_community_idx" ON "bad_example_rewards" USING btree ("community_id");--> statement-breakpoint
CREATE INDEX "good_example_rewards_community_idx" ON "good_example_rewards" USING btree ("community_id");