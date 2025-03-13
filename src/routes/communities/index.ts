import { db } from "../../db";

import { OpenAPIHono } from "@hono/zod-openapi";
import { eq } from "drizzle-orm";
import { communities } from "../../db/schema";
import { createCommunity, getCommunity, updateCommunity } from "./routes";

export const communitiesRoute = new OpenAPIHono();

communitiesRoute.openapi(getCommunity, async (c) => {
  const id = c.req.param("id");
  const result = await db.select().from(communities).where(eq(communities.id, id)).limit(1);
  return c.json(result);
});

communitiesRoute.openapi(createCommunity, async (c) => {
  const body = await c.req.json();

  // Check if community exists
  const community = await db
    .select()
    .from(communities)
    .where(eq(communities.id, body.communityId))
    .limit(1);

  if (!community.length) {
    return c.json({ message: "Community not found" }, 404);
  }

  const [result] = await db.insert(communities).values(body).returning();

  return c.json(result);
});

communitiesRoute.openapi(updateCommunity, async (c) => {
  const id = c.req.param("id");
  const body = await c.req.json();

  // Check if community exists
  const community = await db.select().from(communities).where(eq(communities.id, id)).limit(1);

  if (!community.length) {
    return c.json({ message: "Community not found" }, 404);
  }

  // Only update if community exists
  const [result] = await db
    .update(communities)
    .set({
      ...body,
      updatedAt: new Date(),
    })
    .where(eq(communities.id, id))
    .returning();

  return c.json(result);
});
