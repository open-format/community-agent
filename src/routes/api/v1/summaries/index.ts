import { mastra } from "@/agent";
import { db } from "@/db";
import { platformConnections } from "@/db/schema";
import { ReportStatus, createReportJob, getReportJob, getReportResult } from "@/lib/redis";
import { fetchHistoricalMessagesInBackground } from "@/services/historical-messages";
import { createUnixTimestamp } from "@/utils/time";
import { OpenAPIHono } from "@hono/zod-openapi";
import { PGVECTOR_PROMPT } from "@mastra/rag";
import dayjs from "dayjs";
import { eq } from "drizzle-orm";
import {
  getAgentSummary,
  getHistoricalMessages,
  getHistoricalMessagesStatus,
  postAgentSummary,
} from "./routes";
import { logger } from "@/services/logger";

enum Errors {
  PLATFORM_NOT_FOUND = "Platform not found",
}

const summariesRoute = new OpenAPIHono();

summariesRoute.openapi(getAgentSummary, async (c) => {
  try {
    const platformId = c.req.query("platformId");
    const channelId = c.req.query("channelId");

    const platform = await db.query.platformConnections.findFirst({
      where: eq(platformConnections.platformId, platformId as string),
    });

    if (!platform) {
      return c.json({ message: Errors.PLATFORM_NOT_FOUND }, 404);
    }

    const query = c.req.query();
    const startDate = createUnixTimestamp(query.startDate, 30);
    const endDate = createUnixTimestamp(query.endDate);

    const workflow = mastra.getWorkflow("summaryWorkflow");
    const { start } = workflow.createRun();

    const result = await start({
      triggerData: {
        startDate,
        endDate,
        platformId: platform.platformId,
        channelId: channelId,
      },
    });

    if (result.results.generateSummary?.status === "success") {
      return c.json({
        summary: result.results.generateSummary.output.summary,
        timeframe: {
          startDate: dayjs(startDate).toISOString(),
          endDate: dayjs(endDate).toISOString(),
        },
        channelId: channelId,
      });
    }

    return c.json({ message: "Failed to generate summary" }, 500);
  } catch (error) {
    console.error("Error generating summary:", error);
    return c.json({ message: "Failed to generate summary", error: String(error) }, 500);
  }
});

summariesRoute.openapi(postAgentSummary, async (c) => {
  try {
    const { query, start_date, end_date, platform_id } = await c.req.json();

    const platform = await db.query.platformConnections.findFirst({
      where: eq(platformConnections.platformId, platform_id as string),
    });

    if (!platform) {
      return c.json({ message: Errors.PLATFORM_NOT_FOUND }, 404);
    }

    const startDate = createUnixTimestamp(start_date);
    const endDate = createUnixTimestamp(end_date);

    const ragAgent = mastra.getAgent("ragAgent");

    const contextWithTimeDetails = `
Query: ${query}

The user is asking about conversations that occurred between 
two dates in a community with platform ID: ${platform.platformId}.

Filter the context by searching the metadata.
  
  The metadata is structured as follows:
 
  {
    platformId: string,
    timestamp: number,
  }

  filtering timestamp is like this:
  $and: [
    { timestamp: { $gte: ${startDate} } },
    { timestamp: { $lte: ${endDate} } },
  ],

  Set topK to 20
 
  ${PGVECTOR_PROMPT}

Please search through the conversation history to find relevant information.
`;

    const response = await ragAgent.generate(contextWithTimeDetails);

    return c.json({
      summary: response.text,
    });
  } catch (error) {
    console.error("Error querying conversations:", error);
    throw error;
  }
});

// Add historical messages endpoint
summariesRoute.openapi(getHistoricalMessages, async (c) => {
  try {
    const { platform_id, start_date, end_date } = c.req.query();

    //check if platform exists in db
    const platform = await db.query.platformConnections.findFirst({
      where: eq(platformConnections.platformId, platform_id as string),
    });

    if (!platform) {
      return c.json({ message: Errors.PLATFORM_NOT_FOUND }, 404);
    }

    // Convert dates to timestamps, using defaults if not provided
    const endTimestamp = end_date ? dayjs(end_date as string).valueOf() : dayjs().valueOf();
    const startTimestamp = start_date
      ? dayjs(start_date as string).valueOf()
      : dayjs().subtract(14, "day").valueOf();

    const job_id = crypto.randomUUID();

    await createReportJob(job_id, platform_id as string, undefined, startTimestamp, endTimestamp);

    // Start the background job
    fetchHistoricalMessagesInBackground(
      job_id,
      platform_id as string,
      startTimestamp,
      endTimestamp,
    );

    return c.json({
      job_id,
      status: ReportStatus.PENDING,
      timeframe: {
        start_date: dayjs(startTimestamp).toISOString(),
        end_date: dayjs(endTimestamp).toISOString(),
      },
    });
  } catch (error) {
    logger.error(
      error instanceof Error ? error : { error },
      "Error starting historical messages fetch"
    );
    return c.json(
      {
        message: "Failed to start historical message fetch",
        error: error instanceof Error ? error.message : String(error),
      },
      500,
    );
  }
});

// Add historical messages status endpoint
summariesRoute.openapi(getHistoricalMessagesStatus, async (c) => {
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
        error: "Historical message fetch job not found",
      });
    }

    let result: { newMessagesAdded: number } | null = null;
    if (job.status === ReportStatus.COMPLETED) {
      result = (await getReportResult(job_id)) as { newMessagesAdded: number } | null;
    }

    return c.json({
      job_id,
      status: job.status,
      newMessagesAdded: result?.newMessagesAdded,
      timeframe: {
        start_date: dayjs(job.startDate).toISOString(),
        end_date: dayjs(job.endDate).toISOString(),
      },
      ...(job.error ? { error: job.error } : {}),
    });
  } catch (error) {
    console.error("Error checking historical message fetch status:", error);
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

export default summariesRoute;
