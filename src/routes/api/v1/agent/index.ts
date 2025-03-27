import { mastra } from "@/agent";
import { db } from "@/db";
import { platformConnections, pendingRewards } from "@/db/schema";
import { OpenAPIHono } from "@hono/zod-openapi";
import { PGVECTOR_PROMPT } from "@mastra/rag";
import dayjs from "dayjs";
import { and, eq, sql } from "drizzle-orm";
import { getAgentSummary, postAgentSummary, getMessages, getImpactReport, postRewardsAnalysis, createPrivyWallet, getPendingRewards } from "./routes";
import { getMessagesTool } from "@/agent/tools/getMessages";
import { createPrivyWalletTool } from "@/agent/tools/privyWallet";

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
    return c.json({ 
      message: "Failed to analyze rewards", 
      error: error instanceof Error ? error.message : String(error)
    }, 500);
  }
});

// Add the Privy wallet creation endpoint
agentRoute.openapi(createPrivyWallet, async (c) => {
  try {
    const communityId = c.get("communityId");
    if (!communityId) {
      return c.json({ message: Errors.COMMUNITY_NOT_FOUND }, 400);
    }

    const { username, platform } = await c.req.json();

    if (!createPrivyWalletTool.execute) {
      return c.json({ message: "Privy wallet tool not initialized" }, 500);
    }

    const result = await createPrivyWalletTool.execute({
      context: {
        username,
        platform
      }
    });

    return c.json(result);
  } catch (error) {
    console.error("Error creating Privy wallet:", error);
    return c.json({ 
      message: "Failed to create wallet", 
      error: error instanceof Error ? error.message : String(error) 
    }, 500);
  }
});

// Add the get pending rewards endpoint
agentRoute.openapi(getPendingRewards, async (c) => {
  try {
    const communityId = c.get("communityId");
    if (!communityId) {
      return c.json({ message: Errors.COMMUNITY_NOT_FOUND }, 400);
    }

    const { status, limit = "50", offset = "0" } = c.req.query();

    // Build the query conditions
    const conditions = [eq(pendingRewards.communityId, communityId)];
    if (status) {
      conditions.push(eq(pendingRewards.status, status as "pending" | "processed" | "failed"));
    }

    // Get total count
    const [{ count }] = await db
      .select({ count: sql<number>`count(*)` })
      .from(pendingRewards)
      .where(and(...conditions));

    // Get paginated results
    const rewards = await db
      .select({
        id: pendingRewards.id,
        contributorName: pendingRewards.contributorName,
        walletAddress: pendingRewards.walletAddress,
        platform: pendingRewards.platform,
        rewardId: pendingRewards.rewardId,
        points: pendingRewards.points,
        summary: pendingRewards.summary,
        description: pendingRewards.description,
        impact: pendingRewards.impact,
        evidence: pendingRewards.evidence,
        reasoning: pendingRewards.reasoning,
        metadataUri: pendingRewards.metadataUri,
        createdAt: pendingRewards.createdAt,
      })
      .from(pendingRewards)
      .where(and(...conditions))
      .orderBy(pendingRewards.createdAt)
      .limit(Number(limit))
      .offset(Number(offset));

    return c.json({
      rewards,
      total: Number(count),
      limit,
      offset,
    });
  } catch (error) {
    console.error("Error retrieving pending rewards:", error);
    return c.json({ 
      message: "Failed to retrieve pending rewards", 
      error: error instanceof Error ? error.message : String(error)
    }, 500);
  }
});

export default agentRoute;
