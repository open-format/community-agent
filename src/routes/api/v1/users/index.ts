import { db } from "@/db";
import { communities, community_roles, user_community_roles, users } from "@/db/schema";
import { OpenAPIHono } from "@hono/zod-openapi";
import { and, eq } from "drizzle-orm";
import { assignRole, createUser, deleteUser, getUser, updateUser } from "./routes";

const usersRoute = new OpenAPIHono();

// Get a User
usersRoute.openapi(getUser, async (c) => {
  const did = c.req.param("did");

  // First get the user by Privy DID
  const [user] = await db.select().from(users).where(eq(users.did, did)).limit(1);

  // If no user found, return 404
  if (!user) {
    return c.json({ message: "User not found" }, 404);
  }

  return c.json(user);
});

// Create a User
usersRoute.openapi(createUser, async (c) => {
  const body = await c.req.json();

  // Check if users exists using Privy DID
  const [user] = await db.select().from(users).where(eq(users.did, body.did)).limit(1);

  if (user) {
    return c.json({ message: "User already exists" }, 409);
  }

  const [result] = await db.insert(users).values(body).returning();

  return c.json(result);
});

// Update a User
usersRoute.openapi(updateUser, async (c) => {
  const body = await c.req.json();
  const userDid = c.req.param("did");

  // First find the user by Privy DID
  const [existingUser] = await db.select().from(users).where(eq(users.did, userDid)).limit(1);

  if (!existingUser) {
    return c.json({ message: "User not found" }, 404);
  }

  // Check if community exists
  const [existingCommunity] = await db
    .select()
    .from(communities)
    .where(eq(communities.id, body.communityId))
    .limit(1);

  if (!existingCommunity) {
    return c.json({ message: "Bad request" }, 400);
  }

  // Update the user using its Privy DID
  const [result] = await db
    .update(users)
    .set({
      ...body,
      updatedAt: new Date(),
    })
    .where(eq(users.did, existingUser.did))
    .returning();

  return c.json(result);
});

// Delete a User
usersRoute.openapi(deleteUser, async (c) => {
  const did = c.req.param("did");

  // First get the user by Privy DID
  const [user] = await db.select().from(users).where(eq(users.did, did)).limit(1);

  // If no user found, return 404
  if (!user) {
    return c.json({ message: "User not found" }, 404);
  }

  await db.delete(users).where(eq(users.did, did));

  return c.body(null, 204);
});

usersRoute.openapi(assignRole, async (c) => {
  try {
    const body = await c.req.json();
    const { did, community_id, role_name } = body;

    // First find the user by their Privy DID
    const [user] = await db.select().from(users).where(eq(users.did, did)).limit(1);

    if (!user) {
      return c.json({ message: "User not found" }, 404);
    }

    // Find the role
    const [role] = await db
      .select()
      .from(community_roles)
      .where(
        and(eq(community_roles.communityId, community_id), eq(community_roles.name, role_name)),
      )
      .limit(1);

    if (!role) {
      return c.json({ message: "Role does not exist in this community" }, 400);
    }

    // Assign the role directly using the user's internal ID
    const [result] = await db
      .insert(user_community_roles)
      .values({
        userId: user.id,
        communityId: community_id,
        roleId: role.id,
      })
      .onConflictDoUpdate({
        target: [
          user_community_roles.userId,
          user_community_roles.communityId,
          user_community_roles.roleId,
        ],
        set: {
          updatedAt: new Date(),
        },
      })
      .returning();

    return c.json(result);
  } catch (error) {
    console.error(error);
    return c.json({ message: "Internal server error" }, 500);
  }
});

export default usersRoute;
