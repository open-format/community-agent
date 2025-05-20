ALTER TABLE "user_community_roles" RENAME COLUMN "user_community_id" TO "user_id";--> statement-breakpoint
ALTER TABLE "user_community_roles" DROP CONSTRAINT "user_community_roles_user_community_id_user_communities_id_fk";
--> statement-breakpoint
DROP INDEX "user_community_role_unique_idx";--> statement-breakpoint
ALTER TABLE "user_community_roles" ADD COLUMN "community_id" uuid;--> statement-breakpoint
ALTER TABLE "user_community_roles" ADD CONSTRAINT "user_community_roles_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "user_community_roles" ADD CONSTRAINT "user_community_roles_community_id_communities_id_fk" FOREIGN KEY ("community_id") REFERENCES "public"."communities"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
CREATE UNIQUE INDEX "user_community_role_unique_idx" ON "user_community_roles" USING btree ("user_id","community_id","role_id");