import { authMiddleware } from "@/middleware/auth";
import { githubWebhookMiddleware } from "@/middleware/github-webhook";
import { OpenAPIHono } from "@hono/zod-openapi";
import agentRoute from "./agent";
import automationsRoute from "./automations";
import communitiesRoute from "./communities";
import docs from "./docs";
import webhooksRoute from "./webhooks";
import messagesRoute from "./messages";

const app = new OpenAPIHono();

app.use("/webhooks/github", githubWebhookMiddleware());
app.use("*", authMiddleware());

app.route("/docs", docs);
app.route("/agent", agentRoute);
app.route("/automations", automationsRoute);
app.route("/communities", communitiesRoute);
app.route("/webhooks", webhooksRoute);
app.route("/messages", messagesRoute);

export default app;
