import { db } from "@/db";
import { and, eq } from "drizzle-orm";
import { communities, platformConnections } from "@/db/schema";
import { vectorStore } from "@/agent/stores";

export async function deletePlatformConnection(platformId: string, platformType: "discord" | "github" | "telegram") {
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
};

export async function createPlatformConnection(
    platformId: string, 
    platformName: string,
    platformType: "discord" | "github" | "telegram"
) {
    // Check if platform connection already exists
    const existingConnection = await db.query.platformConnections.findFirst({
        where: (connections, { eq }) =>
            and(eq(connections.platformId, platformId), eq(connections.platformType, platformType)),
    });

    try {
        if (existingConnection) {
            // Update if the connection exists and name is different or null/undefined
            if (existingConnection.platformName !== platformName || !existingConnection.platformName) {
                await db
                    .update(platformConnections)
                    .set({ platformName: platformName })
                    .where(eq(platformConnections.platformId, platformId));
                console.log(`Updated platform name for ${platformName}`);
            }

            // Create community if none exists
            if (!existingConnection.communityId) {
                const [newCommunity] = await db
                    .insert(communities)
                    .values({
                        name: platformName,
                    })
                    .returning();

                await db
                    .update(platformConnections)
                    .set({ communityId: newCommunity.id })
                    .where(eq(platformConnections.platformId, platformId));

                console.log(
                    `Created new community for ${platformName} and linked it to the platform connection`,
                );
            }
        } else {
            // Create new community
            const [newCommunity] = await db
                .insert(communities)
                .values({
                    name: platformName,
                })
                .returning();

            // Create new platform connection linked to the community
            await db.insert(platformConnections).values({
                communityId:    newCommunity.id, // Link to community immediately
                platformId:     platformId,
                platformType:   platformType,
                platformName:   platformName,
            });

            console.log(`Created new platform connection and community for ${platformName}`);
        }
    } catch (error) {
        console.error(`Failed to setup Platform: ${platformName}:`, error);
    }
}