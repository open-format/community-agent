import { createRoute, z } from "@hono/zod-openapi";

export const postGithubWebhook = createRoute({
  method: "post",
  path: "/github",
  request: {
    body: {
      content: {
        "application/json": {
          schema: z.object({
            payload: z.any(),
          }),
        },
      },
    },
  },
  responses: {
    200: {
      description: "The webhook was processed successfully",
    },
  },
});
