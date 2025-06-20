import { vectorStore } from "@/agent/stores/vectorStore";
import { db } from "@/db";
import { communities, platformConnections } from "@/db/schema";
import { ReportStatus, createReportJob, getReportJob, getReportResult } from "@/lib/redis";
import { generateReportInBackground } from "@/services/report-generation";
import { createUnixTimestamp } from "@/utils/time";
import { OpenAPIHono } from "@hono/zod-openapi";
import dayjs from "dayjs";
import { eq } from "drizzle-orm";
import {
  generateImpactReport,
  getImpactReport,
  getImpactReportStatus,
  getImpactReports,
} from "./routes";
import { logger } from "@/services/logger";

enum Errors {
  PLATFORM_NOT_FOUND = "Platform not for given community",
  COMMUNITY_NOT_FOUND = "Community not found",
}

const reportsRoute = new OpenAPIHono();

reportsRoute.openapi(generateImpactReport, async (c) => {
  try {
    const { startDate, endDate, platformId, communityId } = c.req.query();

    if (platformId) {
      const platform = await db.query.platformConnections.findFirst({
        where: eq(platformConnections.platformId, platformId as string),
      });

      if (!platform) {
        return c.json({ message: Errors.PLATFORM_NOT_FOUND }, 404);
      }
    }

    if (communityId) {
      const community = await db.query.communities.findFirst({
        where: eq(communities.id, communityId as string),
      });

      if (!community) {
        return c.json({ message: Errors.COMMUNITY_NOT_FOUND }, 404);
      }
    }

    const startTimestamp = createUnixTimestamp(startDate, 14);
    const endTimestamp = createUnixTimestamp(endDate);

    const job_id = crypto.randomUUID();

    await createReportJob(job_id, platformId, communityId, startTimestamp, endTimestamp);

    generateReportInBackground(job_id, startTimestamp, endTimestamp, platformId, communityId);

    // Return immediately with the job ID
    return c.json({
      success: true,
      job_id,
      status: ReportStatus.PENDING,
      timeframe: {
        startDate: dayjs(startTimestamp).toISOString(),
        endDate: dayjs(endTimestamp).toISOString(),
      },
    });
  } catch (error) {
    logger.error(
      error instanceof Error ? error : { error },
      "Error starting impact report generation"
    );
    return c.json({ message: "Failed to start report generation", error: String(error) }, 500);
  }
});

reportsRoute.openapi(getImpactReportStatus, async (c) => {
  try {
    const { job_id } = c.req.param();

    const job = await getReportJob(job_id);

    if (!job) {
      return c.json({
        job_id,
        status: "failed" as const,
        timeframe: {
          startDate: new Date().toISOString(),
          endDate: new Date().toISOString(),
        },
        error: "Report job not found",
      });
    }

    let reportData = null;
    if (job.status === ReportStatus.COMPLETED && job.reportId) {
      reportData = await getReportResult(job_id);
    }

    return c.json({
      job_id,
      status: job.status,
      reportId: job.reportId,
      report: reportData,
      timeframe: {
        startDate: dayjs(job.startDate).toISOString(),
        endDate: dayjs(job.endDate).toISOString(),
      },
      ...(job.error ? { error: job.error } : {}),
    });
  } catch (error) {
    console.error("Error checking report status:", error);
    return c.json({
      job_id: c.req.param("job_id"),
      status: "failed" as const,
      timeframe: {
        startDate: new Date().toISOString(),
        endDate: new Date().toISOString(),
      },
      error: String(error),
    });
  }
});

reportsRoute.openapi(getImpactReports, async (c) => {
  try {
    const { platformId, communityId, limit, startDate } = c.req.query();

    const topK = limit ? Number.parseInt(limit as string) : 100;

    // By default retrieve only reports generated in the last 2 days
    const timestamp = startDate ? Number.parseInt(startDate as string) :
      dayjs().startOf("day").subtract(2, "day").valueOf();

    let filter = undefined;
    if (communityId) {
      filter = { communityId, timestamp: { $gte: timestamp } };
    } else if (platformId) {
      filter = { platformId, timestamp: { $gte: timestamp } };
    }

    const results = await vectorStore.query({
      indexName: "impact_reports",
      queryVector: new Array(1536).fill(0),
      topK,
      includeMetadata: true,
      filter,
    });

    const sortedResults = results.sort((a, b) => b.metadata.timestamp - a.metadata.timestamp);

    return c.json({ impact_reports: sortedResults.map((result) => result.metadata) });
  } catch (error) {
    console.error("Error getting impact reports:", error);
    return c.json({ impact_reports: [], error: String(error) });
  }
});

reportsRoute.openapi(getImpactReport, async (c) => {
  try {
    const { summaryId } = c.req.param();

    const results = await vectorStore.query({
      indexName: "impact_reports",
      queryVector: new Array(1536).fill(0),
      topK: 1,
      includeMetadata: true,
      filter: {
        summaryId,
      },
    });

    if (!results.length) {
      return c.json({ message: "Report not found" }, 404);
    }

    return c.json({ report: results[0].metadata });
  } catch (error) {
    console.error("Error getting impact report:", error);
    return c.json({ message: "Failed to get report", error: String(error) }, 500);
  }
});

export default reportsRoute;
