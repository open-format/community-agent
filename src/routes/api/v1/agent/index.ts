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

// Add the report endpoint
agentRoute.get("/report", async (c) => {
  try {
    const workflow = mastra.getWorkflow("impactReportWorkflow"); // Make sure this matches the name in your workflow definition
    const { runId, start } = workflow.createRun();

    // Set date range for the past week
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - 7);

    const result = await start({
      triggerData: {
        startDate,
        endDate,
        platformId: "932238833146277958",
        communityId: "123",
      },
    });

    if (!result.results?.generateReport?.output) {
      console.error('Workflow results:', result.results);
      throw new Error('Report generation failed - no output available');
    }

    return c.json({
      report: result.results.generateReport.output.report
    });
  } catch (error: any) {
    console.error('Error in report generation:', error);
    return c.json({
      error: error.message || 'Unknown error occurred',
      success: false
    });
  }
});

export default agentRoute;
