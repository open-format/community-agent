import { mastra } from "@/agent";
import { db } from "@/db";
import { platformConnections } from "@/db/schema";
import { OpenAPIHono } from "@hono/zod-openapi";
import { PGVECTOR_PROMPT } from "@mastra/rag";
import dayjs from "dayjs";
import { eq } from "drizzle-orm";
import { getAgentSummary, postAgentSummary, getMessages, getImpactReport, postRewardsAnalysis } from "./routes";
import { getMessagesTool } from "@/agent/tools/getMessages";

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
    const startDate = query.startDate || dayjs().subtract(7, "day").toISOString();
    const endDate = query.endDate || dayjs().toISOString();

    // Convert to Unix timestamps for the workflow
    const startMs = dayjs(startDate).valueOf();
    const endMs = dayjs(endDate).valueOf();

    const workflow = mastra.getWorkflow("summaryWorkflow");
    const { start } = workflow.createRun();

    const result = await start({
      triggerData: {
        startDate: startMs,
        endDate: endMs,
        platformId: platform.platformId,
      },
    });

    if (result.results.generateSummary?.status === "success") {
      return c.json({
        summary: result.results.generateSummary.output.summary,
        timeframe: {
          startDate,
          endDate,
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

// Add the report endpoint
agentRoute.openapi(getImpactReport, async (c) => {
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
    const { startDate, endDate } = c.req.query();
    const startDateMs = startDate ? dayjs(startDate).valueOf() : dayjs().subtract(7, "day").valueOf();
    const endDateMs = endDate ? dayjs(endDate).valueOf() : dayjs().valueOf();

    const workflow = mastra.getWorkflow("impactReportWorkflow");
    const { start } = workflow.createRun();

    const result = await start({
      triggerData: {
        startDate: startDateMs,
        endDate: endDateMs,
        platformId: platform.platformId,
      },
    });

    if (!result.results?.saveReport?.output) {
      console.error('Workflow results:', result.results);
      return c.json({ message: "Failed to save report" }, 500);
    }

    return c.json({
      success: result.results.saveReport.output.success,
      reportId: result.results.saveReport.output.reportId,
      timeframe: {
        startDate: dayjs(startDate).toISOString(),
        endDate: dayjs(endDate).toISOString(),
      },
    });
  } catch (error) {
    console.error("Error generating impact report:", error);
    return c.json({ message: "Failed to generate impact report", error: String(error) }, 500);
  }
});

// Add the messages endpoint
agentRoute.openapi(getMessages, async (c) => {
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

    const { 
      startDate, 
      endDate, 
      platformId,
      includeStats = "false",
      includeMessageId = "false"
    } = c.req.query();

    // Validate that the provided platformId matches the community's platform
    if (platformId !== platform.platformId) {
      return c.json({ message: "Invalid platform ID for this community" }, 400);
    }

    // Convert string "true"/"false" to boolean
    const includeStatsBool = includeStats === "true";
    const includeMessageIdBool = includeMessageId === "true";

    // Convert to Unix timestamps for internal use
    const startMs = dayjs(startDate).valueOf();
    const endMs = dayjs(endDate).valueOf();

    console.log(`Fetching messages for platform ${platformId} from ${startMs} to ${endMs}`);

    if (!getMessagesTool.execute) {
      return c.json({ message: "Messages tool not initialized" }, 500);
    }

    const result = await getMessagesTool.execute({
      context: {
        startDate: startMs,
        endDate: endMs,
        platformId,
        includeStats: includeStatsBool,
        includeMessageId: includeMessageIdBool
      }
    });

    const response = {
      message: "Messages retrieved successfully",
      transcript: result.transcript,
      timeframe: {
        startDate,
        endDate,
      },
      ...(result.stats ? { stats: result.stats } : {})
    };

    return c.json(response, 200);
  } catch (error: any) {
    console.error("Error fetching messages:", error);
    return c.json({ message: error.message || "Failed to fetch messages" }, 500);
  }
});

// Add to agentRoute
agentRoute.openapi(postRewardsAnalysis, async (c) => {
  try {
    const communityId = c.get("communityId");
    if (!communityId) {
      return c.json({ message: Errors.COMMUNITY_NOT_FOUND }, 400);
    }

    const { platformId, startDate, endDate } = await c.req.json();
    
    const workflow = mastra.getWorkflow("rewardsWorkflow");
    const { start } = workflow.createRun();

    const result = await start({
      triggerData: {
        communityId,
        platformId,
        startDate: dayjs(startDate).valueOf(),
        endDate: dayjs(endDate).valueOf(),
      },
    });

    if (result.results.getWalletAddresses?.status === "success") {
      return c.json({
        rewards: result.results.getWalletAddresses.output.rewards,
        timeframe: {
          startDate,
          endDate,
        },
      });
    }

    return c.json({ message: "Failed to analyze rewards" }, 500);
  } catch (error) {
    console.error("Error analyzing rewards:", error);
    return c.json({ message: "Failed to analyze rewards", error: String(error) }, 500);
  }
});

export default agentRoute;
