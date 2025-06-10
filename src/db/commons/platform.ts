import { vectorStore } from "@/agent/stores";
import { db } from "@/db";
import { platformConnections } from "@/db/schema";
import { and, eq } from "drizzle-orm";

export async function findPlatformConnection(
  platformId: string,
  platformType: "discord" | "github" | "telegram",
) {
  return await db.query.platformConnections.findFirst({
    where: (connections, { eq }) =>
      and(eq(connections.platformId, platformId), eq(connections.platformType, platformType)),
  });
}

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
  }

  // find all messages in the database and delete them
  const query = {
    indexName: "community_messages",
    queryVector: new Array(1536).fill(0),
    topK: 10000,
    filter: {
      platformId: platformId,
    },
  };
  let exists = await vectorStore.query(query);

  while (exists && exists.length > 0) {
    for (const msg of exists) {
      await vectorStore.deleteIndexById("community_messages", msg.id);
    }

    exists = await vectorStore.query(query);
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

  try {
    if (platformConnection) {
      // Update if the connection exists and name is different or null/undefined
      if (platformConnection.platformName !== platformName || !platformConnection.platformName) {
        return await db
          .update(platformConnections)
          .set({ platformName: platformName })
          .where(eq(platformConnections.platformId, platformId))
          .returning();
      }
    } else {
      // Create new platform connection with no community
      return await db
        .insert(platformConnections)
        .values({
          platformId: platformId,
          platformType: platformType,
          platformName: platformName,
        })
        .returning();
    }
  } catch (error) {
    console.error(`Failed to setup Platform: ${platformName}:`, error);
  }
}
