import { Hono } from "hono";
const app = new Hono();

app.get("/", (c) => {
  return c.text("Hello Hono!");
});

app.post("/webhooks/github", async (c) => {
  const payload = await c.req.json();
  console.log(payload);
  if (payload.sender.type !== "User") {
    return c.json({
      message: "Not a user, ignoring",
    });
  }
  if (payload?.commits?.length) {
    return c.json({
      message: `${payload.sender.login} pushed to ${payload.repository.name}`,
    });
  }
  return c.json({
    message: "No commits found",
  });
});

export default app;
