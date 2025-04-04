import { createRoute, z } from "@hono/zod-openapi";

export const postRewardsAnalysis = createRoute({
  method: "post",
  path: "/rewards",
  tags: ["Rewards"],
  summary: "Analyze community activity for rewards",
  description: "Analyzes community messages to identify and suggest rewards for valuable contributions",
  request: {
    headers: z.object({
      "X-Community-ID": z.string(),
    }),
    body: {
      content: {
        "application/json": {
          schema: z.object({
            platformId: z.string(),
            startDate: z
              .string()
              .datetime({ message: "must be a valid ISO 8601 date format" }),
            endDate: z
              .string()
              .datetime({ message: "must be a valid ISO 8601 date format" }),
          }),
        },
      },
    },
  },
  responses: {
    200: {
      description: "Rewards analysis completed successfully",
      content: {
        "application/json": {
          schema: z.object({
            rewards: z.array(z.object({
              contributor: z.string(),
              walletAddress: z.string().nullable(),
              rewardId: z.string(),
              points: z.number(),
              error: z.string().optional(),
            })),
            timeframe: z.object({
              startDate: z.string().datetime(),
              endDate: z.string().datetime(),
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
      description: "An error occurred while analyzing rewards",
    },
  },
});

export const getPendingRewards = createRoute({
  method: "get",
  path: "/pending-rewards",
  tags: ["Rewards"],
  summary: "Get pending rewards for a community",
  description: "Retrieves all pending rewards for a specific community",
  request: {
    headers: z.object({
      "X-Community-ID": z.string(),
    }),
    query: z.object({
      status: z.enum(["pending", "processed", "failed"]).optional(),
      limit: z.string().transform(val => Number(val)).pipe(z.number().min(1).max(100)).optional().default("50"),
      offset: z.string().transform(val => Number(val)).pipe(z.number().min(0)).optional().default("0"),
    }),
  },
  responses: {
    200: {
      description: "Pending rewards retrieved successfully",
      content: {
        "application/json": {
          schema: z.object({
            rewards: z.array(z.object({
              id: z.string(),
              contributorName: z.string(),
              walletAddress: z.string(),
              platform: z.enum(["discord", "github", "telegram"]),
              rewardId: z.string(),
              points: z.number(),
              summary: z.string().nullable(),
              description: z.string().nullable(),
              impact: z.string().nullable(),
              evidence: z.array(z.string()),
              reasoning: z.string().nullable(),
              metadataUri: z.string(),
              createdAt: z.string().datetime(),
            })),
            total: z.number(),
            limit: z.number(),
            offset: z.number(),
          }),
        },
      },
    },
    404: {
      description: "Community not found",
    },
    500: {
      description: "An error occurred while retrieving pending rewards",
    },
  },
});

export const deletePendingReward = createRoute({
  method: "delete",
  path: "/pending-rewards/{id}",
  tags: ["Rewards"],
  summary: "Delete a pending reward",
  description: "Deletes a specific pending reward by ID",
  request: {
    headers: z.object({
      "X-Community-ID": z.string(),
    }),
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
