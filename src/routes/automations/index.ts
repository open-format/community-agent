import { db } from "../../db";
import { automations } from "../../db/schema";
import { eq } from "drizzle-orm";
import { OpenAPIHono } from "@hono/zod-openapi";
import { getAutomations, createAutomation, updateAutomation, deleteAutomation } from "./routes";
import { communities } from "../../db/schema";

export const automationsRoute = new OpenAPIHono();

automationsRoute.openapi(getAutomations, async (c) => {
  const result = await db.select().from(automations);
  return c.json(result);
});

automationsRoute.openapi(createAutomation, async (c) => {
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

  await db.insert(automations).values(body);
  const [result] = await db
    .select()
    .from(automations)
    .where(eq(automations.communityId, body.communityId))
    .limit(1);
  return c.json(result);
});

automationsRoute.openapi(updateAutomation, async (c) => {
  const id = c.req.param("id");
  const body = await c.req.json();
  await db.update(automations).set(body).where(eq(automations.id, id));
  const [result] = await db.select().from(automations).where(eq(automations.id, id)).limit(1);
  return c.json(result);
});

automationsRoute.openapi(deleteAutomation, async (c) => {
  const id = c.req.param("id");
  await db.delete(automations).where(eq(automations.id, id));
  return c.json({ success: true });
});
