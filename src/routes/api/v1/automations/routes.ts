import { EVENT_TYPES } from "@/db/schema";
import { createRoute, z } from "@hono/zod-openapi";
import { isAddress } from "viem";
import { automation } from "./schema";

// Custom Zod validator for Ethereum addresses
const addressSchema = z.string().refine((value) => isAddress(value), "Invalid Ethereum address");

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

export const triggerAutomation = createRoute({
  method: "post",
  path: "/trigger",
  request: {
    body: {
      content: {
        "application/json": {
          schema: z.object({
            communityId: z.string(),
            eventType: z.enum(EVENT_TYPES),
            userId: addressSchema,
            metadata: z.record(z.unknown()).optional(),
          }),
        },
      },
    },
  },
  responses: {
    200: {
      description: "Automation triggered successfully",
      content: {
        "application/json": {
          schema: z.object({
            success: z.boolean(),
            triggeredAutomations: z.array(automation),
          }),
        },
      },
    },
    404: {
      description: "No matching automation rules found",
      content: {
        "application/json": {
          schema: z.object({
            message: z.string(),
          }),
        },
      },
    },
    500: {
      description: "Error processing automation",
      content: {
        "application/json": {
          schema: z.object({
            message: z.string(),
            error: z.string(),
          }),
        },
      },
    },
  },
});
