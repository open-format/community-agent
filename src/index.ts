import v1 from "@/routes/api/v1";
import { OpenAPIHono } from "@hono/zod-openapi";
import { showRoutes } from "hono/dev";

// Only require GITHUB_WEBHOOK_SECRET in production
if (process.env.NODE_ENV === "production" && !process.env.GITHUB_WEBHOOK_SECRET) {
  throw new Error("GITHUB_WEBHOOK_SECRET must be set in production environment");
}

if (!process.env.DISCORD_TOKEN || !process.env.DISCORD_CHANNEL_ID) {
  throw new Error("DISCORD_TOKEN and DISCORD_CHANNEL_ID must be set");
}

const app = new OpenAPIHono();

app.get("/ping", (c) => {
  return c.text("pong 🏓");
});

app.route("/api/v1", v1);

app.doc("/api/doc", {
  openapi: "3.0.0",
  info: {
    version: "1.0.0",
    title: "OPENFORMAT - Automations API",
  },
});

showRoutes(app);

export default {
  port: process.env.PORT ? Number.parseInt(process.env.PORT) : 8080,
  fetch: app.fetch,
  idleTimeout: 240,
};
