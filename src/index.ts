import { githubWebhookMiddleware } from "@/middleware/github-webhook";
import v1 from "@/routes/api/v1";
import { OpenAPIHono } from "@hono/zod-openapi";
import { bearerAuth } from "hono/bearer-auth";
import { showRoutes } from "hono/dev";

if (!process.env.GITHUB_WEBHOOK_SECRET) {
  throw new Error("GITHUB_WEBHOOK_SECRET must be set");
}

if (!process.env.DISCORD_TOKEN || !process.env.DISCORD_CHANNEL_ID) {
  throw new Error("DISCORD_TOKEN and DISCORD_CHANNEL_ID must be set");
}

const app = new OpenAPIHono();

app.onError((err, c) => {
  console.error(err);
  return c.json({ message: "Internal Server Error" }, 500);
});

app.get("/", (c) => {
  return c.text("Hello Hono!");
});

app.use("/webhooks/github", githubWebhookMiddleware());
app.use("/*", (c, next) => {
  if (c.req.path.startsWith("/webhooks")) {
    return next();
  }
  return bearerAuth({ token: process.env.API_KEY as string })(c, next);
});

app.route("/", v1);

showRoutes(app);

export default {
  port: process.env.PORT ? Number.parseInt(process.env.PORT) : 8080,
  fetch: app.fetch,
};
