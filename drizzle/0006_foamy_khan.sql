CREATE TABLE "token_details" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"community_id" text NOT NULL,
	"token_address" text NOT NULL,
	"token_name" text NOT NULL,
	"reward_condition" text NOT NULL,
	"major_contribution_amount" integer NOT NULL,
	"minor_contribution_amount" integer NOT NULL,
	"additional_context" text,
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
ALTER TABLE "token_details" ADD CONSTRAINT "token_details_community_id_communities_id_fk" FOREIGN KEY ("community_id") REFERENCES "public"."communities"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "token_details_community_idx" ON "token_details" USING btree ("community_id");--> statement-breakpoint
CREATE INDEX "token_details_token_address_idx" ON "token_details" USING btree ("token_address");