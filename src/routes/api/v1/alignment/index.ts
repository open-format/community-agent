import { OpenAPIHono } from "@hono/zod-openapi";
import { mastra } from "@/agent";
import { ReportStatus, createReportJob, getReportJob, getReportResult, storeReportResult, updateReportJobStatus } from "@/lib/redis";
import { postAlignmentChat, postGenerateQuestions, getQuestionsStatus } from "./routes";
import { generateContextPrompt } from "@/agent/agents/alignment";
import dayjs from "dayjs";
import { db } from "@/db";

enum Errors {
  PLATFORM_NOT_FOUND = "Platform not for given community",
  COMMUNITY_NOT_FOUND = "Community not found",
}

const alignmentRoute = new OpenAPIHono();

// Chat with the alignment agent
alignmentRoute.openapi(postAlignmentChat, async (c) => {
  try {
    console.log("[Alignment API] Received chat request");
    const { message } = await c.req.json();
    const community_id = c.req.header("X-Community-ID");
    
    console.log(`[Alignment API] Processing request for community: ${community_id}`);
    
    if (!community_id) {
      console.log("[Alignment API] Error: Missing community ID");
      return c.json({ message: Errors.COMMUNITY_NOT_FOUND }, 400);
    }
    
    if (!message) {
      console.log("[Alignment API] Error: Missing message");
      return c.json({ message: "Message is required" }, 400);
    }

    console.log(`[Alignment API] Calling alignment agent with message: "${message.substring(0, 50)}${message.length > 50 ? '...' : ''}"`);
    
    // Process the query with the alignment agent
    const response = await generateContextPrompt(community_id, message);

    console.log(`[Alignment API] Received response from alignment agent`);
    
    return c.json({
      response,
    });
  } catch (error) {
    console.error("[Alignment API] Error processing alignment chat:", error);
    return c.json({ 
      message: "Failed to process alignment chat", 
      error: error instanceof Error ? error.message : String(error)
    }, 500);
  }
});

// Function to run the questions workflow in the background
async function generateQuestionsInBackground(job_id: string, community_id: string, platform_id: string, start_date: number, end_date: number, channel_id?: string) {
  try {
    // Get the workflow from mastra
    const workflow = mastra.getWorkflow("questionsWorkflow");
    const { start } = workflow.createRun();

    const result = await start({
      triggerData: {
        communityId: community_id,
        platformId: platform_id,
        startDate: dayjs(start_date).valueOf(),
        endDate: dayjs(end_date).valueOf(),
        channelId: channel_id,
      },
    });

    // Check if the workflow completed successfully
    if (result.results.saveQuestions?.status === "success") {
      // Store only the questionsIds array from the result
      await storeReportResult(job_id, result.results.saveQuestions.output.questionsIds || []);
      
      // Update the job status to completed
      await updateReportJobStatus(job_id, ReportStatus.COMPLETED);
    } else {
      // Update the job status to failed
      await updateReportJobStatus(job_id, ReportStatus.FAILED, {
        error: "Failed to generate questions"
      });
    }
  } catch (error) {
    console.error("Error generating questions:", error);
    await updateReportJobStatus(job_id, ReportStatus.FAILED, {
      error: error instanceof Error ? error.message : String(error)
    });
  }
}

// Generate questions endpoint
alignmentRoute.openapi(postGenerateQuestions, async (c) => {
  try {
    const { platform_id, start_date, end_date, channel_id } = await c.req.json();
    const community_id = c.req.header("X-Community-ID");
    
    if (!community_id) {
      return c.json({ message: Errors.COMMUNITY_NOT_FOUND }, 400);
    }
    
    const job_id = crypto.randomUUID();
    const start_timestamp = dayjs(start_date).valueOf();
    const end_timestamp = dayjs(end_date).valueOf();

    // Create a report job in Redis
    await createReportJob(job_id, platform_id, start_timestamp, end_timestamp);

    // Start the background process
    generateQuestionsInBackground(job_id, community_id, platform_id, start_timestamp, end_timestamp, channel_id);

    return c.json({
      job_id,
      status: ReportStatus.PENDING,
      timeframe: {
        start_date,
        end_date,
      },
    });
  } catch (error) {
    console.error("Error starting questions generation:", error);
    return c.json({ 
      message: "Failed to start questions generation", 
      error: error instanceof Error ? error.message : String(error)
    }, 500);
  }
});

// Questions status endpoint
alignmentRoute.openapi(getQuestionsStatus, async (c) => {
  try {
    const { job_id } = c.req.param();

    // Get the job from Redis
    const job = await getReportJob(job_id);

    if (!job) {
      return c.json({
        job_id,
        status: "failed" as const,
        timeframe: {
          start_date: new Date().toISOString(),
          end_date: new Date().toISOString(),
        },
        error: "Questions generation job not found",
      });
    }
    
    // If the job is completed, get the questions
    let questions: string[] = [];
    if (job.status === ReportStatus.COMPLETED) {
      // Get the question IDs from the job result
      const result = await getReportResult(job_id);
      const questionIds = Array.isArray(result) ? result : [];
      
      // Fetch the questions from the database
      if (questionIds.length > 0) {
        const questionsData = await db.query.communityQuestions.findMany({
          where: (questions, { inArray }) => inArray(questions.id, questionIds),
        });
        
        // Map the questions to just include the question text
        questions = questionsData.map(q => q.questions);
      }
    }
    
    return c.json({
      job_id,
      status: job.status,
      questions: questions,
      timeframe: {
        start_date: dayjs(job.startDate).toISOString(),
        end_date: dayjs(job.endDate).toISOString(),
      },
      ...(job.error ? { error: job.error } : {}),
    });
  } catch (error) {
    console.error("Error checking questions generation status:", error);
    return c.json({
      job_id: c.req.param("job_id"),
      status: "failed" as const,
      timeframe: {
        start_date: new Date().toISOString(),
        end_date: new Date().toISOString(),
      },
      error: String(error),
    });
  }
});

export default alignmentRoute; 