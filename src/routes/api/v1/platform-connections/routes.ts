import { createRoute, z } from "@hono/zod-openapi";
import { community, communityUpdate } from "./schema";


export const updatePlatformConnection = createRoute({
  method: "put",
  path: "/{id}",
  request: {
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

