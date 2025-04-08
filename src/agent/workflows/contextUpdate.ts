import { Step, Workflow } from "@mastra/core";
import { z } from "zod";
import { getMessagesTool } from "../tools/index";
import { getCurrentContextData, generateContextUpdatePrompt } from "../agents/alignment";
import dayjs from "dayjs";

// Define the workflow
export const contextUpdateWorkflow = new Workflow({
  name: "context-update",
  triggerSchema: z.object({
    startDate: z.string()
      .datetime({ message: "must be a valid ISO 8601 date format" })
      .transform(val => dayjs(val).valueOf()),
    endDate: z.string()
      .datetime({ message: "must be a valid ISO 8601 date format" })
      .transform(val => dayjs(val).valueOf()),
    platformId: z.string().nonempty(),
    communityId: z.string().nonempty(),
    channelId: z.string().optional(),
  }),
});

// Step 1: Fetch messages
const fetchMessagesStep = new Step({
  id: "fetchMessages",
  outputSchema: z.object({
    transcript: z.string(),
    stats: z.object({
      messageCount: z.number(),
      uniqueUserCount: z.number(),
      messagesByDate: z.array(z.object({
        date: z.string(),
        count: z.number(),
        uniqueUsers: z.number()
      })),
      topContributors: z.array(z.object({
        username: z.string(),
        count: z.number()
      })),
      messagesByChannel: z.array(z.object({
        channel: z.object({
          id: z.string(),
          name: z.string()
        }),
        count: z.number(),
        uniqueUsers: z.number()
      }))
    }).optional()
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
          platformId: context.triggerData.platformId,
          channelId: context.triggerData.channelId,
          includeStats: true,
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
        stats: {
          messageCount: 0,
          uniqueUserCount: 0,
          messagesByDate: [],
          topContributors: [],
          messagesByChannel: []
        }
      };
    }
  },
});

// Step 2: Update context providers based on observations
const updateContextStep = new Step({
  id: "updateContext",
  outputSchema: z.object({
    success: z.boolean(),
    updates: z.object({
      community: z.boolean(),
      team: z.boolean(),
      tokens: z.boolean(),
      examples: z.boolean(),
    }),
    error: z.string().optional(),
  }),
  execute: async ({ context }) => {
    if (context.steps.fetchMessages.status !== "success") {
      throw new Error("Failed to fetch messages");
    }

    const transcript = context.steps.fetchMessages.output.transcript;
    const stats = context.steps.fetchMessages.output.stats;
    const communityId = context.triggerData.communityId;
    const startDate = context.triggerData.startDate;
    const endDate = context.triggerData.endDate;
    
    try {
      // Use the existing alignment agent to analyze the transcript and update context providers
      const response = await generateContextUpdatePrompt(
        communityId,
        transcript,
        stats,
        startDate,
        endDate
      );
      
      // Return success and track which context providers were updated
      return {
        success: true,
        updates: {
          community: response.includes("update_community_info"),
          team: response.includes("add_team_member") || response.includes("remove_team_member"),
          tokens: response.includes("update_token") || response.includes("remove_token"),
          examples: response.includes("add_good_example_reward") || 
                   response.includes("add_bad_example_reward") || 
                   response.includes("remove_good_example_reward") || 
                   response.includes("remove_bad_example_reward"),
        },
      };
    } catch (error) {
      console.error("Error in updateContextStep:", error);
      return {
        success: false,
        updates: {
          community: false,
          team: false,
          tokens: false,
          examples: false,
        },
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  },
});

// Link the steps together
contextUpdateWorkflow
  .step(fetchMessagesStep)
  .then(updateContextStep)
  .commit(); 