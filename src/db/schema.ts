import { sql } from "drizzle-orm";
import { integer, jsonb, pgTable, text, timestamp, uuid, vector } from "drizzle-orm/pg-core";

export const communities = pgTable("communities", {
  id: text("id").primaryKey().notNull(),
  name: text("name").notNull(),
  description: text("description"),
  roles: jsonb("roles").default([]),
  goals: jsonb("goals").default([]),
  platforms: jsonb("platforms").default([]),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const communityDocuments = pgTable("community_documents", {
  id: uuid("id")
    .default(sql`gen_random_uuid()`)
    .primaryKey(),
  metadata: jsonb("metadata"),
  chunkContent: text("chunk_content"),
  embedding: vector("embedding", { dimensions: 1536 }),
  communityId: text("community_id")
    .notNull()
    .references(() => communities.id), // FK to communities
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const users = pgTable("users", {
  id: text("id").primaryKey(),
  nickname: text("nickname"),
  skills: jsonb("skills").default([]),
  interests: jsonb("interests").default([]),
  socialLinks: jsonb("social_links").default({}),
  availabilityHours: integer("availability_hours"),
  timezone: text("timezone"),
  preferredContributionTypes: jsonb("preferred_contribution_types").default([]), // e.g., ["coding", "design", "writing", "mentoring"]
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const communityMembers = pgTable("community_members", {
  id: uuid("id")
    .default(sql`gen_random_uuid()`)
    .primaryKey(),
  userId: text("user_id")
    .notNull()
    .references(() => users.id),
  communityId: text("community_id")
    .notNull()
    .references(() => communities.id),
  roles: jsonb("roles").default([]),
  joinedAt: timestamp("joined_at").defaultNow(),
});
