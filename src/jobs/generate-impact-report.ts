import { mastra } from "@/agent";
import { db } from "@/db";
import {
  communities as communitiesSchema,
  platformConnections as platformConnectionsSchema,
} from "@/db/schema";
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

export async function generateImpactReports() {
  const startTime = Date.now();
  logger.info("Starting impact report generation job");

  try {
    const communities = await db.select().from(communitiesSchema);
    logger.info({ communityCount: communities.length }, "Found communities to process");

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
        "Processing community platforms",
      );

      for (const platformConnection of platformConnections) {
        try {
          const workflow = mastra.getWorkflow("impactReportWorkflow");
          const { start } = workflow.createRun();

          const result = await start({
            triggerData: {
              startDate: dayjs().subtract(1, "week").valueOf(),
              endDate: dayjs().valueOf(),
              platformId: platformConnection.platformId,
            },
          });

          if (!result.results?.saveReport?.output) {
            logger.error(
              {
                platformId: platformConnection.platformId,
                communityId: community.id,
                results: result.results,
              },
              "Failed to generate impact report - no output from saveReport step",
            );
            continue;
          }

          logger.info(
            {
              platformId: platformConnection.platformId,
              communityId: community.id,
              summaryId: result.results.saveReport.output.summaryId,
              reportTimestamp: result.results.saveReport.output.timestamp,
              messageCount: result.results.saveReport.output.messageCount,
              uniqueUsers: result.results.saveReport.output.uniqueUserCount,
            },
            "Successfully generated impact report",
          );
        } catch (error) {
          logger.error(
            {
              err: error,
              platformId: platformConnection.platformId,
              communityId: community.id,
            },
            "Error in impact report generation",
          );
        }
      }
    }
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
