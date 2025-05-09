import { relations, sql } from "drizzle-orm";
import { index, integer, jsonb, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";

// Define ENUMs for event and reward types
export const EVENT_TYPES = ["connect_account", "voice_channel_join"] as const;

export const REWARD_TYPES = ["token", "badge"] as const;

export const PLATFORM_TYPES = ["discord", "github", "telegram"] as const;

export const communities = pgTable("communities", {
  id: uuid("id").default(sql`gen_random_uuid()`).primaryKey(),
  name: text("name"),
  description: text("description"),
  roles: jsonb("roles").default([]),
  goals: jsonb("goals").default([]),
  platforms: jsonb("platforms").default([]),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
  communityContractAddress: text("community_contract_address"),
  communityContractChain: text("community_contract_chain"),
  communityWalletId: text("community_wallet_id"),
  communityWalletAddress: text("community_wallet_address"),
  slug: text("slug").default(""),
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

export const platformConnections = pgTable(
  "platform_connections",
  {
    id: uuid("id").default(sql`gen_random_uuid()`).primaryKey(),
    communityId: uuid("community_id").references(() => communities.id, {
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

export const platformPermissions = pgTable(
  "platform_permissions",
  {
    id: uuid("id").default(sql`gen_random_uuid()`).primaryKey(),
    platformConnectionId: uuid("platform_connection_id")
      .notNull()
      .references(() => platformConnections.id, {
        onDelete: "cascade",
        onUpdate: "cascade",
      }),
    roleId: text("role_id").notNull(), // Discord role ID
    command: text("command").notNull(),
    // Token permission fields
    tokenAddress: text("token_address").notNull(), // The address of the ERC20 token
    maxAmount: text("max_amount"), // Maximum amount this role can send (null means unlimited)
    dailyLimit: text("daily_limit"), // Daily limit for this role
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
  },
  (table) => [
    // Index for quick lookups by platform connection, role, and token
    index("platform_permissions_lookup_idx").on(
      table.platformConnectionId,
      table.roleId,
      table.tokenAddress,
    ),
  ],
);

export const pendingRewards = pgTable(
  "pending_rewards",
  {
    id: uuid("id").default(sql`gen_random_uuid()`).primaryKey(),
    community_id: uuid("community_id")
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
  ],
);

// Then define the relations
export const communitiesRelations = relations(communities, ({ many }) => ({
  platformConnections: many(platformConnections),
}));

export const platformConnectionsRelations = relations(platformConnections, ({ one, many }) => ({
  community: one(communities, {
    fields: [platformConnections.communityId],
    references: [communities.id],
  }),
  permissions: many(platformPermissions),
}));

export const platformPermissionsRelations = relations(platformPermissions, ({ one }) => ({
  platformConnection: one(platformConnections, {
    fields: [platformPermissions.platformConnectionId],
    references: [platformConnections.id],
  }),
}));

export const pendingRewardsRelations = relations(pendingRewards, ({ one }) => ({
  community: one(communities, {
    fields: [pendingRewards.community_id],
    references: [communities.id],
  }),
}));
