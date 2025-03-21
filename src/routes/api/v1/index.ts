import { authMiddleware } from "@/middleware/auth";
import { githubWebhookMiddleware } from "@/middleware/github-webhook";
import { OpenAPIHono } from "@hono/zod-openapi";
import agentRoute from "./agent";
import automationsRoute from "./automations";
import communitiesRoute from "./communities";
import docs from "./docs";
import webhooksRoute from "./webhooks";

const app = new OpenAPIHono().basePath("/api/v1");

app.use("/webhooks/github", githubWebhookMiddleware());
app.use("*", authMiddleware());

app.route("/docs", docs);
app.route("/agent", agentRoute);
app.route("/automations", automationsRoute);
app.route("/communities", communitiesRoute);
app.route("/webhooks", webhooksRoute);

export default app;
