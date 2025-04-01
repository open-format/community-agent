import { githubWebhookMiddleware } from "@/middleware/github-webhook";
import { OpenAPIHono } from "@hono/zod-openapi";
import { bearerAuth } from "hono/bearer-auth";
import automationsRoute from "./automations";
import communitiesRoute from "./communities";
import docs from "./docs";
import reportsRoute from "./reports";
import summariesRoute from "./summaries";
import webhooksRoute from "./webhooks";
import rewardsRoute from "./rewards";

const app = new OpenAPIHono();

app.use("/webhooks/github", githubWebhookMiddleware());

app.use("*", async (c, next) => {
  if (c.req.path.includes("/webhooks/")) {
    await next();
    return;
  }

  if (!process.env.API_KEY) {
    throw new Error("API_KEY is not set");
  }

  const bearer = bearerAuth({ token: process.env.API_KEY });
  return bearer(c, next);
});

app.route("/docs", docs);
app.route("/automations", automationsRoute);
app.route("/communities", communitiesRoute);
app.route("/webhooks", webhooksRoute);
app.route("/summaries", summariesRoute);
app.route("/reports", reportsRoute);
app.route("/rewards", rewardsRoute);
export default app;
