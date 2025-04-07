CREATE TABLE "community_questions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"community_id" text NOT NULL,
	"platform_id" text NOT NULL,
	"questions" text NOT NULL,
	"start_date" timestamp with time zone NOT NULL,
	"end_date" timestamp with time zone NOT NULL,
	"is_asked" boolean DEFAULT false,
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
ALTER TABLE "community_questions" ADD CONSTRAINT "community_questions_community_id_communities_id_fk" FOREIGN KEY ("community_id") REFERENCES "public"."communities"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "community_questions_community_idx" ON "community_questions" USING btree ("community_id");--> statement-breakpoint
CREATE INDEX "community_questions_platform_idx" ON "community_questions" USING btree ("platform_id");--> statement-breakpoint
CREATE INDEX "community_questions_is_asked_idx" ON "community_questions" USING btree ("is_asked");