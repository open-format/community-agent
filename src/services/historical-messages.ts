import { fetchHistoricalMessagesTool } from "@/agent/tools/fetchHistoricalMessages";
import { ReportStatus, storeReportResult, updateReportJobStatus } from "@/lib/redis";
import { logger } from "./logger";

// Function to fetch historical messages in the background
export async function fetchHistoricalMessagesInBackground(
  jobId: string,
  platformId: string,
  startDate: number,
  endDate: number,
) {
  try {
    await updateReportJobStatus(jobId, ReportStatus.PROCESSING);

    if (!fetchHistoricalMessagesTool.execute) {
      throw new Error("Historical messages tool not initialized");
    }

    const result = await fetchHistoricalMessagesTool.execute({
      context: {
        platformId,
        startDate,
        endDate,
      },
    });

    if (!result.success) {
      await updateReportJobStatus(jobId, ReportStatus.FAILED, {
        error: result.error || "Failed to fetch historical messages",
      });
      return;
    }

    await storeReportResult(jobId, {
      newMessagesAdded: result.newMessagesAdded,
    });

    await updateReportJobStatus(jobId, ReportStatus.COMPLETED);
  } catch (error) {
    logger.error(
      error instanceof Error ? error : { error }, 
      "Error fetching historical messages"
    );
    await updateReportJobStatus(jobId, ReportStatus.FAILED, {
      error: error instanceof Error ? error.message : String(error),
    });
  }
}
