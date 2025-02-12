import { Webhooks } from "@octokit/webhooks";
import type { MiddlewareHandler } from "hono";

if (!process.env.GITHUB_WEBHOOK_SECRET) {
  throw new Error("GITHUB_WEBHOOK_SECRET is not set");
}

export function githubWebhookMiddleware(): MiddlewareHandler {
  const webhooks = new Webhooks({ secret: process.env.GITHUB_WEBHOOK_SECRET as string });

  return async (c, next) => {
    const signature = c.req.header("x-hub-signature-256");
    const body = await c.req.text();

    try {
      if (!signature || !(await webhooks.verify(body, signature))) {
        return c.json({ message: "Unauthorized" }, 401);
      }

      c.req.raw = new Request(c.req.url, {
        method: c.req.method,
        body: body,
        headers: c.req.header(),
      });

      await next();
    } catch (error) {
      console.error("GitHub webhook verification error:", error);
      return c.json({ message: "Webhook verification failed" }, 500);
    }
  };
}
