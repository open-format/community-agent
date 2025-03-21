import { githubWebhookMiddleware } from "@/middleware/github-webhook";
import { OpenAPIHono } from "@hono/zod-openapi";
import { bearerAuth } from "hono/bearer-auth";
import agentRoute from "./agent";
import automationsRoute from "./automations";
import communitiesRoute from "./communities";
import docs from "./docs";
import webhooksRoute from "./webhooks";
import messagesRoute from "./messages";

const app = new OpenAPIHono().basePath("/api/v1");

app.use("/webhooks/github", githubWebhookMiddleware());
app.use("/message/*", bearerAuth({ token: process.env.API_KEY as string }));
app.use("/docs/*", bearerAuth({ token: process.env.API_KEY as string }));
app.use("/automations/*", bearerAuth({ token: process.env.API_KEY as string }));
app.use("/communities/*", bearerAuth({ token: process.env.API_KEY as string }));
app.use("/messages/*", bearerAuth({ token: process.env.API_KEY as string }));

app.route("/docs", docs);
app.route("/agent", agentRoute);
app.route("/automations", automationsRoute);
app.route("/communities", communitiesRoute);
app.route("/webhooks", webhooksRoute);
app.route("/messages", messagesRoute);

export default app;
