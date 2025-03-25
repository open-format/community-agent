import { storeReportResult, updateReportJobStatus } from "../lib/redis";

import { mastra } from "@/agent";
import { ReportStatus } from "../lib/redis";

// Function to generate the report in the background
export async function generateReportInBackground(
  jobId: string,
  startTimestamp: number,
  endTimestamp: number,
  platformId: string,
) {
  try {
    await updateReportJobStatus(jobId, ReportStatus.PROCESSING);

    const workflow = mastra.getWorkflow("impactReportWorkflow");
    const { start } = workflow.createRun();

    const result = await start({
      triggerData: {
        startDate: startTimestamp,
        endDate: endTimestamp,
        platformId: platformId,
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
