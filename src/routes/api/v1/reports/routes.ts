import { createRoute, z } from "@hono/zod-openapi";

export const generateImpactReport = createRoute({
  method: "post",
  path: "/impact",
  tags: ["Reports"],
  summary: "Generate impact report",
  description: "Generate an impact report for a community over a specified time period",
  request: {
    query: z
      .object({
        platformId: z.string().describe("Platform ID").optional(),
        communityId: z.string().describe("Community ID").optional(),
        startDate: z
          .string({ message: "must be a valid ISO 8601 date format" })
          .datetime({ message: "must be a valid ISO 8601 date format" })
          .optional(),
        endDate: z
          .string({ message: "must be a valid ISO 8601 date format" })
          .datetime({ message: "must be a valid ISO 8601 date format" })
          .optional(),
      })
      .superRefine((data, ctx) => {
        if (!data.platformId && !data.communityId) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ["communityId"],
            message: "Required to specify communityId or platformId.",
          });
        }
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

export const getImpactReportStatus = createRoute({
  method: "get",
  path: "/impact/status/:job_id",
  tags: ["Reports"],
  summary: "Check report generation status",
  description: "Check the status of an ongoing report generation request",
  request: {
    params: z.object({
      job_id: z.string().uuid().describe("Job ID for the report generation"),
    }),
  },
  responses: {
    200: {
      description: "Report status retrieved successfully",
      content: {
        "application/json": {
          schema: z.object({
            job_id: z.string(),
            status: z.enum(["pending", "processing", "completed", "failed"]),
            reportId: z.string().uuid().optional(),
            report: z.any().optional().describe("The report data if completed"),
            timeframe: z.object({
              startDate: z.string().datetime(),
              endDate: z.string().datetime(),
            }),
            error: z.string().optional(),
          }),
        },
      },
    },
  },
});

export const getImpactReports = createRoute({
  method: "get",
  path: "/impact",
  tags: ["Reports"],
  summary: "Get impact reports",
  description: "Get impact reports",
  request: {
    query: z.object({
      platformId: z.string().describe("Platform ID").optional(),
      communityId: z.string().describe("Community ID").optional(),
    }),
  },
  responses: {
    200: {
      description: "Impact reports retrieved successfully",
    },
  },
});

export const getImpactReport = createRoute({
  method: "get",
  path: "/impact/:summaryId",
  tags: ["Reports"],
  summary: "Get an impact report",
  description: "Get an impact report by ID",
  request: {
    params: z.object({
      summaryId: z.string().uuid().describe("Report ID"),
    }),
  },
  responses: {
    200: {
      description: "Impact report retrieved successfully",
    },
  },
});
