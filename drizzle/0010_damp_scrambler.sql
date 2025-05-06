ALTER TABLE "communities" ADD COLUMN "slug" text DEFAULT '';--> statement-breakpoint
ALTER TABLE "platform_permissions" DROP COLUMN "role_name";