import v1 from "@/routes/api/v1";
import { OpenAPIHono } from "@hono/zod-openapi";
import { showRoutes } from "hono/dev";
import { ensureClients } from "./clients";

ensureClients();

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
