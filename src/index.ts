import { Hono } from "hono";
import { bearerAuth } from "hono/bearer-auth";
import { showRoutes } from "hono/dev";
import { githubWebhookMiddleware } from "./middleware/github-webhook";
import agentRoute from "./routes/agent";
import docsRoute from "./routes/docs";
import githubWebhookRoute from "./routes/webhooks/github";

const app = new Hono();

app.get("/", (c) => {
  return c.text("Hello Hono!");
});

app.use("/webhooks/github", githubWebhookMiddleware());
app.use("/message/*", bearerAuth({ token: process.env.API_KEY as string }));
app.use("/docs/*", bearerAuth({ token: process.env.API_KEY as string }));

app.route("/docs", docsRoute);
app.route("/agent", agentRoute);
app.route("/webhooks", githubWebhookRoute);

showRoutes(app);

export default {
  port: process.env.PORT ? Number.parseInt(process.env.PORT) : 8080,
  fetch: app.fetch,
};
