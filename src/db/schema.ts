import { relations, sql } from "drizzle-orm";
import {
  boolean,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uuid,
  vector,
  real,
} from "drizzle-orm/pg-core";

// Define ENUMs for event and reward types
export const EVENT_TYPES = ["connect_account", "voice_channel_join"] as const;

export const REWARD_TYPES = ["token", "badge"] as const;

export const PLATFORM_TYPES = ["discord", "github", "telegram"] as const;

export const communities = pgTable("communities", {
  id: text("id").primaryKey().notNull(),
  name: text("name").notNull(),
  description: text("description"),
  roles: jsonb("roles").default([]),
  goals: jsonb("goals").default([]),
  platforms: jsonb("platforms").default([]),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
  communityWalletId: text("community_wallet_id"),
  communityWalletAddress: text("community_wallet_address"),
});

export const summaries = pgTable("summaries", {
  id: uuid("id").default(sql`gen_random_uuid()`).primaryKey(),
  communityId: text("community_id")
    .notNull()
    .references(() => communities.id),
  summaryText: text("summary_text").notNull(),
  startDate: timestamp("start_date").notNull(),
  endDate: timestamp("end_date").notNull(),
  platformId: text("platform_id").notNull(),
  embedding: vector("embedding", { dimensions: 1536 }),
  summarizationScore: real("summarization_score"),
  coverageScore: real("coverage_score"),
  alignmentScore: real("alignment_score"),
  summarizationReason: text("summarization_reason"),
  uniqueUserCount: integer("unique_user_count"),
  messageCount: integer("message_count"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const communityDocuments = pgTable("community_documents", {
  id: uuid("id").default(sql`gen_random_uuid()`).primaryKey(),
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
  id: uuid("id").default(sql`gen_random_uuid()`).primaryKey(),
  userId: text("user_id")
    .notNull()
    .references(() => users.id),
  communityId: text("community_id")
    .notNull()
    .references(() => communities.id),
  roles: jsonb("roles").default([]),
  joinedAt: timestamp("joined_at").defaultNow(),
});

export const automations = pgTable("automations", {
  id: uuid("id").default(sql`gen_random_uuid()`).primaryKey(),
  communityId: text("community_id")
    .notNull()
    .references(() => communities.id),
  eventType: text("event_type", { enum: EVENT_TYPES }).notNull(),
  rewardType: text("reward_type", { enum: REWARD_TYPES }).notNull(),
  rewardAmount: text("reward_amount"), // Optional for badge rewards, required for tokens
  rewardTokenAddress: text("reward_token_address"), // Optional, only used for token rewards
  requirements: jsonb("requirements").default([]),
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
});

export const platformConnections = pgTable(
  "platform_connections",
  {
    id: uuid("id").default(sql`gen_random_uuid()`).primaryKey(),
    communityId: text("community_id")
      .notNull()
      .references(() => communities.id),
    platformId: text("platform_id").notNull(),
    platformType: text("platform_type", { enum: PLATFORM_TYPES }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
  },
  (table) => [index("platform_idx").on(table.platformId, table.platformType)],
);

// Then define the relations
export const communitiesRelations = relations(communities, ({ many }) => ({
  platformConnections: many(platformConnections),
  summaries: many(summaries),
}));

export const platformConnectionsRelations = relations(platformConnections, ({ one }) => ({
  community: one(communities, {
    fields: [platformConnections.communityId],
    references: [communities.id],
  }),
}));

export const summariesRelations = relations(summaries, ({ one }) => ({
  community: one(communities, {
    fields: [summaries.communityId],
    references: [communities.id],
  }),
}));

export type Automation = typeof automations.$inferSelect;
