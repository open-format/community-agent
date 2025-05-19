import { storeReportResult, updateReportJobStatus } from "../lib/redis";

import { mastra } from "@/agent";
import { ReportStatus } from "../lib/redis";
import { db } from "@/db";
import { platformConnections } from "@/db/schema";
import { eq } from "drizzle-orm";

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
      console.error("Workflow failed: no community or platform");
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
        await updateReportJobStatus(jobId, ReportStatus.FAILED, {
          error: "No platform connections found for community.",
        });
        return;
      }
      // If only one platform there is no need for combined report
      if (platforms.length === 1) {
        platform = platforms.at(0)?.platformId;
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
      console.error("Workflow results:", result.results);
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
    console.error("Error generating impact report:", error);
    await updateReportJobStatus(jobId, ReportStatus.FAILED, {
      error: String(error),
    });
  }
}
