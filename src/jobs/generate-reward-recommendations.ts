import { db } from "@/db";
import {
  communities as communitiesSchema,
  platformConnections as platformConnectionsSchema,
} from "@/db/schema";
import { generateRewardsInBackground } from "@/services/rewards";
import dayjs from "dayjs";
import { eq } from "drizzle-orm";
import pino from "pino";

// Create a logger instance
const logger = pino({
  level: "info",
  timestamp: true,
  formatters: {
    level: (label) => {
      return { level: label };
    },
  },
  transport: {
    target: "pino-pretty",
    options: {
      colorize: true,
      translateTime: "SYS:standard",
    },
  },
});

export async function generateRewardRecommendations() {
  const startTime = Date.now();
  logger.info("Starting reward recommendations generation job");

  try {
    const communities = await db.select().from(communitiesSchema);
    logger.info({ communityCount: communities.length }, "Found communities to process");

    // Initialize overall summary statistics
    const overallSummary = {
      totalPlatforms: 0,
      successfulPlatforms: 0,
      failedPlatforms: 0,
      platformSummaries: [] as Array<{
        communityId: string;
        platformId: string;
        status: "success" | "failed";
        durationMs: number;
        error?: string;
      }>,
    };

    for (const community of communities) {
      const platformConnections = await db
        .select()
        .from(platformConnectionsSchema)
        .where(eq(platformConnectionsSchema.communityId, community.id));

      if (platformConnections.length === 0) {
        logger.info({ communityId: community.id }, "No platform connections found for community");
        continue;
      }

      logger.info(
        {
          communityId: community.id,
          platformCount: platformConnections.length,
        },
        "Processing community",
      );

      overallSummary.totalPlatforms += platformConnections.length;
      const job_id = crypto.randomUUID();

      try {
        // Generate rewards and get platform summaries
        const summaries = await generateRewardsInBackground(
          job_id,
          community.id,
          dayjs().startOf("day").subtract(1, "day").valueOf(),
          dayjs().endOf("day").valueOf(),
        );

        for (const summary of summaries) {
          if (summary.error) {
            // Log individual platform failure
            logger.error(
              {
                platformSummary: {
                  communityId: community.id,
                  platformId: summary.platformId,
                  durationMs: summary.durationMs,
                  jobId: job_id,
                  error: summary.error,
                },
              },
              `Platform ${summary.platformId} processing failed`,
            );
            overallSummary.failedPlatforms++;
            overallSummary.platformSummaries.push({
              communityId: community.id,
              platformId: summary.platformId,
              status: "failed",
              durationMs: summary.durationMs,
              error: summary.error,
            });
          } else {
            // Log individual platform success
            logger.info(
              {
                platformSummary: {
                  communityId: community.id,
                  platformId: summary.platformId,
                  durationMs: summary.durationMs,
                  jobId: job_id,
                },
              },
              `Platform ${summary.platformId} processed successfully`,
            );
            overallSummary.successfulPlatforms++;
            overallSummary.platformSummaries.push({
              communityId: community.id,
              platformId: summary.platformId,
              status: "success",
              durationMs: summary.durationMs,
            });
          }
        }
      } catch (error) {
        logger.error(
          error instanceof Error ? error : { error },
          `Failed to generate rewards for community ${community.id}`
        )
      }
    }

    // Calculate final statistics
    const totalTime = Date.now() - startTime;
    const successRate = (overallSummary.successfulPlatforms / overallSummary.totalPlatforms) * 100;
    const averageTimePerPlatform = Math.round(
      overallSummary.platformSummaries.reduce((acc, curr) => acc + curr.durationMs, 0) /
      overallSummary.totalPlatforms,
    );

    // Log final summary
    logger.info(
      {
        finalSummary: {
          totalDurationMs: totalTime,
          totalPlatforms: overallSummary.totalPlatforms,
          successfulPlatforms: overallSummary.successfulPlatforms,
          failedPlatforms: overallSummary.failedPlatforms,
          successRate: `${successRate.toFixed(2)}%`,
          averageTimePerPlatformMs: averageTimePerPlatform,
          platformResults: overallSummary.platformSummaries.map((summary) => ({
            communityId: summary.communityId,
            platformId: summary.platformId,
            status: summary.status,
            durationMs: summary.durationMs,
            ...(summary.error && { error: summary.error }),
          })),
        },
      },
      "Reward recommendations job completed",
    );
  } catch (error) {
    logger.fatal(
      {
        err: error,
        durationMs: Date.now() - startTime,
      },
      "Fatal error in reward recommendations job",
    );
    throw error;
  }
}
