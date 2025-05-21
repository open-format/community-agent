import { vectorStore } from "@/agent/stores";
import { db } from "@/db";
import { communities, community_roles, platformConnections } from "@/db/schema";
import { generateVerificationCode, storeVerificationCode } from "@/lib/verification";
import { createErrorResponse, createSuccessResponse } from "@/utils/api";
import { withPagination } from "@/utils/pagination";
import { OpenAPIHono } from "@hono/zod-openapi";
import { asc, eq } from "drizzle-orm";
import { isAddress } from "viem";
import {
  createCommunity,
  generateCode,
  getCommunities,
  getCommunity,
  updateCommunity,
} from "./routes";
const communitiesRoute = new OpenAPIHono();

communitiesRoute.openapi(getCommunity, async (c) => {
  const id = c.req.param("id");

  // First try to get the community by ID, but only if id is a valid UUID
  let community = null;
  if (isUuid(id)) {
    [community] = await db.select().from(communities).where(eq(communities.id, id)).limit(1);
  }

  // If not found by ID, try to find by platform ID through platform connections
  if (!community) {
    const [platformConnection] = await db
      .select()
      .from(platformConnections)
      .where(eq(platformConnections.platformId, id))
      .limit(1);

    if (platformConnection?.communityId) {
      [community] = await db
        .select()
        .from(communities)
        .where(eq(communities.id, platformConnection.communityId))
        .limit(1);
    }
  }

  // If no community found, return 404
  if (!community) {
    return c.json({ message: "Community not found" }, 404);
  }

  // Then get all platform connections for this community
  const connections = await db
    .select()
    .from(platformConnections)
    .where(eq(platformConnections.communityId, community.id));

  // Get all count of pending rewards for this community
  const [{ count: pendingRewards }] = await db
    .select({ count: count() })
    .from(pendingRewardsSchema)
    .where(
      and(
        eq(pendingRewardsSchema.community_id, community.id),
        eq(pendingRewardsSchema.status, "pending"),
      ),
    );

  // Get all tiers for this community
  const communityTiers = await db
    .select()
    .from(tiers)
    .where(eq(tiers.communityId, community.id))
    .orderBy(asc(tiers.pointsRequired));

  const snapshot = await vectorStore.query({
    indexName: "impact_reports",
    queryVector: new Array(1536).fill(0),
    topK: 1000,
    includeMetadata: true,
    filter: {
      platformId: connections[0]?.platformId,
    },
  });

  const sortedResults = snapshot.sort((a, b) => b.metadata.timestamp - a.metadata.timestamp);

  let onchainData = null;

  if (community.communityContractAddress && community.communityContractChainId) {
    try {
      // Get onchain data from subgraph
      onchainData = await getCommunitySubgraphData(
        community.communityContractAddress as Address,
        community.communityContractChainId,
      );
    } catch (error) {
      // Pass through the subgraph error with a 500 status code
      return c.json(
        createErrorResponse(
          error instanceof Error ? error.message : "Failed to fetch onchain data",
          "500",
        ),
      );
    }
  }

  // Combine the results
  const result = {
    ...community,
    platformConnections: connections,
    recommendations: pendingRewards,
    onchainData: onchainData,
    snapshot: sortedResults[0],
    tiers: communityTiers,
  };

  return c.json(result);
});

communitiesRoute.openapi(getCommunities, async (c) => {
  try {
    const { page = 1, limit = 2 } = c.req.query();
    const query = db.select().from(communities).orderBy(asc(communities.id));
    const result = await withPagination(query, communities, {
      page,
      limit,
    });

    return c.json(
      createSuccessResponse(result.data, {
        page: result.page,
        limit: result.limit,
        total: result.total,
        totalPages: result.totalPages,
      }),
    );
  } catch (error) {
    return c.json(createErrorResponse((error as Error).message, "500"));
  }
});

communitiesRoute.openapi(createCommunity, async (c) => {
  const body = await c.req.json();

  // Check if community exists
  const [community] = await db
    .select()
    .from(communities)
    .where(eq(communities.id, body.id))
    .limit(1);

  if (community) {
    return c.json({ message: "Community already exists" }, 409);
  }

  // Create the community
  const [createdCommunity] = await db.insert(communities).values(body).returning();

  // Create the default "Admin" role
  await db.insert(community_roles).values({
    communityId: createdCommunity.id,
    name: "Admin",
    description: "Community administrator",
  });

  return c.json(createdCommunity);
});

communitiesRoute.openapi(updateCommunity, async (c) => {
  const body = await c.req.json();
  const communityId = c.req.param("id");

  // First find the community by either UUID or contract address
  const [existingCommunity] = await db
    .select()
    .from(communities)
    .where(
      isAddress(communityId)
        ? eq(communities.communityContractAddress, communityId)
        : eq(communities.id, communityId),
    )
    .limit(1);

  if (!existingCommunity) {
    return c.json({ message: "Community not found" }, 404);
  }

  // Update the community using its primary key (id)
  const [result] = await db
    .update(communities)
    .set({
      ...body,
      updatedAt: new Date(),
    })
    .where(eq(communities.id, existingCommunity.id))
    .returning();

  return c.json(result);
});

communitiesRoute.openapi(generateCode, async (c) => {
  try {
    const body = await c.req.json();
    const { community_id } = body;

    // Check if community exists
    const [community] = await db
      .select()
      .from(communities)
      .where(eq(communities.id, community_id))
      .limit(1);

    // If community doesn't exist, create it
    if (!community) {
      return c.json({ message: "Community not found" }, 404);
    }

    const code = generateVerificationCode();
    await storeVerificationCode(code, community_id);

    return c.json(
      {
        success: true,
        code,
        expiresIn: "10 minutes",
      },
      200,
    );
  } catch (error) {
    console.error(error);
    return c.json({ message: "Failed to generate code" }, 500);
  }
});

export default communitiesRoute;
