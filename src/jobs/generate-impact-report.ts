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

      // Generate reports based on platform count
      if (platformConnections.length === 1) {
        // Single platform community - only generate individual platform report
        logger.info(
          { communityId: community.id, platformId: platformConnections[0].platformId },
          "Single platform community - generating individual platform report only",
        );

        try {
          await generateImpactReportAux({
            communityId: community.id,
            platformId: platformConnections[0].platformId,
          });
        } catch (error) {
          logger.error(
            {
              err: error,
              platformId: platformConnections[0].platformId,
              platform: platformConnections[0].platformType,
              communityId: community.id,
            },
            "Error generating Platform Impact Report",
          );
        }
      } else {
        // Multiple platforms - generate combined report and individual reports
        logger.info(
          { communityId: community.id, platformCount: platformConnections.length },
          "Multiple platforms - generating combined and individual reports",
        );

        try {
          // Generate Combined Impact Report for community
          await generateImpactReportAux({ communityId: community.id, platformId: undefined });
        } catch (error) {
          logger.error(
            {
              err: error,
              communityId: community.id,
            },
            "Error generating Combined Impact Report",
          );
        }

        // Generate Platform Impact Report for each platform in Community
        for (const platform of platformConnections) {
          try {
            await generateImpactReportAux({
              communityId: community.id,
              platformId: platform.platformId,
            });
          } catch (error) {
            logger.error(
              {
                err: error,
                platformId: platform.platformId,
                platform: platform.platformType,
                communityId: community.id,
              },
              "Error generating Platform Impact Report",
            );
          }
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

async function generateImpactReportAux({
  communityId,
  platformId,
}: { communityId: string; platformId: string | undefined }) {
  const workflow = mastra.getWorkflow("impactReportWorkflow");
  const { start } = workflow.createRun();

  const result = await start({
    triggerData: {
      startDate: dayjs().subtract(1, "week").valueOf(),
      endDate: dayjs().valueOf(),
      platformId: platformId,
      communityId: communityId,
    },
  });

  // Check if workflow completed successfully
  if (!result.results?.saveReport?.output && !result.results?.saveSummary?.output) {
    logger.error(
      {
        isCombined: platformId ? "No" : "Yes",
        platformId: platformId,
        communityId: communityId,
      },
      "Failed to generate impact report - no output from workflow steps",
    );
    return;
  }

  // Check if the workflow was skipped due to no messages
  const wasSkipped =
    result.results?.saveReport?.output?.skipped ||
    result.results?.saveSummary?.output?.skipped ||
    !result.results?.fetchMessages?.output?.hasMessages;

  if (wasSkipped) {
    const messageCount = result.results?.fetchMessages?.output?.messageCount || 0;
    logger.info(
      {
        isCombined: platformId ? "No" : "Yes",
        platformId: platformId,
        communityId: communityId,
        messageCount,
      },
      "Report generation skipped - no messages found in date range",
    );
    return;
  }

  // If we get here, the report was successfully generated
  const messageCount =
    result.results?.generateReport?.output?.report?.overview?.totalMessages ||
    result.results?.fetchMessages?.output?.messageCount ||
    0;

  logger.info(
    {
      isCombined: platformId ? "No" : "Yes",
      platformId: platformId,
      communityId: communityId,
      reportId: result.results?.saveReport?.output?.reportId,
      summaryId: result.results?.saveSummary?.output?.summaryId,
      messageCount,
      uniqueUsers:
        result.results?.generateReport?.output?.report?.overview?.uniqueUsers ||
        result.results?.fetchMessages?.output?.uniqueUserCount,
    },
    "Successfully generated impact report",
  );
}
