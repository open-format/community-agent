import { createRoute, z } from "@hono/zod-openapi";
import { community, communityUpdate } from "./schema";

export const getCommunity = createRoute({
  method: "get",
  path: "/{id}",
  request: {
    params: z.object({
      id: z.string(),
    }),
  },
  responses: {
    200: {
      description: "The community were retrieved successfully",
      content: {
        "application/json": {
          schema: z.array(community),
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

export const updateCommunity = createRoute({
  method: "put",
  path: "/{id}",
  request: {
    params: z.object({
      id: z.string(),
    }),
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
