import { createTool } from "@mastra/core";
import { z } from "zod";
import { db } from "@/db";
import { pendingRewards } from "@/db/schema";

export const savePendingRewardTool = createTool({
  id: "save-pending-reward",
  description: "Save a single reward to the pending_rewards table",
  inputSchema: z.object({
    communityId: z.string(),
    contributor: z.string(),
    walletAddress: z.string(),
    platform: z.enum(["discord", "github", "telegram"]),
    rewardId: z.string(),
    points: z.number(),
    summary: z.string(),
    description: z.string(),
    impact: z.string(),
    evidence: z.array(z.object({
      channelId: z.string(),
      messageId: z.string()
    })),
    reasoning: z.string(),
    metadataUri: z.string(),
  }),
  outputSchema: z.object({
    id: z.string(),
    error: z.string().optional(),
  }),
  execute: async ({ context }) => {
    try {
      const [saved] = await db.insert(pendingRewards).values({
        community_id: context.communityId,
        contributor_name: context.contributor,
        wallet_address: context.walletAddress,
        platform: context.platform,
        reward_id: context.rewardId,
        points: context.points,
        summary: context.summary,
        description: context.description,
        impact: context.impact,
        evidence: context.evidence,
        reasoning: context.reasoning,
        metadata_uri: context.metadataUri,
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