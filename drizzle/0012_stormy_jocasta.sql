CREATE TABLE "community_roles" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"community_id" uuid,
	"name" varchar(100) NOT NULL,
	"description" text,
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "user_communities" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid,
	"community_id" uuid,
	"joined_at" timestamp DEFAULT now(),
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "user_community_roles" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid,
	"community_id" uuid,
	"role_id" uuid,
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
ALTER TABLE "communities" ALTER COLUMN "created_at" SET DATA TYPE timestamp with time zone;--> statement-breakpoint
ALTER TABLE "communities" ALTER COLUMN "updated_at" SET DATA TYPE timestamp with time zone;--> statement-breakpoint
ALTER TABLE "users" ALTER COLUMN "id" SET DATA TYPE uuid USING id::uuid;--> statement-breakpoint
ALTER TABLE "users" ALTER COLUMN "id" SET DEFAULT gen_random_uuid();--> statement-breakpoint
ALTER TABLE "users" ALTER COLUMN "created_at" SET DATA TYPE timestamp with time zone;--> statement-breakpoint
ALTER TABLE "users" ALTER COLUMN "updated_at" SET DATA TYPE timestamp with time zone;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "did" text NOT NULL;--> statement-breakpoint
ALTER TABLE "community_roles" ADD CONSTRAINT "community_roles_community_id_communities_id_fk" FOREIGN KEY ("community_id") REFERENCES "public"."communities"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "user_communities" ADD CONSTRAINT "user_communities_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "user_communities" ADD CONSTRAINT "user_communities_community_id_communities_id_fk" FOREIGN KEY ("community_id") REFERENCES "public"."communities"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "user_community_roles" ADD CONSTRAINT "user_community_roles_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "user_community_roles" ADD CONSTRAINT "user_community_roles_community_id_communities_id_fk" FOREIGN KEY ("community_id") REFERENCES "public"."communities"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "user_community_roles" ADD CONSTRAINT "user_community_roles_role_id_community_roles_id_fk" FOREIGN KEY ("role_id") REFERENCES "public"."community_roles"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
CREATE UNIQUE INDEX "role_community_unique_idx" ON "community_roles" USING btree ("community_id","name");--> statement-breakpoint
CREATE UNIQUE INDEX "user_community_unique_idx" ON "user_communities" USING btree ("user_id","community_id");--> statement-breakpoint
CREATE UNIQUE INDEX "user_community_role_unique_idx" ON "user_community_roles" USING btree ("user_id","community_id","role_id");--> statement-breakpoint
ALTER TABLE "communities" DROP COLUMN "roles";--> statement-breakpoint
ALTER TABLE "users" DROP COLUMN "skills";--> statement-breakpoint
ALTER TABLE "users" DROP COLUMN "interests";--> statement-breakpoint
ALTER TABLE "users" DROP COLUMN "social_links";--> statement-breakpoint
ALTER TABLE "users" DROP COLUMN "availability_hours";--> statement-breakpoint
ALTER TABLE "users" DROP COLUMN "timezone";--> statement-breakpoint
ALTER TABLE "users" DROP COLUMN "preferred_contribution_types";--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_did_unique" UNIQUE("did");