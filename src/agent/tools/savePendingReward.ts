import { createTool } from "@mastra/core";
import { z } from "zod";
import { db } from "@/db";
import { pendingRewards } from "@/db/schema";

export const savePendingRewardTool = createTool({
  id: "save-pending-reward",
  description: "Save a single reward to the pending_rewards table",
  inputSchema: z.object({
    communityId: z.string(),
    contributor: z.string().optional(),
    walletAddress: z.string(),
    platform: z.enum(["discord", "github", "telegram"]).optional(),
    rewardId: z.string(),
    points: z.number(),
    metadataUri: z.string().optional(),
  }),
  outputSchema: z.object({
    id: z.string(),
    error: z.string().optional(),
  }),
  execute: async ({ context }) => {
    try {
      const [saved] = await db.insert(pendingRewards).values({
        communityId: context.communityId,
        contributorName: context.contributor || 'unknown',
        walletAddress: context.walletAddress,
        platform: context.platform || 'discord',
        rewardId: context.rewardId,
        points: context.points,
        metadataUri: context.metadataUri || '',
      }).returning();

      return {
        id: saved.id,
      };
    } catch (error) {
      console.error(`Failed to save reward for ${context.contributor || 'unknown'}:`, error);
      return {
        id: '',
        error: `Failed to save reward: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  },
}); 