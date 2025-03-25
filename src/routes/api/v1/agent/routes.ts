import { createRoute, z } from "@hono/zod-openapi";
export const getAgentSummary = createRoute({
  method: "get",
  path: "/summary",
  request: {
    query: z.object({
      platformId: z.string(),
      startDate: z
        .string({ message: "must be a valid ISO 8601 date format" })
        .datetime({ message: "must be a valid ISO 8601 date format" })
        .optional(),
      endDate: z
        .string({ message: "must be a valid ISO 8601 date format" })
        .datetime({ message: "must be a valid ISO 8601 date format" })
        .optional(),
    }),
  },
  responses: {
    200: {
      description: "The summary was created successfully",
      content: {
        "application/json": {
          schema: z.object({
            summary: z.string(),
            timeframe: z.object({
              startDate: z.string().datetime(),
              endDate: z.string().datetime(),
            }),
          }),
        },
      },
    },
    404: {
      description: "The community was not found",
    },
    500: {
      description: "An error occurred while creating the summary",
    },
  },
});

export const postAgentSummary = createRoute({
  method: "post",
  path: "/query",
  request: {
    body: {
      content: {
        "application/json": {
          schema: z.object({
            query: z.string(),
            platform_id: z.string(),
            start_date: z
              .string({ message: "must be a valid ISO 8601 date format" })
              .datetime({ message: "must be a valid ISO 8601 date format" })
              .optional(),
            endDate: z
              .string({ message: "must be a valid ISO 8601 date format" })
              .datetime({ message: "must be a valid ISO 8601 date format" })
              .optional(),
          }),
        },
      },
    },
  },
  responses: {
    200: {
      description: "The summary was created successfully",
      content: {
        "application/json": {
          schema: z.object({
            summary: z.string(),
          }),
        },
      },
    },
    404: {
      description: "The community was not found",
    },
    500: {
      description: "An error occurred while creating the summary",
    },
  },
});

export const getMessages = createRoute({
  method: "get",
  path: "/messages",
  tags: ["Messages"],
  summary: "Fetch community messages",
  description: "Fetch messages from a community with optional statistics",
  request: {
    headers: z.object({
      "X-Community-ID": z.string(),
    }),
    query: z.object({
      startDate: z
        .string({ message: "must be a valid ISO 8601 date format" })
        .datetime({ message: "must be a valid ISO 8601 date format" })
        .optional(),
      endDate: z
        .string({ message: "must be a valid ISO 8601 date format" })
        .datetime({ message: "must be a valid ISO 8601 date format" })
        .optional(),
      platformId: z.string().describe("Platform ID"),
      includeStats: z.enum(["true", "false"]).optional().default("false"),
      includeMessageId: z.enum(["true", "false"]).optional().default("false"),
    }),
  },
  responses: {
    200: {
      description: "Messages successfully retrieved",
      content: {
        "application/json": {
          schema: z.object({
            message: z.string(),
            transcript: z.string(),
            timeframe: z.object({
              startDate: z.string().datetime(),
              endDate: z.string().datetime(),
            }),
            stats: z
              .object({
                messageCount: z.number(),
                uniqueUserCount: z.number(),
                messagesByDate: z.array(
                  z.object({
                    date: z.string(),
                    count: z.number(),
                    uniqueUsers: z.number(),
                  }),
                ),
                topContributors: z.array(
                  z.object({
                    username: z.string(),
                    count: z.number(),
                  }),
                ),
                messagesByChannel: z.array(
                  z.object({
                    channel: z.object({
                      id: z.string(),
                      name: z.string(),
                    }),
                    count: z.number(),
                    uniqueUsers: z.number(),
                  }),
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
    404: {
      description: "The community was not found",
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

export const getImpactReport = createRoute({
  method: "get",
  path: "/report",
  tags: ["Reports"],
  summary: "Generate impact report",
  description: "Generate an impact report for a community over a specified time period",
  request: {
    headers: z.object({
      "X-Community-ID": z.string(),
    }),
    query: z.object({
      platformId: z.string().describe("Platform ID"),
      startDate: z
        .string({ message: "must be a valid ISO 8601 date format" })
        .datetime({ message: "must be a valid ISO 8601 date format" }),
      endDate: z
        .string({ message: "must be a valid ISO 8601 date format" })
        .datetime({ message: "must be a valid ISO 8601 date format" }),
    }),
  },
  responses: {
    200: {
      description: "The report was generated successfully",
      content: {
        "application/json": {
          schema: z.object({
            report: z.object({
              overview: z.object({
                totalMessages: z.number(),
                uniqueUsers: z.number(),
                activeChannels: z.number(),
              }),
              dailyActivity: z.array(
                z.object({
                  date: z.string(),
                  messageCount: z.number(),
                  uniqueUsers: z.number(),
                }),
              ),
              topContributors: z.array(
                z.object({
                  username: z.string(),
                  messageCount: z.number(),
                }),
              ),
              channelBreakdown: z.array(
                z.object({
                  channelName: z.string(),
                  messageCount: z.number(),
                  uniqueUsers: z.number(),
                }),
              ),
              keyTopics: z.array(
                z.object({
                  topic: z.string(),
                  messageCount: z.number(),
                  description: z.string(),
                  examples: z.array(z.string()),
                }),
              ),
              userSentiment: z.object({
                excitement: z.array(
                  z.object({
                    title: z.string(),
                    description: z.string(),
                    users: z.array(z.string()),
                    examples: z.array(z.string()),
                  }),
                ),
                frustrations: z.array(
                  z.object({
                    title: z.string(),
                    description: z.string(),
                    users: z.array(z.string()),
                    examples: z.array(z.string()),
                  }),
                ),
              }),
            }),
            timeframe: z.object({
              startDate: z.string().datetime(),
              endDate: z.string().datetime(),
            }),
          }),
        },
      },
    },
    404: {
      description: "The community was not found",
    },
    500: {
      description: "An error occurred while generating the report",
    },
  },
});
