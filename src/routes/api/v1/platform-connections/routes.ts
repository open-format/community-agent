import { createRoute, z } from "@hono/zod-openapi";
import { updatePlatformConnectionsRequest, updatePlatformConnectionsResponse } from "./schema";

export const updatePlatformConnectionsRoute = createRoute({
  method: "put",
  path: "/{id}",
  request: {
    body: {
      content: {
        "application/json": {
          schema: updatePlatformConnectionsRequest,
        },
      },
    },
  },
  responses: {
    200: {
      description: "The platform connection was updated successfully",
      content: {
        "application/json": {
          schema: updatePlatformConnectionsResponse,
        },
      },
    },
    404: {
      description: "Platform connection not found",
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
