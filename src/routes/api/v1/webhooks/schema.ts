import { z } from "@hono/zod-openapi";

export const githubWebhook = z.object({
  payload: z.any(),
});
