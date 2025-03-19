import { mastra } from "@/agent";
import { Hono } from "hono";

const agentRoute = new Hono();

agentRoute.post("/summary", async (c) => {
  const workflow = mastra.getWorkflow("summaryWorkflow");
  const { runId, start } = workflow.createRun();

  // Set date range for the past week
  const endDate = new Date();
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - 7); // Go back 7 days

  const result = await start({
    triggerData: {
      startDate,
      endDate,
      platformId: "932238833146277958",
      communityId: "123",
    },
  });
  return c.json(result);
});

export default agentRoute;
