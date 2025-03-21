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
