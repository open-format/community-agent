import { Step, Workflow } from "@mastra/core";
import { z } from "zod";
import { generateQuestions } from "../agents/questions";
import { getMessagesTool, saveQuestionsTool } from "../tools/index";
import dayjs from "dayjs";

// Define the workflow
export const questionsWorkflow = new Workflow({
  name: "community-questions",
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

// Step 2: Generate questions from transcript using the agent
const generateQuestionsStep = new Step({
  id: "generateQuestions",
  outputSchema: z.object({
    questions: z.array(z.string()),
  }),
  execute: async ({ context }) => {
    if (context.steps.fetchMessages.status !== "success") {
      throw new Error("Failed to fetch messages");
    }

    const transcript = context.steps.fetchMessages.output.transcript;

    // Use the agent to generate the questions
    const result = await generateQuestions(transcript);

    return result;
  },
});

// Step 3: Save the questions to the database
const saveQuestionsStep = new Step({
  id: "saveQuestions",
  outputSchema: z.object({
    success: z.boolean(),
    questionsIds: z.array(z.string().uuid()).optional(),
    error: z.string().optional(),
  }),
  execute: async ({ context }) => {
    if (context.steps.generateQuestions.status !== "success") {
      throw new Error("Failed to generate questions");
    }

    if (context.steps.fetchMessages.status !== "success") {
      throw new Error("Failed to fetch messages");
    }

    if (!saveQuestionsTool.execute) {
      throw new Error("Save questions tool not initialized");
    }

    // Get the questions from the previous step
    const questionsArray = context.steps.generateQuestions.output.questions;

    // Create the context with required fields
    const saveContext = {
      questions: questionsArray,
      startDate: context.triggerData.startDate,
      endDate: context.triggerData.endDate,
      platformId: context.triggerData.platformId,
      communityId: context.triggerData.communityId,
      isAsked: false,
    };

    return saveQuestionsTool.execute({
      context: saveContext,
    });
  },
});

// Link the steps together
questionsWorkflow
.step(fetchMessagesStep)
.then(generateQuestionsStep)
.then(saveQuestionsStep)
.commit(); 