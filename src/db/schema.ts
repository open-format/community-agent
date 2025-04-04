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
} from "drizzle-orm/pg-core";

// Define ENUMs for event and reward types
export const EVENT_TYPES = ["connect_account", "voice_channel_join"] as const;

export const REWARD_TYPES = ["token", "badge"] as const;

export const PLATFORM_TYPES = ["discord", "github", "telegram"] as const;

export const communities = pgTable("communities", {
  id: text("id").primaryKey().notNull(),
  name: text("name"),
  description: text("description"),
  roles: jsonb("roles").default([]),
  goals: jsonb("goals").default([]),
  platforms: jsonb("platforms").default([]),
  type: text("type"),
  stage: text("stage"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
  communityWalletId: text("community_wallet_id"),
  communityWalletAddress: text("community_wallet_address"),
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
    communityId: text("community_id").references(() => communities.id, {
      onDelete: "set null",
      onUpdate: "cascade",
    }),
    platformId: text("platform_id").notNull(),
    platformType: text("platform_type", { enum: PLATFORM_TYPES }).notNull(),
    platformName: text("platform_name"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
  },
  (table) => [index("platform_idx").on(table.platformId, table.platformType)],
);

export const pendingRewards = pgTable(
  "pending_rewards",
  {
    id: uuid("id").default(sql`gen_random_uuid()`).primaryKey(),
    community_id: text("community_id")
      .notNull()
      .references(() => communities.id),
    contributor_name: text("contributor_name").notNull(),
    wallet_address: text("wallet_address").notNull(),
    platform: text("platform", { enum: PLATFORM_TYPES }).notNull(),
    reward_id: text("reward_id").notNull(),
    points: integer("points").notNull(),
    summary: text("summary"),
    description: text("description"),
    impact: text("impact"),
    evidence: text("evidence").array(),
    reasoning: text("reasoning"),
    metadata_uri: text("metadata_uri").notNull(),
    status: text("status", { enum: ["pending", "processed", "failed"] }).default("pending"),
    created_at: timestamp("created_at", { withTimezone: true }).defaultNow(),
    updated_at: timestamp("updated_at", { withTimezone: true }).defaultNow(),
    processed_at: timestamp("processed_at", { withTimezone: true }),
    error: text("error"),
  },
  (table) => [
    index("pending_rewards_community_idx").on(table.community_id),
    index("pending_rewards_status_idx").on(table.status),
  ]
);

export const teamMembers = pgTable("team_members", {
  id: uuid("id").default(sql`gen_random_uuid()`).primaryKey(),
  community_id: text("community_id")
    .notNull()
    .references(() => communities.id),
  discord_name: text("discord_name").notNull(),
  role: text("role").notNull(),
  should_be_rewarded: boolean("should_be_rewarded").default(true),
  created_at: timestamp("created_at", { withTimezone: true }).defaultNow(),
  updated_at: timestamp("updated_at", { withTimezone: true }).defaultNow(),
}, (table) => [
  index("team_members_community_idx").on(table.community_id),
  index("team_members_discord_name_idx").on(table.discord_name),
]);

export const tokenDetails = pgTable("token_details", {
  id: uuid("id").default(sql`gen_random_uuid()`).primaryKey(),
  community_id: text("community_id")
    .notNull()
    .references(() => communities.id),
  token_address: text("token_address").notNull(),
  token_name: text("token_name").notNull(),
  reward_condition: text("reward_condition").notNull(), // e.g., "always", "only for major contributions", etc.
  major_contribution_amount: integer("major_contribution_amount").notNull(),
  minor_contribution_amount: integer("minor_contribution_amount").notNull(),
  additional_context: text("additional_context"),
  created_at: timestamp("created_at", { withTimezone: true }).defaultNow(),
  updated_at: timestamp("updated_at", { withTimezone: true }).defaultNow(),
}, (table) => [
  index("token_details_community_idx").on(table.community_id),
  index("token_details_token_address_idx").on(table.token_address),
]);

export const goodExampleRewards = pgTable("good_example_rewards", {
  id: uuid("id").default(sql`gen_random_uuid()`).primaryKey(),
  community_id: text("community_id")
    .notNull()
    .references(() => communities.id),
  contributor: text("contributor").notNull(),
  short_summary: text("short_summary").notNull(),
  comprehensive_description: text("comprehensive_description").notNull(),
  impact: text("impact").notNull(),
  evidence: text("evidence").array(),
  reward_id: text("reward_id").notNull(),
  suggested_reward: jsonb("suggested_reward").$type<{
    points: number;
    reasoning: string;
    tokenAddress: string;
  }>().notNull(),
  created_at: timestamp("created_at", { withTimezone: true }).defaultNow(),
  updated_at: timestamp("updated_at", { withTimezone: true }).defaultNow(),
}, (table) => [
  index("good_example_rewards_community_idx").on(table.community_id),
]);

export const badExampleRewards = pgTable("bad_example_rewards", {
  id: uuid("id").default(sql`gen_random_uuid()`).primaryKey(),
  community_id: text("community_id")
    .notNull()
    .references(() => communities.id),
  contributor: text("contributor").notNull(),
  short_summary: text("short_summary").notNull(),
  evidence: text("evidence").array(), // Simple array of strings describing the contribution
  why_not_reward: text("why_not_reward").notNull(), // Explanation of why this shouldn't be rewarded
  created_at: timestamp("created_at", { withTimezone: true }).defaultNow(),
  updated_at: timestamp("updated_at", { withTimezone: true }).defaultNow(),
}, (table) => [
  index("bad_example_rewards_community_idx").on(table.community_id),
]);

// Then define the relations
export const communitiesRelations = relations(communities, ({ many }) => ({
  platformConnections: many(platformConnections),
  teamMembers: many(teamMembers),
  tokenDetails: many(tokenDetails),
  goodExampleRewards: many(goodExampleRewards),
  badExampleRewards: many(badExampleRewards),
}));

export const platformConnectionsRelations = relations(platformConnections, ({ one }) => ({
  community: one(communities, {
    fields: [platformConnections.communityId],
    references: [communities.id],
  }),
}));

export const pendingRewardsRelations = relations(pendingRewards, ({ one }) => ({
  community: one(communities, {
    fields: [pendingRewards.community_id],
    references: [communities.id],
  }),
}));

export const teamMembersRelations = relations(teamMembers, ({ one }) => ({
  community: one(communities, {
    fields: [teamMembers.community_id],
    references: [communities.id],
  }),
}));

export const tokenDetailsRelations = relations(tokenDetails, ({ one }) => ({
  community: one(communities, {
    fields: [tokenDetails.community_id],
    references: [communities.id],
  }),
}));

export const goodExampleRewardsRelations = relations(goodExampleRewards, ({ one }) => ({
  community: one(communities, {
    fields: [goodExampleRewards.community_id],
    references: [communities.id],
  }),
}));

export const badExampleRewardsRelations = relations(badExampleRewards, ({ one }) => ({
  community: one(communities, {
    fields: [badExampleRewards.community_id],
    references: [communities.id],
  }),
}));

export type Automation = typeof automations.$inferSelect;
