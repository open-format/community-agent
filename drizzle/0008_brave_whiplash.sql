CREATE TABLE "platform_permissions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"platform_connection_id" uuid NOT NULL,
	"role_id" text NOT NULL,
	"role_name" text NOT NULL,
	"command" text NOT NULL,
	"token_address" text NOT NULL,
	"max_amount" text,
	"daily_limit" text,
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
ALTER TABLE "platform_permissions" ADD CONSTRAINT "platform_permissions_platform_connection_id_platform_connections_id_fk" FOREIGN KEY ("platform_connection_id") REFERENCES "public"."platform_connections"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
CREATE INDEX "platform_permissions_lookup_idx" ON "platform_permissions" USING btree ("platform_connection_id","role_id","token_address");