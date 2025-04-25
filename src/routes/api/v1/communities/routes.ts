import { addressSchema } from "@/utils/schema";
import { createRoute, z } from "@hono/zod-openapi";
import { isAddress } from "viem";
import { community, communityUpdate } from "./schema";

export const getCommunity = createRoute({
  method: "get",
  path: "/{id}",
  request: {
    params: z.object({
      id: z.union([z.string().uuid(), addressSchema]).refine((val) => isAddress(val), {
        message:
          "Invalid community ID format. Please provide either a valid UUID or Ethereum address",
      }),
    }),
  },
  responses: {
    200: {
      description: "The community was retrieved successfully",
      content: {
        "application/json": {
          schema: community.extend({
            platformConnections: z.array(
              z.object({
                id: z.string(),
                communityId: z.string().nullable(),
                platformId: z.string(),
                platformType: z.enum(["discord", "github", "telegram"]),
                platformName: z.string().nullable(),
                createdAt: z.date().nullable(),
                updatedAt: z.date().nullable(),
              }),
            ),
          }),
        },
      },
    },
    404: {
      description: "Community not found",
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

export const createCommunity = createRoute({
  method: "post",
  path: "/",
  request: {
    body: {
      content: {
        "application/json": {
          schema: community,
        },
      },
    },
  },
  responses: {
    200: {
      description: "The community was created successfully",
      content: {
        "application/json": {
          schema: community,
        },
      },
    },
    409: {
      description: "Community already exists",
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

export const updateCommunity = createRoute({
  method: "put",
  path: "/{id}",
  request: {
    // params: z.object({
    //   id: addressSchema,
    // }),
    body: {
      content: {
        "application/json": {
          schema: communityUpdate,
        },
      },
    },
  },
  responses: {
    200: {
      description: "The community was updated successfully",
      content: {
        "application/json": {
          schema: community,
        },
      },
    },
    404: {
      description: "Community not found",
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

export const generateCode = createRoute({
  method: "post",
  path: "/verify/generate-code",
  request: {
    body: {
      content: {
        "application/json": {
          schema: z.object({
            community_id: z.string(),
          }),
        },
      },
    },
  },
  responses: {
    200: {
      description: "The code was generated successfully",
      content: {
        "application/json": {
          schema: z.object({
            success: z.boolean(),
            code: z.string(),
            expiresIn: z.string(),
          }),
        },
      },
    },
    404: {
      description: "Community not found",
      content: {
        "application/json": {
          schema: z.object({
            message: z.string(),
          }),
        },
      },
    },
    500: {
      description: "Failed to generate code",
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
