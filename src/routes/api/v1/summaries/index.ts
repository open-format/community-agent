import { mastra } from "@/agent";
import { fetchHistoricalMessagesTool } from "@/agent/tools/fetchHistoricalMessages";

import { db } from "@/db";
import { platformConnections } from "@/db/schema";
import { createUnixTimestamp } from "@/utils/time";
import { OpenAPIHono } from "@hono/zod-openapi";
import { PGVECTOR_PROMPT } from "@mastra/rag";
import dayjs from "dayjs";
import { eq } from "drizzle-orm";
import { getAgentSummary, getHistoricalMessages, postAgentSummary } from "./routes";

enum Errors {
  PLATFORM_NOT_FOUND = "Platform not found",
}

const summariesRoute = new OpenAPIHono();

summariesRoute.openapi(getAgentSummary, async (c) => {
  try {
    const platformId = c.req.query("platformId");

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
      },
    });

    if (result.results.generateSummary?.status === "success") {
      return c.json({
        summary: result.results.generateSummary.output.summary,
        timeframe: {
          startDate: dayjs(startDate).toISOString(),
          endDate: dayjs(endDate).toISOString(),
        },
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

    const startDate = createUnixTimestamp(start_date, 15);
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
    const { platformId } = c.req.query();

    //check if platform exists in db
    const platform = await db.query.platformConnections.findFirst({
      where: eq(platformConnections.platformId, platformId as string),
    });

    if (!platform) {
      return c.json({ message: Errors.PLATFORM_NOT_FOUND }, 404);
    }

    if (!fetchHistoricalMessagesTool.execute) {
      throw new Error("Historical messages tool not initialized");
    }

    // Execute the historical messages tool
    const result = await fetchHistoricalMessagesTool.execute({
      context: {
        platformId,
      },
    });

    return c.json(result);
  } catch (error) {
    console.error("Error fetching historical messages:", error);
    return c.json(
      {
        success: false,
        newMessagesAdded: 0,
        error: error instanceof Error ? error.message : "Unknown error occurred",
      },
      500,
    );
  }
});

export default summariesRoute;
