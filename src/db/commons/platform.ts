import { vectorStore } from "@/agent/stores";
import { db } from "@/db";
import { communities, community_roles, platformConnections } from "@/db/schema";
import { and, eq } from "drizzle-orm";
import { v4 as uuidv4 } from "uuid";

export async function deletePlatformConnection(
  platformId: string,
  platformType: "discord" | "github" | "telegram",
) {
  // First, get the platform connection to find the communityId
  const platformConnection = await db.query.platformConnections.findFirst({
    where: (connections, { eq }) =>
      and(eq(connections.platformId, platformId), eq(connections.platformType, platformType)),
  });

  if (platformConnection) {
    // First delete the platform connection
    await db.delete(platformConnections).where(eq(platformConnections.platformId, platformId));

    // Then if there's an associated community, delete it
    if (platformConnection.communityId) {
      await db.delete(communities).where(eq(communities.id, platformConnection.communityId));
    }
  }

  // find all messages in the database and delete them
  const exists = await vectorStore.query({
    indexName: "community_messages",
    queryVector: new Array(1536).fill(0),
    topK: 10000,
    filter: {
      platformId: platformId,
    },
  });

  for (const msg of exists) {
    await vectorStore.deleteIndexById("community_messages", msg.id);
  }
}

export async function createPlatformConnection(
  platformId: string,
  platformName: string,
  platformType: "discord" | "github" | "telegram",
) {
  // Check if platform connection already exists
  let platformConnection = await db.query.platformConnections.findFirst({
    where: (connections, { eq }) =>
      and(eq(connections.platformId, platformId), eq(connections.platformType, platformType)),
  });

  if (!platformConnection) {
    // Only create the platform connection, do not link to a community yet
    [platformConnection] = await db.insert(platformConnections).values({
      platformId,
      platformType,
      platformName,
    }).returning();
  } else if (platformConnection.platformName !== platformName) {
    // Optionally update the name if it changed
    await db.update(platformConnections)
      .set({ platformName })
      .where(eq(platformConnections.platformId, platformId));
    platformConnection = await db.query.platformConnections.findFirst({
      where: (connections, { eq }) =>
        and(eq(connections.platformId, platformId), eq(connections.platformType, platformType)),
    });
  }

  return platformConnection;
}
