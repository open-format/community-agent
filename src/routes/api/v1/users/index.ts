import { db } from "@/db";
import { users } from "@/db/schema";
import { OpenAPIHono } from "@hono/zod-openapi";
import { eq } from "drizzle-orm";
import { getUser, createUser, updateUser, deleteUser } from "./routes";

const usersRoute = new OpenAPIHono();

// Get a User
usersRoute.openapi(getUser, async (c) => {
  const did = c.req.param("did");

  // First get the user by Privy DID
  const [user] = await db
    .select()
    .from(users)
    .where(eq(users.did, did))
    .limit(1);

  // If no user found, return 404
  if (!user) {
    return c.json({message: "User not found"}, 404);
  }

  return c.json(user);
});

// Create a User
usersRoute.openapi(createUser, async (c) => {
  const body = await c.req.json();

  // Check if users exists using Privy DID
  const [community] = await db
    .select()
    .from(users)
    .where(eq(users.did, body.did))
    .limit(1);

  if (community) {
    return c.json({message: "User already exists"}, 409);
  }

  const [result] = await db.insert(users).values(body).returning();

  return c.json(result);
});

// Update a User
usersRoute.openapi(updateUser, async (c) => {
  const body = await c.req.json();
  const userDid = c.req.param("did");

  // First find the user by Privy DID
  const [existingUser] = await db
    .select()
    .from(users)
    .where(eq(users.did, userDid))
    .limit(1);

  if (!existingUser) {
    return c.json({message: "User not found"}, 404);
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
  const [user] = await db
    .select()
    .from(users)
    .where(eq(users.did, did))
    .limit(1);

  // If no user found, return 404
  if (!user) {
    return c.json({message: "User not found"}, 404);
  }

  await db.delete(users).where(eq(users.did, did));

  return c.body(null, 204);
});

export default usersRoute;