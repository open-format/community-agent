import { db } from "@/db";
import { platformConnections } from "@/db/schema";
import { OpenAPIHono } from "@hono/zod-openapi";
import { eq } from "drizzle-orm";
import { updatePlatformConnectionsRoute } from "./routes";
import { isUUIDv4 } from "@/utils/uuid";

const platformConnectionsRoute = new OpenAPIHono();

platformConnectionsRoute.openapi(updatePlatformConnectionsRoute, async (c) => {
  const { communityId, platformName } = await c.req.json();
  const id = c.req.param("id");

  let platformConnection: {
    id: string;
    communityId: string | null;
    platformId: string;
    platformType: "discord" | "github" | "telegram";
    platformName: string | null;
    createdAt: Date | null;
    updatedAt: Date | null;
  } | undefined;

  [platformConnection] = await db
    .select()
    .from(platformConnections)
    .where(
      isUUIDv4(id)
        ? eq(platformConnections.id, id)
        : eq(platformConnections.platformId, id),
    )
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
