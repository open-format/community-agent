import { vectorStore } from "@/agent/stores/vectorStore";
import { db } from "@/db";
import { platformConnections } from "@/db/schema";
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

enum Errors {
  PLATFORM_NOT_FOUND = "Platform not for given community",
  COMMUNITY_NOT_FOUND = "Community not found",
}

const reportsRoute = new OpenAPIHono();

reportsRoute.openapi(generateImpactReport, async (c) => {
  try {
    const { startDate, endDate, platformId } = c.req.query();

    const platform = await db.query.platformConnections.findFirst({
      where: eq(platformConnections.platformId, platformId as string),
    });

    if (!platform) {
      return c.json({ message: Errors.PLATFORM_NOT_FOUND }, 404);
    }

    const startTimestamp = createUnixTimestamp(startDate, 14);
    const endTimestamp = createUnixTimestamp(endDate);

    const job_id = crypto.randomUUID();

    await createReportJob(job_id, platformId as string, startTimestamp, endTimestamp);

    generateReportInBackground(job_id, startTimestamp, endTimestamp, platformId as string);

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
    console.error("Error starting impact report generation:", error);
    return c.json({ message: "Failed to start report generation", error: String(error) }, 500);
  }
});

reportsRoute.openapi(getImpactReportStatus, async (c) => {
  try {
    const { jobId } = c.req.param();

    const job = await getReportJob(jobId);

    if (!job) {
      return c.json({
        jobId,
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
      reportData = await getReportResult(jobId);
    }

    return c.json({
      jobId,
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
      jobId: c.req.param("jobId"),
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
    const { platformId, limit } = c.req.query();

    const topK = limit ? Number.parseInt(limit as string) : 10;

    const results = await vectorStore.query({
      indexName: "impact_reports",
      queryVector: new Array(1536).fill(0),
      topK,
      includeMetadata: true,
      filter: {
        platformId,
      },
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
