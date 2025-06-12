import { storeReportResult, updateReportJobStatus } from "../lib/redis";

import { mastra } from "@/agent";
import { db } from "@/db";
import { platformConnections } from "@/db/schema";
import { eq } from "drizzle-orm";
import { ReportStatus } from "../lib/redis";
import { logger } from "./logger";

// Function to generate the report in the background
export async function generateReportInBackground(
  jobId: string,
  startTimestamp: number,
  endTimestamp: number,
  platformId?: string,
  communityId?: string,
) {
  try {
    await updateReportJobStatus(jobId, ReportStatus.PROCESSING);

    if (!platformId && !communityId) {
      logger.error("Impact Report Workflow failed to start: No community or platform");
      await updateReportJobStatus(jobId, ReportStatus.FAILED, {
        error: "No community or platform specified.",
      });
      return;
    }

    const workflow = mastra.getWorkflow("impactReportWorkflow");
    const { start } = workflow.createRun();

    let platform = null;
    if (communityId) {
      const platforms = await db
        .select()
        .from(platformConnections)
        .where(eq(platformConnections.communityId, communityId));
      if (platforms.length === 0) {
        logger.error("Impact Report Workflow failed to start: No platform connections");
        await updateReportJobStatus(jobId, ReportStatus.FAILED, {
          error: "No platform connections found for community.",
        });
        return;
      }
    } else {
      platform = platformId;
    }

    const result = await start({
      triggerData: {
        startDate: startTimestamp,
        endDate: endTimestamp,
        platformId: platform || undefined,
        communityId: platform ? undefined : communityId,
      },
    });

    if (!result.results?.saveReport?.output) {
      logger.error({ workflowResults: result.results }, "Impact Report Workflow failed: Failed to save report");
      await updateReportJobStatus(jobId, ReportStatus.FAILED, {
        error: "Failed to save report",
      });
      return;
    }

    await storeReportResult(jobId, {
      report: result.results.generateReport.output.report,
    });

    await updateReportJobStatus(jobId, ReportStatus.COMPLETED, {
      reportId: result.results.saveReport.output.reportId,
    });
  } catch (error) {
    logger.error(
      error instanceof Error ? error : { error },
      "Impact Report failed: Error generating report"
    );
    await updateReportJobStatus(jobId, ReportStatus.FAILED, {
      error: String(error),
    });
  }
}
