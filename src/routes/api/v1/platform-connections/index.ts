import { db } from "@/db";
import { communities, platformConnections } from "@/db/schema";
import { isUUIDv4 } from "@/utils/uuid";
import { OpenAPIHono } from "@hono/zod-openapi";
import { eq } from "drizzle-orm";
import { updatePlatformConnectionsRoute } from "./routes";

const platformConnectionsRoute = new OpenAPIHono();

platformConnectionsRoute.openapi(updatePlatformConnectionsRoute, async (c) => {
  const { communityId, platformName } = await c.req.json();
  const id = c.req.param("id");

  if (communityId) {
    const community = await db.query.communities.findFirst({
      where: eq(communities.id, communityId),
    });
    if (!community) {
      return c.json({ message: "Community not found" }, 404);
    }
  }

  let platformConnection:
    | {
        id: string;
        communityId: string | null;
        platformId: string;
        platformType: "discord" | "github" | "telegram";
        platformName: string | null;
        createdAt: Date | null;
        updatedAt: Date | null;
      }
    | undefined;

  [platformConnection] = await db
    .select()
    .from(platformConnections)
    .where(isUUIDv4(id) ? eq(platformConnections.id, id) : eq(platformConnections.platformId, id))
    .limit(1);

  if (!platformConnection) {
    return c.json({ message: "Platform connection not found" }, 404);
  }

  [platformConnection] = await db
    .update(platformConnections)
    .set({
      platformName,
      communityId,
      updatedAt: new Date(),
    })
    .where(eq(platformConnections.id, platformConnection.id))
    .returning();

  return c.json(platformConnection);
});

export default platformConnectionsRoute;
