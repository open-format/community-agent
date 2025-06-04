import { vectorStore } from "@/agent/stores";
import { db } from "@/db";
import {
  communities,
  community_roles,
  pendingRewards as pendingRewardsSchema,
  platformConnections,
  tiers,
  user_community_roles,
  users,
} from "@/db/schema";
import { getCommunitySubgraphData } from "@/lib/subgraph";
import { generateVerificationCode, storeVerificationCode } from "@/lib/verification";
import { createErrorResponse, createSuccessResponse } from "@/utils/api";
import { withPagination } from "@/utils/pagination";
import { OpenAPIHono } from "@hono/zod-openapi";
import { and, asc, count, eq, inArray, or } from "drizzle-orm";
import { validate as isUuid } from "uuid";
import { type Address, isAddress } from "viem";
import {
  updatePlatformConnection,
} from "./routes";
const platformConnectionsRoute = new OpenAPIHono();



platformConnectionsRoute.openapi(updatePlatformConnection, async (c) => {
  const body = await c.req.json();
  const platformId = c.req.param("id");

  // First find the community by either UUID or contract address
  const [existingPlatformConnection] = await db
    .select()
    .from(platformConnections)
    .where(isUuid(platformId) ? eq(platformConnections.id, platformId) : eq(platformConnections.platformId, platformId))
    .limit(1);

  if (!existingPlatformConnection) {
    return c.json({ message: "Platform connection not found" }, 404);
  }

  // Update the community using its primary key (id)
  const [result] = await db
    .update(platformConnections)
    .set({
      ...body,
      updatedAt: new Date(),
    })
    .where(eq(platformConnections.id, existingPlatformConnection.id))
    .returning();

  return c.json(result);
});



export default platformConnectionsRoute;
