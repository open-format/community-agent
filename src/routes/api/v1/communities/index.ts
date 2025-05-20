import { db } from "@/db";
import {
  communities,
  community_roles,
  platformConnections,
  user_community_roles,
  users,
} from "@/db/schema";
import { generateVerificationCode, storeVerificationCode } from "@/lib/verification";
import { OpenAPIHono } from "@hono/zod-openapi";
import { and, eq, inArray } from "drizzle-orm";
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

// Register getCommunities as the GET / route (with X-User-ID header)
communitiesRoute.openapi(getCommunities, async (c) => {
  const did = c.req.header("x-user-id");
  if (!did) {
    return c.json({ message: "User not found" }, 404);
  }

  // 1. Get the user by DID
  const [user] = await db.select().from(users).where(eq(users.did, did)).limit(1);
  if (!user) {
    return c.json({ message: "User not found" }, 404);
  }

  // 2. Find all Admin roles
  const adminRoles = await db
    .select()
    .from(community_roles)
    .where(eq(community_roles.name, "Admin"));

  const adminRoleIds = adminRoles.map((r) => r.id);
  if (adminRoleIds.length === 0) {
    return c.json([], 200); // No admin roles exist
  }

  // 3. Find all user_community_roles for this user and admin roles
  const userAdminRoles = await db
    .select()
    .from(user_community_roles)
    .where(
      and(
        eq(user_community_roles.userId, user.id),
        inArray(user_community_roles.roleId, adminRoleIds),
      ),
    );
  // Filter out nulls from communityIds
  const communityIds = userAdminRoles
    .map((ucr) => ucr.communityId)
    .filter((id): id is string => !!id);
  if (communityIds.length === 0) {
    return c.json([], 200); // User is not admin in any community
  }

  // 4. Get the corresponding communities
  const adminCommunities = await db
    .select()
    .from(communities)
    .where(inArray(communities.id, communityIds));

  return c.json(adminCommunities, 200);
});

export default communitiesRoute;
