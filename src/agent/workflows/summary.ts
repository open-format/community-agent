import { logger } from "@/services/logger";
import { Step, Workflow } from "@mastra/core";
import dayjs from "dayjs";
import { z } from "zod";
import { generateSummary } from "../agents/summary";
import { getMessagesTool, saveSummaryTool } from "../tools/index";

// Define the workflow
export const summaryWorkflow = new Workflow({
  name: "community-summary",
  triggerSchema: z.object({
    startDate: z
      .string()
      .datetime({ message: "must be a valid ISO 8601 date format" })
      .transform((val) => dayjs(val).valueOf()),
    endDate: z
      .string()
      .datetime({ message: "must be a valid ISO 8601 date format" })
      .transform((val) => dayjs(val).valueOf()),
    platformId: z.string().nonempty(),
    channelId: z.string().optional(),
  }),
});

// Step 1: Fetch messages
const fetchMessagesStep = new Step({
  id: "fetchMessages",
  outputSchema: z.object({
    transcript: z.string(),
    messageCount: z.number(),
    hasMessages: z.boolean(),
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
          includeStats: true, // Need stats to get message count
          includeMessageId: false,
        },
      });

      const messageCount = result.stats?.messageCount || 0;
      const hasMessages = messageCount > 0;

      if (!hasMessages) {
        logger.info(
          {
            platformId: context.triggerData.platformId,
            messageCount,
            startDate: context.triggerData.startDate,
            endDate: context.triggerData.endDate,
          },
          "No messages found in date range - skipping summary generation",
        );
      }

      return {
        transcript: result.transcript,
        messageCount,
        hasMessages,
      };
    } catch (error: unknown) {
      if (error instanceof Error) {
        console.error("Error in fetchMessagesStep:", error.message);
      } else {
        console.error("Error in fetchMessagesStep:", error);
      }
      // Return with no messages if there's an error
      return {
        transcript: `No messages found. Note: ${error instanceof Error ? error.message : "Unknown error"}`,
        messageCount: 0,
        hasMessages: false,
      };
    }
  },
});

// Step 2: Generate summary from transcript using the agent
const generateSummaryStep = new Step({
  id: "generateSummary",
  outputSchema: z.object({
    summary: z.string(),
  }),
  execute: async ({ context }) => {
    if (context.steps.fetchMessages.status !== "success") {
      throw new Error("Failed to fetch messages");
    }

    // Skip summary generation if no messages
    if (!context.steps.fetchMessages.output.hasMessages) {
      logger.info("Skipping summary generation - no messages to summarize");
      return {
        summary: "No messages found in the specified date range.",
      };
    }

    const transcript = context.steps.fetchMessages.output.transcript;
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
    skipped: z.boolean(),
  }),
  execute: async ({ context }) => {
    if (context.steps.generateSummary.status !== "success") {
      throw new Error("Failed to generate summary");
    }

    // Skip saving if no messages (summary will be placeholder text)
    if (!context.steps.fetchMessages.output.hasMessages) {
      logger.info("Skipping summary save - no messages to report on");
      return {
        success: true,
        skipped: true,
      };
    }

    if (!saveSummaryTool.execute) {
      throw new Error("Save summary tool not initialized");
    }

    const saveContext = {
      summary: context.steps.generateSummary.output.summary,
      startDate: context.triggerData.startDate,
      endDate: context.triggerData.endDate,
      platformId: context.triggerData.platformId,
      summarizationResult: context.steps.generateSummary.output.summarizationResult,
    };

    const result = await saveSummaryTool.execute({
      context: saveContext,
    });

    return {
      ...result,
      skipped: false,
    };
  },
});

// Link the steps together
summaryWorkflow.step(fetchMessagesStep).then(generateSummaryStep).then(saveSummaryStep).commit();
