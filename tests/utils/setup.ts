// vitest.setup.ts

import { vi } from "vitest";
import { mockAdminRole, mockCommunity, mockUser, mockUserCommunityRole } from "./mockData";
import { mockPgPool, mockPgVector, mockVectorStore } from "./mockServices";

/**
 * Creates a mock database instance with test data
 * Uses PGlite for in-memory SQLite database
 */
async function dbMock() {
  // Import required modules
  const schemaModule =
    await vi.importActual<typeof import("../../src/db/schema")>("../../src/db/schema");
  const { PGlite } = await vi.importActual<{
    PGlite: typeof import("@electric-sql/pglite").PGlite;
  }>("@electric-sql/pglite");
  const { drizzle } = await vi.importActual<{
    drizzle: typeof import("drizzle-orm/pglite").drizzle;
  }>("drizzle-orm/pglite");

  // Extract schema tables
  const { communities, users, community_roles, user_community_roles, ...restTables } = schemaModule;
  const schema = { communities, users, community_roles, user_community_roles, ...restTables };

  // Initialize database
  const client = new PGlite();
  const db = drizzle(client, { schema });

  // Apply schema
  const { createRequire } = await vi.importActual<{
    createRequire: typeof import("node:module").createRequire;
  }>("node:module");
  const require = createRequire(import.meta.url);
  const { pushSchema } = require("drizzle-kit/api");
  const { apply } = await pushSchema(schema, db);
  await apply();

  // Seed test data
  await db.insert(communities).values(mockCommunity);
  await db.insert(users).values(mockUser);
  await db.insert(community_roles).values(mockAdminRole);
  await db.insert(user_community_roles).values(mockUserCommunityRole);

  return { default: db, db, communities, users, community_roles, user_community_roles };
}

// Setup mocks
vi.mock("@/db", dbMock);
vi.mock("../../src/agent/stores", () => ({ vectorStore: mockVectorStore }));
vi.mock("pg", () => ({ Pool: mockPgPool }));
vi.mock("@mastra/pg", () => ({ PgVector: mockPgVector }));
