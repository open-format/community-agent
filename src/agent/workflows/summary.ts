import { Step, Workflow } from "@mastra/core";
import { z } from "zod";
import { generateSummary } from "../agents/summary";
import { getMessagesTool, saveSummaryTool } from "../tools/index";
import dayjs from "dayjs";

// Define the workflow
export const summaryWorkflow = new Workflow({
  name: "community-summary",
  triggerSchema: z.object({
    startDate: z.string()
      .datetime({ message: "must be a valid ISO 8601 date format" })
      .transform(val => dayjs(val).valueOf()),
    endDate: z.string()
      .datetime({ message: "must be a valid ISO 8601 date format" })
      .transform(val => dayjs(val).valueOf()),
    platformId: z.string().nonempty(),
    channelId: z.string().optional(),
  }),
});

// Step 1: Fetch messages
const fetchMessagesStep = new Step({
  id: "fetchMessages",
  outputSchema: z.object({
    transcript: z.string(),
  }),
  execute: async ({ context }) => {
    if (!getMessagesTool.execute) {
      throw new Error("Fetch messages tool not initialized");
    }

    try {
      const result = await getMessagesTool.execute({
        context: {
          startDate: context.triggerData.startDate,
          endDate: context.triggerData.endDate,
          platformIds: [context.triggerData.platformId],
          channelId: context.triggerData.channelId,
          includeStats: false,
          includeMessageId: false,
        },
      });

      return result;
    } catch (error: unknown) {
      if (error instanceof Error) {
        console.error("Error in fetchMessagesStep:", error.message);
      } else {
        console.error("Error in fetchMessagesStep:", error);
      }
      // Instead of throwing, return a transcript indicating no messages
      return {
        transcript: `No messages found. Note: ${error instanceof Error ? error.message : "Unknown error"}`,
      };
    }
  },
});

// Step 2: Generate summary from transcript using the agent
const generateSummaryStep = new Step({
  id: "generateSummary",
  outputSchema: z.object({
    summary: z.string(),
    // summarizationResult: z.any(),
  }),
  execute: async ({ context }) => {
    if (context.steps.fetchMessages.status !== "success") {
      throw new Error("Failed to fetch messages");
    }

    const transcript = context.steps.fetchMessages.output.transcript;

    // Use the agent to generate the summary
    const result = await generateSummary(transcript);

    return result;
  },
});

// Step 3: Save the summary to the database
const saveSummaryStep = new Step({
  id: "saveSummary",
  outputSchema: z.object({
    success: z.boolean(),
    summaryId: z.string().uuid().optional(),
    error: z.string().optional(),
  }),
  execute: async ({ context }) => {
    if (context.steps.generateSummary.status !== "success") {
      throw new Error("Failed to generate summary");
    }

    if (context.steps.fetchMessages.status !== "success") {
      throw new Error("Failed to fetch messages");
    }

    if (!saveSummaryTool.execute) {
      throw new Error("Save summary tool not initialized");
    }

    // Create the context with required fields
    const saveContext = {
      summary: context.steps.generateSummary.output.summary,
      startDate: context.triggerData.startDate,
      endDate: context.triggerData.endDate,
      platformId: context.triggerData.platformId,
      summarizationResult: context.steps.generateSummary.output.summarizationResult,
    };

    return saveSummaryTool.execute({
      context: saveContext,
    });
  },
});

// Link the steps together
summaryWorkflow.step(fetchMessagesStep).then(generateSummaryStep).then(saveSummaryStep).commit();
