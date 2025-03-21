import { Step, Workflow } from "@mastra/core";
import { z } from "zod";
import { generateSummary } from "../agents/summary";
import { fetchCommunityMessagesTool, saveSummaryTool } from "../tools/index";

// Define the workflow
export const summaryWorkflow = new Workflow({
  name: "community-summary",
  triggerSchema: z.object({
    startDate: z.number(),
    endDate: z.number(),
    platformId: z.string().nonempty(),
    communityId: z.string().nonempty(),
  }),
});

// Step 1: Fetch messages
const fetchMessagesStep = new Step({
  id: "fetchMessages",
  outputSchema: z.object({
    transcript: z.string(),
    messageCount: z.number(),
    uniqueUserCount: z.number(),
  }),
  execute: async ({ context }) => {
    if (!fetchCommunityMessagesTool.execute) {
      throw new Error("Fetch messages tool not initialized");
    }

    try {
      // Call our fetchCommunityMessagesTool directly with trigger data
      const result = await fetchCommunityMessagesTool.execute({
        context: {
          startDate: context.triggerData.startDate,
          endDate: context.triggerData.endDate,
          platformId: context.triggerData.platformId,
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
        messageCount: 0,
        uniqueUserCount: 0,
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
      communityId: context.triggerData.communityId,
      summary: context.steps.generateSummary.output.summary,
      startDate: context.triggerData.startDate,
      endDate: context.triggerData.endDate,
      platformId: context.triggerData.platformId,
      messageCount: context.steps.fetchMessages.output.messageCount,
      uniqueUserCount: context.steps.fetchMessages.output.uniqueUserCount,
      summarizationResult: context.steps.generateSummary.output.summarizationResult,
    };

    return saveSummaryTool.execute({
      context: saveContext,
    });
  },
});

// Link the steps together
summaryWorkflow.step(fetchMessagesStep).then(generateSummaryStep).then(saveSummaryStep).commit();
