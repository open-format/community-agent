import { createRoute, z } from "@hono/zod-openapi";
import { automation } from "./schema";

export const getAutomations = createRoute({
  method: "get",
  path: "/",
  request: {},
  responses: {
    200: {
      description: "The automations were retrieved successfully",
      content: {
        "application/json": {
          schema: z.array(automation),
        },
      },
    },
  },
});

export const createAutomation = createRoute({
  method: "post",
  path: "/",
  request: {
    body: {
      content: {
        "application/json": {
          schema: automation,
        },
      },
    },
  },
  responses: {
    200: {
      description: "The automation was created successfully",
      content: {
        "application/json": {
          schema: automation,
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

export const updateAutomation = createRoute({
  method: "put",
  path: "/{id}",
  request: {
    params: z.object({
      id: z.string(),
    }),
  },
  responses: {
    200: {
      description: "The automation was updated successfully",
      content: {
        "application/json": {
          schema: automation,
        },
      },
    },
  },
});

export const deleteAutomation = createRoute({
  method: "delete",
  path: "/{id}",
  request: {
    params: z.object({
      id: z.string(),
    }),
  },
  responses: {
    200: {
      description: "The automation was deleted successfully",
      content: {
        "application/json": {
          schema: z.object({
            success: z.boolean(),
          }),
        },
      },
    },
  },
});
