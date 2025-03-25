import { mastra } from "@/agent";
import { db } from "@/db";
import { platformConnections } from "@/db/schema";
import { OpenAPIHono } from "@hono/zod-openapi";
import { PGVECTOR_PROMPT } from "@mastra/rag";
import dayjs from "dayjs";
import { eq } from "drizzle-orm";
import { getAgentSummary, postAgentSummary, postHistoricalMessages } from "./routes";
import { fetchHistoricalMessagesTool } from "@/agent/tools/fetchHistoricalMessages";

enum Errors {
  PLATFORM_NOT_FOUND = "Platform not for given community",
  COMMUNITY_NOT_FOUND = "Community not found",
}

const agentRoute = new OpenAPIHono();

agentRoute.openapi(getAgentSummary, async (c) => {
  try {
    const communityId = c.get("communityId");
    if (!communityId) {
      return c.json({ message: Errors.COMMUNITY_NOT_FOUND }, 400);
    }

    const platform = await db.query.platformConnections.findFirst({
      where: eq(platformConnections.communityId, communityId as string),
    });

    if (!platform) {
      return c.json({ message: Errors.PLATFORM_NOT_FOUND }, 404);
    }

    // Get date range from query params or use defaults
    const query = c.req.query();
    const startDate = dayjs(query.start_date).valueOf() ?? dayjs().subtract(7, "day").valueOf();
    const endDate = dayjs(query.end_date).valueOf() ?? dayjs().valueOf();

    const workflow = mastra.getWorkflow("summaryWorkflow");
    const { start } = workflow.createRun();

    const result = await start({
      triggerData: {
        startDate: startDate,
        endDate: endDate,
        platformId: platform.platformId,
        communityId: communityId,
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

// POST endpoint for querying conversation history
agentRoute.openapi(postAgentSummary, async (c) => {
  try {
    // Get the community ID from context
    const communityId = c.get("communityId");

    // Get connected platform
    const platform = await db.query.platformConnections.findFirst({
      where: eq(platformConnections.communityId, communityId as string),
    });

    if (!platform) {
      return c.json({ message: Errors.PLATFORM_NOT_FOUND }, 404);
    }

    // Get query from request body
    const { query, start_date, end_date } = await c.req.json();

    // Default to last 30 days if no timeframe provided
    const endDate = dayjs(end_date).valueOf() || dayjs().valueOf();
    const startDate = dayjs(start_date).valueOf() || dayjs().subtract(30, "day").valueOf();

    // Get the RAG agent from mastra
    const ragAgent = mastra.getAgent("ragAgent");

    // Create context with timeframe information
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

    // Generate response using the RAG agent
    const response = await ragAgent.generate(contextWithTimeDetails);

    // Return response in the expected format
    return c.json({
      summary: response.text,
    });
  } catch (error) {
    console.error("Error querying conversations:", error);
    throw error;
  }
});

// Add historical messages endpoint
agentRoute.openapi(postHistoricalMessages, async (c) => {
  try {
    const { platformId } = await c.req.json();

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
        error: error instanceof Error ? error.message : "Unknown error occurred" 
      }, 
      500
    );
  }
});

export default agentRoute;
