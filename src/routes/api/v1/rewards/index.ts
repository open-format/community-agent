import { db } from "@/db";
import { OpenAPIHono } from "@hono/zod-openapi";
import dayjs from "dayjs";
import { eq, sql, and } from "drizzle-orm";
import { getPendingRewards, postRewardsAnalysis, deletePendingReward } from "./routes";
import { pendingRewards } from "@/db/schema";
import { mastra } from "@/agent";


enum Errors {
  PLATFORM_NOT_FOUND = "Platform not for given community",
  COMMUNITY_NOT_FOUND = "Community not found",
}

const rewardsRoute = new OpenAPIHono();

rewardsRoute.openapi(postRewardsAnalysis, async (c) => {
  try {
    const communityId = c.get("communityId");
    if (!communityId) {
      return c.json({ message: Errors.COMMUNITY_NOT_FOUND }, 400);
    }

    const { platformId, startDate, endDate } = await c.req.json();
    
    const workflow = mastra.getWorkflow("rewardsWorkflow");
    const { start } = workflow.createRun();

    const result = await start({
      triggerData: {
        communityId,
        platformId,
        startDate: dayjs(startDate).valueOf(),
        endDate: dayjs(endDate).valueOf(),
      },
    });

    if (result.results.getWalletAddresses?.status === "success") {
      return c.json({
        rewards: result.results.getWalletAddresses.output.rewards,
        timeframe: {
          startDate,
          endDate,
        },
      });
    }

    return c.json({ message: "Failed to analyze rewards" }, 500);
  } catch (error) {
    console.error("Error analyzing rewards:", error);
    return c.json({ 
      message: "Failed to analyze rewards", 
      error: error instanceof Error ? error.message : String(error)
    }, 500);
  }
});

rewardsRoute.openapi(getPendingRewards, async (c) => {
  try {
    const communityId = c.get("communityId");
    if (!communityId) {
      return c.json({ message: Errors.COMMUNITY_NOT_FOUND }, 400);
    }

    const { status, limit = "50", offset = "0" } = c.req.query();

    // Build the query conditions
    const conditions = [eq(pendingRewards.communityId, communityId)];
    if (status) {
      conditions.push(eq(pendingRewards.status, status as "pending" | "processed" | "failed"));
    }

    // Get total count
    const [{ count }] = await db
      .select({ count: sql<number>`count(*)` })
      .from(pendingRewards)
      .where(and(...conditions));

    // Get paginated results
    const rewards = await db
      .select({
        id: pendingRewards.id,
        contributorName: pendingRewards.contributorName,
        walletAddress: pendingRewards.walletAddress,
        platform: pendingRewards.platform,
        rewardId: pendingRewards.rewardId,
        points: pendingRewards.points,
        summary: pendingRewards.summary,
        description: pendingRewards.description,
        impact: pendingRewards.impact,
        evidence: pendingRewards.evidence,
        reasoning: pendingRewards.reasoning,
        metadataUri: pendingRewards.metadataUri,
        createdAt: pendingRewards.createdAt,
      })
      .from(pendingRewards)
      .where(and(...conditions))
      .orderBy(pendingRewards.createdAt)
      .limit(Number(limit))
      .offset(Number(offset));

    return c.json({
      rewards,
      total: Number(count),
      limit,
      offset,
    });
  } catch (error) {
    console.error("Error retrieving pending rewards:", error);
    return c.json({ 
      message: "Failed to retrieve pending rewards", 
      error: error instanceof Error ? error.message : String(error)
    }, 500);
  }
});

// Add the delete pending reward endpoint
rewardsRoute.openapi(deletePendingReward, async (c) => {
  try {
    const communityId = c.get("communityId");
    if (!communityId) {
      return c.json({ message: Errors.COMMUNITY_NOT_FOUND }, 400);
    }

    const { id } = c.req.param();

    // Delete the reward, ensuring it belongs to the community
    const result = await db
      .delete(pendingRewards)
      .where(and(
        eq(pendingRewards.id, id),
        eq(pendingRewards.communityId, communityId)
      ));

    if (!result) {
      return c.json({ message: "Pending reward not found" }, 404);
    }

    return c.json({ success: true });
  } catch (error) {
    console.error("Error deleting pending reward:", error);
    return c.json({ 
      message: "Failed to delete pending reward", 
      error: error instanceof Error ? error.message : String(error)
    }, 500);
  }
});

export default rewardsRoute;
