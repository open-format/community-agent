import { db } from "@/db";
import { communities, pendingRewards, platformConnections as platformConnectionsSchema } from "@/db/schema";
import {
  ReportStatus,
  createReportJob,
  getReportJob,
  getReportResult
} from "@/lib/redis";
import { OpenAPIHono } from "@hono/zod-openapi";
import dayjs from "dayjs";
import { and, desc, eq, sql } from "drizzle-orm";
import { isAddress } from "viem";
import {
  deletePendingReward,
  getPendingRewards,
  getRewardsAnalysisStatus,
  postRewardsAnalysis,
} from "./routes";
import { generateRewardsInBackground } from "@/services/rewards";

enum Errors {
  COMMUNITY_NOT_FOUND = "Community not found",
  PLATFORM_CONNECTIONS_NOT_FOUND = "This community has no platform connections configured. \
Please connect a platform like Discord to generate recommendations."
}

const rewardsRoute = new OpenAPIHono();

rewardsRoute.openapi(postRewardsAnalysis, async (c) => {
  try {
    const { start_date, end_date } = await c.req.json();
    const community_id = c.req.header("X-Community-ID");

    if (!community_id) {
      return c.json({ message: "Community ID is required" }, 400);
    }

    const community = await db.query.communities.findFirst({
      where: (communities, { eq }) => eq(communities.id, community_id),
      with: { platformConnections: true }
    });

    if (!community) {
      return c.json({ message: Errors.COMMUNITY_NOT_FOUND }, 404);
    }

    if (!community.platformConnections || community.platformConnections.length === 0) {
      return c.json({ message: Errors.PLATFORM_CONNECTIONS_NOT_FOUND }, 404);
    }

    const job_id = crypto.randomUUID();
    const start_timestamp = dayjs(start_date).valueOf();
    const end_timestamp = dayjs(end_date).valueOf();

    await createReportJob(job_id, undefined, community_id, start_timestamp, end_timestamp);

    generateRewardsInBackground(
      job_id, 
      community_id, 
      start_timestamp, 
      end_timestamp
    );

    return c.json({
      job_id,
      status: ReportStatus.PENDING,
      timeframe: {
        start_date,
        end_date,
      },
    });
  } catch (error) {
    console.error("Error starting rewards analysis:", error);
    return c.json(
      {
        message: "Failed to start rewards analysis",
        error: error instanceof Error ? error.message : String(error),
      },
      500,
    );
  }
});

rewardsRoute.openapi(getRewardsAnalysisStatus, async (c) => {
  try {
    const { job_id } = c.req.param();

    const job = await getReportJob(job_id);

    if (!job) {
      return c.json({
        job_id,
        status: "failed" as const,
        timeframe: {
          start_date: new Date().toISOString(),
          end_date: new Date().toISOString(),
        },
        error: "Rewards analysis job not found",
      });
    }

    let rewards_data = null;
    if (job.status === ReportStatus.COMPLETED) {
      rewards_data = await getReportResult(job_id);
    }

    return c.json({
      job_id,
      status: job.status,
      rewards: rewards_data,
      timeframe: {
        start_date: dayjs(job.startDate).toISOString(),
        end_date: dayjs(job.endDate).toISOString(),
      },
      ...(job.error ? { error: job.error } : {}),
    });
  } catch (error) {
    console.error("Error checking rewards analysis status:", error);
    return c.json({
      job_id: c.req.param("job_id"),
      status: "failed" as const,
      timeframe: {
        start_date: new Date().toISOString(),
        end_date: new Date().toISOString(),
      },
      error: String(error),
    });
  }
});

rewardsRoute.openapi(getPendingRewards, async (c) => {
  try {
    const community_id = c.req.header("X-Community-ID");
    const { status, limit = "50", offset = "0" } = c.req.query();

    if (!community_id) {
      return c.json({ message: "Community ID is required" }, 400);
    }

    // First get the community by id or communityContractAddress
    const [community] = await db
      .select()
      .from(communities)
      .where(
        isAddress(community_id)
          ? eq(communities.communityContractAddress, community_id)
          : eq(communities.id, community_id),
      )
      .limit(1);

    if (!community) {
      return c.json({ message: Errors.COMMUNITY_NOT_FOUND }, 404);
    }

    const conditions = [eq(pendingRewards.community_id, community.id)];

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
        contributor_name: pendingRewards.contributor_name,
        wallet_address: pendingRewards.wallet_address,
        platform: pendingRewards.platform,
        reward_id: pendingRewards.reward_id,
        points: pendingRewards.points,
        summary: pendingRewards.summary,
        description: pendingRewards.description,
        impact: pendingRewards.impact,
        evidence: pendingRewards.evidence,
        reasoning: pendingRewards.reasoning,
        metadata_uri: pendingRewards.metadata_uri,
        created_at: pendingRewards.created_at,
      })
      .from(pendingRewards)
      .where(and(...conditions))
      .orderBy(desc(pendingRewards.created_at))
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
    return c.json(
      {
        message: "Failed to retrieve pending rewards",
        error: error instanceof Error ? error.message : String(error),
      },
      500,
    );
  }
});

// Add the delete pending reward endpoint
rewardsRoute.openapi(deletePendingReward, async (c) => {
  try {
    const { id } = c.req.param();

    // Delete the reward, ensuring it belongs to the community
    const result = await db.delete(pendingRewards).where(eq(pendingRewards.id, id));

    if (!result) {
      return c.json({ message: "Pending reward not found" }, 404);
    }

    return c.json({ success: true });
  } catch (error) {
    console.error("Error deleting pending reward:", error);
    return c.json(
      {
        message: "Failed to delete pending reward",
        error: error instanceof Error ? error.message : String(error),
      },
      500,
    );
  }
});

export default rewardsRoute;
