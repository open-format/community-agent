import { db } from "@/db";
import { communities, platformConnections } from "@/db/schema";
import { OpenAPIHono } from "@hono/zod-openapi";
import { eq } from "drizzle-orm";
import { isAddress } from "viem";
import { createCommunity, generateCode, getCommunity, updateCommunity } from "./routes";
import { generateVerificationCode, storeVerificationCode } from "@/lib/verification";
const communitiesRoute = new OpenAPIHono();

communitiesRoute.openapi(getCommunity, async (c) => {
  const id = c.req.param("id");

  // First get the community by id or communityContractAddress
  const [community] = await db
    .select()
    .from(communities)
    .where(isAddress(id) ? eq(communities.communityContractAddress, id) : eq(communities.id, id))
    .limit(1);

  // If no community found, return 404
  if (!community) {
    return c.json({ message: "Community not found" }, 404);
  }

  // Then get all platform connections for this community
  const connections = await db
    .select()
    .from(platformConnections)
    .where(eq(platformConnections.communityId, community.id));

  // Combine the results
  const result = {
    ...community,
    platformConnections: connections,
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

  const [result] = await db
    .insert(communities)
    .values({ ...body, id: communityId })
    .onConflictDoUpdate({
      target: communities.id,
      set: {
        ...body,
        updatedAt: new Date(),
      },
    })
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
