ALTER TABLE "automations" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "community_members" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
DROP TABLE "automations" CASCADE;--> statement-breakpoint
DROP TABLE "community_members" CASCADE;--> statement-breakpoint

-- First drop the foreign key constraints
ALTER TABLE "platform_connections" DROP CONSTRAINT IF EXISTS "platform_connections_community_id_communities_id_fk";
ALTER TABLE "pending_rewards" DROP CONSTRAINT IF EXISTS "pending_rewards_community_id_communities_id_fk";

-- Then convert the columns to UUID
ALTER TABLE "communities" ALTER COLUMN "id" SET DATA TYPE uuid USING id::uuid;
ALTER TABLE "communities" ALTER COLUMN "id" SET DEFAULT gen_random_uuid();
ALTER TABLE "platform_connections" ALTER COLUMN "community_id" SET DATA TYPE uuid USING community_id::uuid;
ALTER TABLE "pending_rewards" ALTER COLUMN "community_id" SET DATA TYPE uuid USING community_id::uuid;

-- Finally re-add the foreign key constraints
ALTER TABLE "platform_connections" ADD CONSTRAINT "platform_connections_community_id_communities_id_fk" 
    FOREIGN KEY ("community_id") REFERENCES "communities"("id");
ALTER TABLE "pending_rewards" ADD CONSTRAINT "pending_rewards_community_id_communities_id_fk" 
    FOREIGN KEY ("community_id") REFERENCES "communities"("id");