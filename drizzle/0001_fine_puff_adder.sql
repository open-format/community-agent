ALTER TABLE "platform_connections" DROP CONSTRAINT "platform_connections_community_id_communities_id_fk";
--> statement-breakpoint
ALTER TABLE "platform_connections" ALTER COLUMN "community_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "platform_connections" ADD CONSTRAINT "platform_connections_community_id_communities_id_fk" FOREIGN KEY ("community_id") REFERENCES "public"."communities"("id") ON DELETE set null ON UPDATE cascade;