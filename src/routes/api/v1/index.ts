import { generateImpactReports } from "@/jobs/generate-impact-report";
import { generateRewardRecommendations } from "@/jobs/generate-reward-recommendations";
import { githubWebhookMiddleware } from "@/middleware/github-webhook";
import { OpenAPIHono } from "@hono/zod-openapi";
import { bearerAuth } from "hono/bearer-auth";
import cron from "node-cron";
import communitiesRoute from "./communities";
import docs from "./docs";
import reportsRoute from "./reports";
import rewardsRoute from "./rewards";
import summariesRoute from "./summaries";
import webhooksRoute from "./webhooks";
import usersRoute from "./users";
import platformConnectionsRoute from "./platform-connections";

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
app.route("/communities", communitiesRoute);
app.route("/webhooks", webhooksRoute);
app.route("/summaries", summariesRoute);
app.route("/reports", reportsRoute);
app.route("/rewards", rewardsRoute);
app.route("/users", usersRoute);
app.route("/platform-connections", platformConnectionsRoute);

// Cron job to generate reward recommendations every day at 12:00 AM UTC.
cron.schedule("0 0 * * *", async () => {
  await generateRewardRecommendations();
});

// Cron job to generate impact reports every week Monday at 12:00 AM UTC.
cron.schedule("0 0 * * 1", async () => {
  await generateImpactReports();
});

export default app;
