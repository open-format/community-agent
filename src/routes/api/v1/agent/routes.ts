import { createRoute, z } from "@hono/zod-openapi";
export const getAgentSummary = createRoute({
  method: "get",
  path: "/summary",
  request: {
    headers: z.object({
      "X-Community-ID": z.string(),
    }),
    query: z.object({
      start_date: z
        .string({ message: "must be a valid ISO 8601 date format" })
        .datetime({ message: "must be a valid ISO 8601 date format" })
        .optional(),
      end_date: z
        .string({ message: "must be a valid ISO 8601 date format" })
        .datetime({ message: "must be a valid ISO 8601 date format" })
        .optional(),
    }),
  },
  responses: {
    200: {
      description: "The summary was created successfully",
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
    headers: z.object({
      "X-Community-ID": z.string(),
    }),
    body: {
      content: {
        "application/json": {
          schema: z.object({
            query: z.string(),
            start_date: z
              .string({ message: "must be a valid ISO 8601 date format" })
              .datetime({ message: "must be a valid ISO 8601 date format" })
              .optional(),
            end_date: z
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
    query: z.object({
      start_date: z
        .string({ message: "must be a valid ISO 8601 date format" })
        .datetime({ message: "must be a valid ISO 8601 date format" })
        .optional(),
      end_date: z
        .string({ message: "must be a valid ISO 8601 date format" })
        .datetime({ message: "must be a valid ISO 8601 date format" })
        .optional(),
      platformId: z.string()
        .describe("Platform ID"),
      includeStats: z
        .enum(["true", "false"])
        .optional()
        .default("false"),
      includeMessageId: z
        .enum(["true", "false"])
        .optional()
        .default("false")
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
            stats: z.object({
              messageCount: z.number(),
              uniqueUserCount: z.number(),
              messagesByDate: z.array(z.object({
                date: z.string(),
                count: z.number(),
                uniqueUsers: z.number()
              })),
              topContributors: z.array(z.object({
                username: z.string(),
                count: z.number()
              })),
              messagesByChannel: z.array(z.object({
                channel: z.object({
                  id: z.string(),
                  name: z.string()
                }),
                count: z.number(),
                uniqueUsers: z.number()
              }))
            }).optional()
          })
        }
      }
    },
    400: {
      description: "Bad request",
      content: {
        "application/json": {
          schema: z.object({
            message: z.string()
          })
        }
      }
    },
    500: {
      description: "Internal server error",
      content: {
        "application/json": {
          schema: z.object({
            message: z.string()
          })
        }
      }
    }
  }
});
