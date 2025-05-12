import { vectorStore } from "@/agent/stores";
import type { ChainName } from "@/constants/chains";
import { db } from "@/db";
import {
  communities,
  pendingRewards as pendingRewardsSchema,
  platformConnections,
} from "@/db/schema";
import { generateVerificationCode, storeVerificationCode } from "@/lib/redis";
import { getCommunitySubgraphData } from "@/lib/subgraph";
import { OpenAPIHono } from "@hono/zod-openapi";
import { and, count, eq } from "drizzle-orm";
import { validate as isUuid } from "uuid";
import { type Address, isAddress } from "viem";
import { createCommunity, generateCode, getCommunity, updateCommunity } from "./routes";
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

  // Get onchain data from subgraph
  const onchainData = await getCommunitySubgraphData(
    community.communityContractAddress as Address,
    community.communityContractChain as ChainName,
  );

  // Combine the results
  const result = {
    ...community,
    platformConnections: connections,
    recommendations: pendingRewards,
    onchainData: onchainData,
    snapshot: sortedResults,
  };

  return c.json(result);
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

  const [result] = await db.insert(communities).values(body).returning();

  return c.json(result);
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
