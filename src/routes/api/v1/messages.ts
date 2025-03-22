import { OpenAPIHono } from "@hono/zod-openapi";
import { z } from "zod";
import { fetchCommunityMessagesTool } from "@/agent/tools/getMessages";
import { createRoute } from "@hono/zod-openapi";

const app = new OpenAPIHono();

// Helper function to get date from a week ago
const getOneWeekAgo = (): string => {
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - 7); // Go back 7 days
  return startDate.toISOString();
};

// Helper function to get current date
const getToday = (): string => {
  const endDate = new Date();
  return endDate.toISOString();
};

const getMessagesRoute = createRoute({
  method: "get",
  path: "/",
  tags: ["Messages"],
  summary: "Fetch community messages",
  description: "Fetch messages from a community with optional statistics",
  request: {
    query: z.object({
      startDate: z.string()
        .describe("Start date in ISO format")
        .optional()
        .default(getOneWeekAgo()),
      endDate: z.string()
        .describe("End date in ISO format")
        .optional()
        .default(getToday()),
      platformId: z.string()
        .describe("Platform ID")
        .optional()
        .default("932238833146277958"),
      includeStats: z
        .enum(["true", "false"])
        .optional()
        .default("true"),
      formatByChannel: z
        .enum(["true", "false"])
        .optional()
        .default("true"),
      includeMessageId: z
        .enum(["true", "false"])
        .optional()
        .default("true")
    }),
  },
  responses: {
    200: {
      description: "Messages successfully retrieved",
      content: {
        "application/json": {
          schema: z.object({
            transcript: z.string(),
            messageCount: z.number(),
            uniqueUserCount: z.number(),
            stats: z
              .object({
                messagesByDate: z.array(
                  z.object({
                    date: z.string(),
                    count: z.number(),
                    uniqueUsers: z.number(),
                  })
                ),
                topContributors: z.array(
                  z.object({
                    username: z.string(),
                    count: z.number(),
                  })
                ),
                messagesByChannel: z.array(
                  z.object({
                    channelId: z.string(),
                    count: z.number(),
                    uniqueUsers: z.number()
                  })
                ),
              })
              .optional(),
          }),
        },
      },
    },
    400: {
      description: "Bad request",
      content: {
        "application/json": {
          schema: z.object({
            message: z.string(),
          }),
        },
      },
    },
    500: {
      description: "Internal server error",
      content: {
        "application/json": {
          schema: z.object({
            message: z.string(),
          }),
        },
      },
    },
  },
});

app.openapi(getMessagesRoute, async (c) => {
  try {
    const { 
      startDate: startDateStr, 
      endDate: endDateStr, 
      platformId, 
      includeStats,
      formatByChannel,
      includeMessageId 
    } = c.req.valid("query");
    
    // Create date objects and convert to timestamps
    let startTimestamp: number, endTimestamp: number;
    
    // Check if custom dates were provided or use defaults
    if (startDateStr === getOneWeekAgo() && endDateStr === getToday()) {
      const now = new Date();
      endTimestamp = now.getTime();
      const weekAgo = new Date();
      weekAgo.setDate(weekAgo.getDate() - 7);
      startTimestamp = weekAgo.getTime();
    } else {
      startTimestamp = new Date(startDateStr).getTime();
      endTimestamp = new Date(endDateStr).getTime();
    }
    
    console.log(`Fetching messages from ${startTimestamp} to ${endTimestamp} for platform ${platformId}`);
    
    if (!fetchCommunityMessagesTool.execute) {
      throw new Error("Fetch messages tool not initialized");
    }

    const result = await fetchCommunityMessagesTool.execute({
      context: {
        startDate: startTimestamp,
        endDate: endTimestamp,
        platformId,
        includeStats: includeStats === "false",
        formatByChannel: formatByChannel === "true",
        includeMessageId: includeMessageId === "true"
      },
    });

    return c.json(result);
  } catch (error: any) {
    console.error("Error fetching messages:", error);
    return c.json({ message: error.message || "Failed to fetch messages" }, 500);
  }
});

export default app; 