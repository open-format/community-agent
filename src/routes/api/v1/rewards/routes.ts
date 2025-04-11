import { createRoute, z } from "@hono/zod-openapi";

export const postRewardsAnalysis = createRoute({
  method: "post",
  path: "/recommendations",
  tags: ["Rewards"],
  summary: "Start rewards analysis",
  description: "Starts the analysis of community messages to identify and suggest rewards",
  request: {
    headers: z.object({
      "X-Community-ID": z.string().uuid(),
    }),
    body: {
      content: {
        "application/json": {
          schema: z.object({
            platform_id: z.string(),
            start_date: z.string().datetime({ message: "must be a valid ISO 8601 date format" }),
            end_date: z.string().datetime({ message: "must be a valid ISO 8601 date format" }),
          }),
        },
      },
    },
  },
  responses: {
    200: {
      description: "Rewards analysis started successfully",
      content: {
        "application/json": {
          schema: z.object({
            job_id: z.string().uuid(),
            status: z.enum(["pending", "processing", "completed", "failed"]),
            timeframe: z.object({
              start_date: z.string().datetime(),
              end_date: z.string().datetime(),
            }),
          }),
        },
      },
    },
    400: {
      description: "Bad request",
    },
    404: {
      description: "Community not found",
    },
    500: {
      description: "An error occurred while starting the rewards analysis",
    },
  },
});

export const getRewardsAnalysisStatus = createRoute({
  method: "get",
  path: "/recommendations/status/:job_id",
  tags: ["Rewards"],
  summary: "Check rewards analysis status",
  description: "Check the status of an ongoing rewards analysis request",
  request: {
    params: z.object({
      job_id: z.string().uuid(),
    }),
  },
  responses: {
    200: {
      description: "Rewards analysis status retrieved successfully",
      content: {
        "application/json": {
          schema: z.object({
            job_id: z.string().uuid(),
            status: z.enum(["pending", "processing", "completed", "failed"]),
            rewards: z
              .array(
                z.object({
                  contributor: z.string(),
                  wallet_address: z.string().nullable(),
                  reward_id: z.string(),
                  points: z.number(),
                  summary: z.string(),
                  description: z.string(),
                  community_id: z.string(),
                  platform: z.string(),
                  impact: z.string(),
                  evidence: z.array(z.string()),
                  reasoning: z.string(),
                  error: z.string().optional(),
                }),
              )
              .optional(),
            timeframe: z.object({
              start_date: z.string().datetime(),
              end_date: z.string().datetime(),
            }),
            error: z.string().optional(),
          }),
        },
      },
    },
    404: {
      description: "Job not found",
    },
    500: {
      description: "An error occurred while checking the rewards analysis status",
    },
  },
});

export const getPendingRewards = createRoute({
  method: "get",
  path: "/recommendations",
  tags: ["Rewards"],
  summary: "Get pending rewards for a community",
  description: "Retrieves all pending rewards for a specific community",
  request: {
    headers: z.object({
      "X-Community-ID": z.string(),
    }),
    query: z.object({
      status: z.enum(["pending", "processed", "failed"]).optional(),
      limit: z
        .string()
        .transform((val) => Number(val))
        .pipe(z.number().min(1).max(100))
        .optional()
        .default("50"),
      offset: z
        .string()
        .transform((val) => Number(val))
        .pipe(z.number().min(0))
        .optional()
        .default("0"),
    }),
  },
  responses: {
    200: {
      description: "Pending rewards retrieved successfully",
      content: {
        "application/json": {
          schema: z.object({
            rewards: z.array(
              z.object({
                id: z.string(),
                contributor_name: z.string(),
                wallet_address: z.string(),
                platform: z.enum(["discord", "github", "telegram"]),
                reward_id: z.string(),
                points: z.number(),
                summary: z.string().nullable(),
                description: z.string().nullable(),
                community_id: z.string(),
                impact: z.string().nullable(),
                evidence: z.array(z.string()),
                reasoning: z.string().nullable(),
                metadata_uri: z.string(),
                created_at: z.string().datetime(),
              }),
            ),
            total: z.number(),
            limit: z.number(),
            offset: z.number(),
          }),
        },
      },
    },
    400: {
      description: "Bad request - missing community_id",
    },
    500: {
      description: "An error occurred while retrieving pending rewards",
    },
  },
});

export const deletePendingReward = createRoute({
  method: "delete",
  path: "/recommendations/{id}",
  tags: ["Rewards"],
  summary: "Delete a pending reward recommendation",
  description: "Deletes a specific pending reward recommendation by ID",
  request: {
    params: z.object({
      id: z.string().uuid(),
    }),
  },
  responses: {
    200: {
      description: "Pending reward deleted successfully",
      content: {
        "application/json": {
          schema: z.object({
            success: z.boolean(),
          }),
        },
      },
    },
    404: {
      description: "Pending reward not found",
    },
    500: {
      description: "An error occurred while deleting the pending reward",
    },
  },
});
