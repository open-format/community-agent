import {createRoute, z} from "@hono/zod-openapi";
import {user} from "./schema";
import {community} from "@/routes/api/v1/communities/schema";

export const getUser = createRoute({
  method: "get",
  path: "/{did}",
  description: "Retrieves user details by DID.",
  request: {
    params: z.object({
      did: z.string().uuid(),
    }),
  },
  responses: {
    200: {
      description: "The community was retrieved successfully",
      content: {
        "application/json": {
          schema: user.extend({
            platformConnections: z.array(
              z.object({
                id: z.string().uuid(),
                nickname: z.string().optional(),
                communityId: z.string().uuid(),
                did: z.string(),
                role: z.string(),
                createdAt: z.string().datetime(),
                updatedAt: z.string().datetime(),
                joinedAt: z.string().datetime(),
              }),
            ),
          }),
        },
      },
    },
    404: {
      description: "Users not found",
      content: {
        "application/json": {
          schema: z.object({
            message: z.string(),
          }),
        },
      },
    },
  }
});

