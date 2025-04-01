import { createRoute, z } from "@hono/zod-openapi";

export const getAgentSummary = createRoute({
  method: "get",
  path: "/",
  request: {
    query: z.object({
      platformId: z.string(),
      channelId: z.string().optional(),
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
            channelId: z.string().optional(),
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

export const getHistoricalMessages = createRoute({
  method: "get",
  path: "/historical-messages",
  request: {
    query: z.object({
      platform_id: z.string().nonempty(),
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
      description: "Historical messages were fetched and stored successfully",
      content: {
        "application/json": {
          schema: z.object({
            success: z.boolean(),
            newMessagesAdded: z.number(),
            error: z.string().optional(),
            timeframe: z.object({
              startDate: z.string().datetime(),
              endDate: z.string().datetime(),
            }),
          }),
        },
      },
    },
    500: {
      description: "An error occurred while fetching messages",
    },
  },
});
