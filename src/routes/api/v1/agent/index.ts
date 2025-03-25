import { mastra } from "@/agent";
import { db } from "@/db";
import { platformConnections } from "@/db/schema";
import { OpenAPIHono } from "@hono/zod-openapi";
import { PGVECTOR_PROMPT } from "@mastra/rag";
import dayjs from "dayjs";
import { eq } from "drizzle-orm";
import { getAgentSummary, postAgentSummary } from "./routes";

enum Errors {
  PLATFORM_NOT_FOUND = "Platform not for given community",
  COMMUNITY_NOT_FOUND = "Community not found",
}

const agentRoute = new OpenAPIHono();

agentRoute.openapi(getAgentSummary, async (c) => {
  try {
    const platformId = c.req.query("platformId");

    const platform = await db.query.platformConnections.findFirst({
      where: eq(platformConnections.platformId, platformId as string),
    });

    if (!platform) {
      return c.json({ message: Errors.PLATFORM_NOT_FOUND }, 404);
    }

    // Get date range from query params or use defaults
    const query = c.req.query();
    const startDate = dayjs(query.startDate || dayjs().subtract(7, "day")).valueOf();
    const endDate = dayjs(query.endDate || dayjs()).valueOf();

    const workflow = mastra.getWorkflow("summaryWorkflow");
    const { start } = workflow.createRun();

    const result = await start({
      triggerData: {
        startDate: startDate,
        endDate: endDate,
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

// POST endpoint for querying conversation history
agentRoute.openapi(postAgentSummary, async (c) => {
  try {
    const { query, start_date, end_date, platform_id } = await c.req.json();

    const platform = await db.query.platformConnections.findFirst({
      where: eq(platformConnections.platformId, platform_id as string),
    });

    if (!platform) {
      return c.json({ message: Errors.PLATFORM_NOT_FOUND }, 404);
    }

    // Default to last 30 days if no timeframe provided
    const startDate = dayjs(start_date || dayjs().subtract(30, "day")).valueOf();
    const endDate = dayjs(end_date || dayjs()).valueOf();

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

export default agentRoute;
